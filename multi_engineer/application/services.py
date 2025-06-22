"""Application services for multi-engineer system."""

import subprocess
from typing import Optional
from rich.console import Console
from rich.panel import Panel
import anyio

from ..domain.entities import DevelopmentTask, TaskStatus, ExecutionResult
from ..domain.repositories import IGitRepository
from ..domain.value_objects import AIAgent
from ..infrastructure.claude_repository import ClaudeRepository

console = Console()


class DevelopmentTaskService:
    """開発タスクサービス"""
    
    def __init__(self, git_repository: IGitRepository, claude_repository: ClaudeRepository):
        self.git_repo = git_repository
        self.claude_repo = claude_repository
    
    async def execute_task_workflow(self, user_prompt: str, base_branch: str = "main", max_turns: int = 5) -> ExecutionResult:
        """プロダクトオーナーAI → AIエンジニアのワークフローを実行（セッション管理）"""
        
        # タスクIDを生成（セッションIDとして使用）
        import uuid
        session_id = str(uuid.uuid4())[:8]
        
        po_agent = AIAgent.product_owner()
        engineer_agent = AIAgent.engineer()
        
        console.print("\n" + "=" * 80)
        console.print(f"[bold blue]👔 {po_agent.name}による要求分析[/bold blue]")
        console.print(f"[dim]セッションID: {session_id}[/dim]")
        console.print("=" * 80)
        
        po_prompt = f"""要求: {user_prompt}

1行で具体的なファイル変更指示を出してください。
例: 「hello_cli/main.pyの217行目のHeyをHelloに変更してください」"""
        
        # Step 1: プロダクトオーナーAIの実行（セッション管理）
        try:
            async for message in self.claude_repo.execute_task(
                prompt=po_prompt,
                system_prompt="プロダクトオーナー。明確な指示を出す。",
                max_turns=3,
                working_directory=None
            ):
                if isinstance(message, str):
                    console.print(f"\n[bold blue]{po_agent.emoji} {po_agent.name}:[/bold blue] {message}")
                    
                    # TaskGroupエラーの場合、フォールバック指示を使用
                    if "SDK実行エラー" in message or "TaskGroup" in message:
                        # 元の要求からファイル変更指示を推測
                        if "Hello" in user_prompt and "Hey" in user_prompt:
                            engineer_instructions = "hello_cli/main.pyの217行目のHeyをHelloに変更してください"
                        else:
                            engineer_instructions = f"次の要求を実装してください: {user_prompt}"
                        console.print(f"[yellow]⚠️  フォールバック指示を使用: {engineer_instructions}[/yellow]")
                    else:
                        engineer_instructions = message.strip()
                    
                    # プロダクトオーナーAIのセッション状態を保存
                    self.claude_repo.save_session_state(session_id, "po", engineer_instructions)
                    break
        except ExceptionGroup as eg:
            console.print(f"[red]❌ プロダクトオーナーAI ExceptionGroup:[/red] {len(eg.exceptions)}個の例外")
            for i, exc in enumerate(eg.exceptions):
                console.print(f"[dim]例外{i+1}: {type(exc).__name__}: {str(exc)}[/dim]")
            return ExecutionResult(
                task_id="",
                success=False,
                message=f"プロダクトオーナーAIで例外グループエラーが発生しました（{len(eg.exceptions)}個の例外）"
            )
        except Exception as e:
            import traceback
            console.print(f"[red]❌ プロダクトオーナーAIエラー:[/red] {str(e)}")
            console.print(f"[dim]エラータイプ: {type(e).__name__}[/dim]")
            console.print(f"[dim]トレースバック:[/dim]")
            console.print(f"[dim]{traceback.format_exc()}[/dim]")
            return ExecutionResult(
                task_id="",
                success=False,
                message=f"プロダクトオーナーAIでエラーが発生しました: {str(e)}"
            )
        
        if not engineer_instructions.strip():
            return ExecutionResult(
                task_id=session_id,
                success=False,
                message="プロダクトオーナーAIから指示を取得できませんでした"
            )
        
        console.print(f"\n[bold blue]✅ {po_agent.emoji} {po_agent.name}による分析完了[/bold blue]")
        console.print(f"[dim]💤 プロダクトオーナーAI待機開始[/dim]")
        
        # Step 2: タスクを作成してworktreeで実行
        task = DevelopmentTask.create(prompt=engineer_instructions, base_branch=base_branch)
        task.id = session_id  # セッションIDをタスクIDとして使用
        
        console.print("\n" + "=" * 80)
        console.print(f"[bold green]👩‍💻 {engineer_agent.name}による実装開始[/bold green]")
        console.print("=" * 80)
        console.print(f"📋 タスクID: [bold yellow]{task.id}[/bold yellow]")
        
        # worktreeを作成
        worktree_path = self.git_repo.create_worktree(
            task.id, 
            task.branch_name, 
            task.base_branch
        )
        task.worktree_path = worktree_path
        task.status = TaskStatus.IN_PROGRESS
        
        console.print(f"📁 作業ディレクトリ: [bold green]{worktree_path}[/bold green]")
        console.print(f"🌿 ブランチ: [bold cyan]{task.branch_name}[/bold cyan]")
        
        # 作業ディレクトリを含むより具体的な指示
        engineer_prompt = f"""{engineer_instructions}

作業ディレクトリ: {worktree_path}
必ず実際にファイルを編集してください。Readツールでファイルを確認し、Editツールで変更してください。"""
        
        console.print(f"[dim]エンジニア指示: {engineer_instructions}[/dim]")
        console.print(f"[dim]作業ディレクトリ: {worktree_path}[/dim]")
        
        # Step 3: エンジニアAIの実行（セッション管理）
        engineer_result = ""
        engineer_success = False
        engineer_error = None
        
        try:
            async for message in self.claude_repo.execute_task(
                prompt=engineer_prompt,
                system_prompt="AIエンジニア。worktreeで高品質実装。",
                max_turns=max_turns,
                working_directory=worktree_path
            ):
                if isinstance(message, str):
                    console.print(f"\n[bold green]{engineer_agent.emoji} {engineer_agent.name}:[/bold green] {message}")
                    engineer_result = message.strip()
                    
                    # エラーチェック
                    if "エラー" in message or "実行できませんでした" in message:
                        engineer_success = False
                    else:
                        engineer_success = True
                        # エンジニアAIのセッション状態を保存
                        self.claude_repo.save_session_state(session_id, "engineer", engineer_result)
                    break
                        
        except ExceptionGroup as eg:
            engineer_error = f"ExceptionGroup: {len(eg.exceptions)}個の例外"
            console.print(f"[red]❌ AIエンジニア ExceptionGroup:[/red] {len(eg.exceptions)}個の例外")
            for i, exc in enumerate(eg.exceptions):
                console.print(f"[dim]例外{i+1}: {type(exc).__name__}: {str(exc)}[/dim]")
                if "CLIJSONDecodeError" in str(exc):
                    engineer_error = f"Claude Code SDK通信エラー: {str(exc)}"
            engineer_success = False
                
        except Exception as eng_error:
            engineer_error = str(eng_error)
            console.print(f"[red]❌ AIエンジニアエラー:[/red] {str(eng_error)}")
            engineer_success = False
            
        # エラーが発生した場合は早期終了
        if not engineer_success or engineer_error:
            task.status = TaskStatus.FAILED
            console.print(f"\n[bold red]❌ {engineer_agent.emoji} {engineer_agent.name}が失敗しました[/bold red]")
            if engineer_error:
                console.print(f"[red]エラー詳細: {engineer_error}[/red]")
                
                result = ExecutionResult(
                    task_id=task.id,
                    success=False,
                    message=f"AIエンジニアが失敗しました: {engineer_error or '不明なエラー'}",
                    error=Exception(engineer_error or "AIエンジニアが正常に実行されませんでした")
                )
                result.task = task
                return result
        
        # Step 4: エンジニアAI成功時の処理
        console.print(f"\n[bold green]✅ {engineer_agent.emoji} {engineer_agent.name}による実装完了[/bold green]")
        console.print(f"[dim]💤 エンジニアAI待機開始[/dim]")
        
        # 変更をコミット
        console.print("\n[bold cyan]📝 変更内容を確認中...[/bold cyan]")
        
        diff_result = subprocess.run([
            "git", "diff", "--stat"
        ], cwd=worktree_path, capture_output=True, text=True)
        
        if diff_result.stdout:
            console.print(f"[dim]{diff_result.stdout}[/dim]")
            
            # 変更をコミット
            commit_msg = f"feat: {user_prompt[:50]}..." if len(user_prompt) > 50 else f"feat: {user_prompt}"
            if self.git_repo.commit_changes(worktree_path, commit_msg):
                console.print(f"[green]✅ 変更をコミットしました[/green]")
                task.status = TaskStatus.COMPLETED
                
                # 変更されたファイルのリストを取得
                changed_files = diff_result.stdout.strip().split('\n')
                
                # タスクオブジェクトを結果に含める
                result = ExecutionResult(
                    task_id=task.id,
                    success=True,
                    message="ワークフローが正常に完了しました",
                    changed_files=changed_files
                )
                result.task = task  # タスクオブジェクトを追加
                return result
            else:
                task.status = TaskStatus.FAILED
                result = ExecutionResult(
                    task_id=task.id,
                    success=False,
                    message="コミットに失敗しました"
                )
                result.task = task
                return result
        else:
            console.print(f"[yellow]⚠️  変更がありませんでした[/yellow]")
            task.status = TaskStatus.COMPLETED
            result = ExecutionResult(
                task_id=task.id,
                success=True,
                message="変更なしで完了"
            )
            result.task = task
            return result
    
    def review_and_merge(self, task: DevelopmentTask) -> ExecutionResult:
        """変更をレビューしてマージ"""
        try:
            # 変更の差分を確認
            console.print("\n[bold cyan]🔍 変更内容をレビュー中...[/bold cyan]")
            
            diff_stats = self.git_repo.get_diff_stats(task.branch_name)
            if diff_stats:
                console.print("[dim]変更ファイル:[/dim]")
                console.print(f"[dim]{diff_stats}[/dim]")
            else:
                console.print(f"[yellow]⚠️  変更が見つかりませんでした[/yellow]")
            
            # マージ実行
            if self.git_repo.merge_branch(task.branch_name):
                # worktreeを削除
                self.git_repo.remove_worktree(task.id)
                task.status = TaskStatus.MERGED
                
                return ExecutionResult(
                    task_id=task.id,
                    success=True,
                    message="正常にマージされました"
                )
            else:
                return ExecutionResult(
                    task_id=task.id,
                    success=False,
                    message="マージに失敗しました"
                )
                
        except Exception as e:
            console.print(f"[red]❌ エラー: {e}[/red]")
            return ExecutionResult(
                task_id=task.id,
                success=False,
                message=str(e),
                error=e
            )