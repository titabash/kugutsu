"""Claude Code SDK repository implementation."""

from typing import AsyncIterator, Optional
from rich.console import Console
import anyio
import asyncio
import subprocess
import json
import tempfile
from pathlib import Path

from ..domain.value_objects import AIAgent

try:
    from claude_code_sdk import query, ClaudeCodeOptions
    CLAUDE_SDK_AVAILABLE = True
except ImportError:
    CLAUDE_SDK_AVAILABLE = False

console = Console()


def run_claude_in_separate_process(prompt_text, result_queue, working_dir=None):
    """完全に分離されたプロセスでClaude Code CLIを実行（グローバル関数）"""
    try:
        import subprocess
        import os
        import tempfile
        import json
        
        print(f"[DEBUG] 分離プロセス PATH: {os.environ.get('PATH', 'PATH not found')}")
        print(f"[DEBUG] working_dir: {working_dir}")
        
        # working_dirが指定されている場合はバリデーション
        if working_dir and not os.path.exists(working_dir):
            print(f"[WARNING] working_dir does not exist: {working_dir}")
            working_dir = None
        
        # プロンプトをファイルに保存
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(prompt_text)
            prompt_file = f.name
        
        try:
            # Claude Code CLIを直接実行
            cmd = ['claude', prompt_text]
            
            # 作業ディレクトリを指定
            cwd = working_dir if working_dir else None
            
            print(f"[DEBUG] 実行コマンド: {' '.join(cmd)}")
            print(f"[DEBUG] 作業ディレクトリ: {cwd}")
            
            # Claude Code CLIを実行
            result = subprocess.run(
                cmd,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=60,  # 60秒でタイムアウト
                env=os.environ.copy()  # 環境変数を明示的に継承
            )
            
            if result.returncode == 0:
                # 成功した場合、stdoutから結果を取得
                output = result.stdout.strip()
                if output:
                    result_queue.put(("success", output))
                else:
                    result_queue.put(("success", "Claude Code CLIが正常に実行されました"))
            else:
                # エラーの場合
                error_msg = result.stderr.strip() or f"Claude Code CLI実行エラー (終了コード: {result.returncode})"
                result_queue.put(("error", error_msg))
                
        finally:
            # 一時ファイルを削除
            if os.path.exists(prompt_file):
                os.unlink(prompt_file)
        
    except subprocess.TimeoutExpired:
        result_queue.put(("error", "Claude Code CLI実行がタイムアウトしました"))
    except FileNotFoundError:
        result_queue.put(("error", "Claude Code CLIが見つかりません。インストールを確認してください"))
    except Exception as e:
        result_queue.put(("error", str(e)))


class ClaudeRepository:
    """Claude Code SDKとの連携"""

    def __init__(self):
        if not CLAUDE_SDK_AVAILABLE:
            raise ImportError(
                "claude-code-sdk が利用できません。\n"
                "インストール方法:\n"
                "  uv add claude-code-sdk\n"
                "  npm install -g @anthropic-ai/claude-code"
            )
        self.session_dir = Path(tempfile.gettempdir()) / "multi_engineer_sessions"
        self.session_dir.mkdir(exist_ok=True)
    
    def save_session_state(self, session_id: str, agent_type: str, result: str) -> None:
        """セッション状態を保存"""
        session_file = self.session_dir / f"{session_id}_{agent_type}.json"
        session_data = {
            "session_id": session_id,
            "agent_type": agent_type,
            "result": result,
            "status": "completed"
        }
        with open(session_file, 'w', encoding='utf-8') as f:
            json.dump(session_data, f, ensure_ascii=False, indent=2)
        console.print(f"[dim]💾 セッション保存: {agent_type} (ID: {session_id})[/dim]")
    
    def load_session_state(self, session_id: str, agent_type: str) -> dict:
        """セッション状態を読み込み"""
        session_file = self.session_dir / f"{session_id}_{agent_type}.json"
        if session_file.exists():
            with open(session_file, 'r', encoding='utf-8') as f:
                session_data = json.load(f)
            console.print(f"[dim]📋 セッション復帰: {agent_type} (ID: {session_id})[/dim]")
            return session_data
        return None

    async def execute_task(
        self,
        prompt: str,
        system_prompt: str,
        max_turns: int = 5,
        working_directory: Optional[str] = None,
        allowed_tools: list[str] = None
    ) -> AsyncIterator[str]:
        """タスクを実行してメッセージを生成"""
        if allowed_tools is None:
            allowed_tools = ["Read", "Write", "Bash", "Glob", "Grep", "Edit", "MultiEdit"]

        print("prompt")
        print(prompt)

        try:
            # working_directoryを適切に処理
            cwd_path = None
            if working_directory:
                from pathlib import Path
                cwd_path = Path(working_directory).resolve()
                console.print(f"[dim]作業ディレクトリ設定: {cwd_path}[/dim]")

            # system_promptの長さもチェック - より厳格な制限
            if system_prompt and len(system_prompt) > 800:
                console.print(f"[yellow]⚠️  システムプロンプトが長すぎます: {len(system_prompt)}文字[/yellow]")
                system_prompt = system_prompt[:800] + "...\n[システムプロンプトが切り詰められました]"

            # シンプルなオプション設定
            options = ClaudeCodeOptions(
                system_prompt=system_prompt,
                max_turns=max_turns,
                allowed_tools=allowed_tools,
                max_thinking_tokens=4000,
            )

            # 分離されたプロセスで作業ディレクトリを使用
            if working_directory:
                console.print(f"[dim]作業ディレクトリを分離プロセスに設定: {working_directory}[/dim]")

            # プロンプトの長さをチェック
            if len(prompt) > 2000:
                console.print(f"[yellow]⚠️  プロンプトが長すぎます: {len(prompt)}文字[/yellow]")
                prompt = prompt[:2000] + "..."

            message_received = False
            message_count = 0

            try:
                # Claude Code SDKに正しいキーワード引数で渡す
                # プロンプトを安全にエンコード
                safe_prompt = prompt.encode('utf-8', errors='ignore').decode('utf-8')

                # 最終的な結果メッセージを蓄積
                final_result = ""
                
                # Claude Code SDK の query() を最もシンプルな形で呼び出す
                # JSONエラーの原因を特定するため、段階的にテスト
                
                # TaskGroup競合を回避するため、multiprocessingで完全なプロセス分離
                import multiprocessing
                import queue
                import pickle
                
                # 分離されたプロセスではグローバル関数run_claude_in_separate_processを使用
                
                try:
                    console.print(f"[dim]🔄 Claude Code SDK実行中（プロセス分離）...[/dim]")
                    
                    # multiprocessingでプロセス分離
                    ctx = multiprocessing.get_context('spawn')  # spawn方式で完全分離
                    result_queue = ctx.Queue()
                    
                    # 環境変数を明示的に継承するための準備
                    import os
                    current_env = os.environ.copy()
                    console.print(f"[dim]現在のPATH: {current_env.get('PATH', 'PATH not found')[:100]}...[/dim]")
                    
                    process = ctx.Process(
                        target=run_claude_in_separate_process,
                        args=(safe_prompt, result_queue, working_directory)
                    )
                    
                    process.start()
                    
                    try:
                        # 60秒でタイムアウト
                        status, result = result_queue.get(timeout=60)
                        process.join()
                        
                        if status == "success":
                            final_result = result
                            message_received = True
                            console.print(f"[green]✅ Claude SDK実行成功（プロセス分離）[/green]")
                        else:
                            final_result = f"SDK実行エラー: {result}"
                            console.print(f"[red]❌ SDK実行エラー: {result}[/red]")
                            
                    except queue.Empty:
                        process.terminate()
                        process.join()
                        final_result = "Claude SDK実行がタイムアウトしました"
                        console.print(f"[red]⏰ Claude SDK実行タイムアウト[/red]")
                        
                except Exception as process_error:
                    final_result = f"プロセス実行エラー: {str(process_error)}"
                    console.print(f"[red]❌ プロセス実行エラー: {process_error}[/red]")
                
                # タスク完了後に最終結果のみをyield
                if final_result:
                    yield final_result
                else:
                    yield "タスクが完了しました"

            except Exception as query_error:
                console.print(f"[red]Query実行エラー: {str(query_error)}[/red]")
                console.print(f"[dim]エラータイプ: {type(query_error).__name__}[/dim]")

                # JSONDecodeErrorの場合は特別な処理
                if "JSONDecodeError" in str(type(query_error)) or "CLIJSONDecodeError" in str(type(query_error)):
                    console.print(f"[red]❌ JSONパースエラーが発生しました。実行を中止します[/red]")
                    yield "Claude Code SDK JSON解析エラーのため実行できませんでした"
                    return
                else:
                    raise

            if not message_received:
                console.print(f"[red]❌ Claude Code SDKから応答がありませんでした[/red]")
                yield "Claude Code SDKから応答がありませんでした"

        except ExceptionGroup as eg:
            # ExceptionGroupの場合の処理
            console.print(f"[red]Claude Code SDK ExceptionGroup: {len(eg.exceptions)}個の例外[/red]")
            has_json_error = False

            for i, exc in enumerate(eg.exceptions):
                console.print(f"[dim]例外{i+1}: {type(exc).__name__}: {str(exc)}[/dim]")

                # 詳細なトレースバック情報を取得
                import traceback
                exc_traceback = traceback.format_exception(type(exc), exc, exc.__traceback__)
                console.print(f"[dim]詳細トレースバック: {''.join(exc_traceback[-3:])}[/dim]")

                # CLIJSONDecodeErrorの特別処理
                if "CLIJSONDecodeError" in str(type(exc)):
                    has_json_error = True
                    console.print(f"[yellow]⚠️  Claude Code SDK JSON解析エラー[/yellow]")
                    console.print(f"[dim]このエラーは通常、長すぎるメッセージやWorktreeパス問題で発生します[/dim]")
                    # より詳細な診断情報
                    if working_directory:
                        console.print(f"[dim]問題の可能性: 作業ディレクトリパス '{working_directory}'[/dim]")

            if has_json_error:
                console.print(f"[red]❌ JSONパースエラーが発生しました。実行を中止します[/red]")
                yield "Claude Code SDK JSON解析エラーのため実行できませんでした"
            else:
                yield f"Claude Code SDK実行エラーが発生しました"

        except Exception as e:
            import traceback
            console.print(f"[red]Claude Code SDK エラー: {str(e)}[/red]")
            console.print(f"[dim]エラータイプ: {type(e).__name__}[/dim]")
            console.print(f"[dim]トレースバック: {traceback.format_exc()}[/dim]")
            yield f"エラーが発生しました: {str(e)}"

    def format_message(self, message, agent: AIAgent) -> Optional[str]:
        """メッセージをフォーマット"""
        try:
            # メッセージがNoneまたは空の場合
            if not message:
                return None

            # 文字列メッセージの場合（エラーメッセージ等）
            if isinstance(message, str):
                return f"\n[bold {agent.color}]{agent.emoji} {agent.name}:[/bold {agent.color}] {message}"

            # 初期化メッセージ
            if hasattr(message, 'subtype') and getattr(message, 'subtype', None) == 'init':
                return f"[dim]🔧 {agent.emoji} {agent.name}初期化完了[/dim]"

            # アシスタントメッセージ
            if hasattr(message, 'content') and message.content:
                formatted_messages = []
                try:
                    for content_item in message.content:
                        if hasattr(content_item, 'text') and content_item.text:
                            formatted_messages.append(f"\n[bold {agent.color}]{agent.emoji} {agent.name}:[/bold {agent.color}] {content_item.text}")
                        elif hasattr(content_item, 'name') and content_item.name:
                            tool_name = content_item.name
                            msg = f"\n[yellow]🔧 ツール実行 ({agent.name}):[/yellow] [cyan]{tool_name}[/cyan]"
                            try:
                                if hasattr(content_item, 'input') and content_item.input:
                                    if isinstance(content_item.input, dict):
                                        if 'file_path' in content_item.input:
                                            msg += f"\n   📁 ファイル: [green]{content_item.input['file_path']}[/green]"
                                        if 'old_string' in content_item.input and 'new_string' in content_item.input:
                                            msg += f"\n   ✏️  編集操作を実行中..."
                            except (AttributeError, TypeError):
                                pass
                            formatted_messages.append(msg)
                except (AttributeError, TypeError):
                    # コンテンツアイテムの処理でエラーが発生した場合はスキップ
                    pass

                return "\n".join(formatted_messages) if formatted_messages else None

            # ユーザーメッセージ（ツール結果）
            if hasattr(message, 'content') and isinstance(message.content, list):
                try:
                    for content_item in message.content:
                        if isinstance(content_item, dict) and content_item.get('type') == 'tool_result':
                            result_content = content_item.get('content', '')
                            if len(str(result_content)) > 200:
                                return f"[green]✅ ツール実行完了 ({agent.name})[/green] [dim]({len(str(result_content))}文字の結果)[/dim]"
                            else:
                                return f"[green]✅ ツール実行完了 ({agent.name}):[/green] [dim]{str(result_content)[:100]}...[/dim]"
                except (AttributeError, TypeError, KeyError):
                    pass

            return None

        except Exception as e:
            console.print(f"[dim]メッセージフォーマットエラー: {str(e)}[/dim]")
            return None
