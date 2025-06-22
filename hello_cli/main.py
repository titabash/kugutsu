#!/usr/bin/env python3
"""
Modern Python CLI tool using Typer.

This module provides a command-line interface for the hello-cli tool.
"""

import sys
import subprocess
import uuid
from typing import Annotated, Optional
from pathlib import Path
import asyncio

import typer
import anyio
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
from rich.live import Live
from rich.layout import Layout
from rich.status import Status

from hello_cli import __version__

try:
    from claude_code_sdk import query, ClaudeCodeOptions
    CLAUDE_SDK_AVAILABLE = True
except ImportError:
    CLAUDE_SDK_AVAILABLE = False

# Create Typer app instance
app = typer.Typer(
    name="hello-cli",
    help="A modern Python CLI tool example 🚀",
    add_completion=True,
    rich_markup_mode="rich",
)

# Create Rich console for beautiful output
console = Console()


class GitWorktreeManager:
    """Git worktreeの管理を行うクラス"""
    
    def __init__(self, base_repo_path: str = "."):
        self.base_repo_path = Path(base_repo_path)
        self.worktree_base_path = self.base_repo_path / "worktrees"
    
    def create_worktree(self, task_id: str, base_branch: str = "main") -> tuple[str, str]:
        """タスク用のworktreeを作成
        
        Returns:
            tuple[str, str]: (worktree_path, branch_name)
        """
        branch_name = f"feature/task-{task_id}"
        worktree_path = self.worktree_base_path / f"task-{task_id}"
        
        # worktreesディレクトリを作成
        self.worktree_base_path.mkdir(exist_ok=True)
        
        # 既存のworktreeがある場合は削除
        if worktree_path.exists():
            self.remove_worktree(task_id)
        
        # 新しいブランチを作成してworktreeを作成
        cmd = [
            "git", "worktree", "add", 
            "-b", branch_name,
            str(worktree_path),
            base_branch
        ]
        
        with console.status(f"[cyan]Worktreeを作成中...", spinner="dots"):
            result = subprocess.run(
                cmd, 
                cwd=self.base_repo_path,
                capture_output=True,
                text=True
            )
        
        if result.returncode != 0:
            raise Exception(f"Worktree作成エラー: {result.stderr}")
        
        console.print(f"[green]✓[/green] Worktree作成完了: [bold cyan]{branch_name}[/bold cyan]")
        return str(worktree_path), branch_name
    
    def remove_worktree(self, task_id: str) -> None:
        """worktreeを削除"""
        worktree_path = self.worktree_base_path / f"task-{task_id}"
        
        if worktree_path.exists():
            with console.status(f"[yellow]Worktreeを削除中...", spinner="dots"):
                subprocess.run([
                    "git", "worktree", "remove", 
                    str(worktree_path), "--force"
                ], cwd=self.base_repo_path)
            console.print(f"[green]✓[/green] Worktree削除完了")
    
    def merge_and_cleanup(self, task_id: str, branch_name: str) -> bool:
        """変更をメインブランチにマージしてクリーンアップ
        
        Returns:
            bool: マージが成功したかどうか
        """
        try:
            worktree_path = self.worktree_base_path / f"task-{task_id}"
            
            # メインブランチに戻る前に、変更の差分を確認
            console.print("\n[bold cyan]🔍 変更内容をレビュー中...[/bold cyan]")
            
            # 変更の差分を表示
            diff_result = subprocess.run([
                "git", "diff", f"main...{branch_name}", "--stat"
            ], cwd=self.base_repo_path, capture_output=True, text=True)
            
            if diff_result.stdout:
                console.print("[dim]変更ファイル:[/dim]")
                console.print(f"[dim]{diff_result.stdout}[/dim]")
                
                # 詳細な差分を確認（オプション）
                if typer.confirm("\n詳細な差分を確認しますか？", default=False):
                    detailed_diff = subprocess.run([
                        "git", "diff", f"main...{branch_name}"
                    ], cwd=self.base_repo_path, capture_output=True, text=True)
                    console.print(f"[dim]{detailed_diff.stdout[:2000]}...[/dim]" if len(detailed_diff.stdout) > 2000 else f"[dim]{detailed_diff.stdout}[/dim]")
            else:
                console.print(f"[yellow]⚠️  変更が見つかりませんでした[/yellow]")
            
            # メインブランチに戻る
            with console.status("[cyan]メインブランチに切り替え中...", spinner="dots"):
                subprocess.run(["git", "checkout", "main"], cwd=self.base_repo_path, check=True)
            
            # 変更をマージ
            with console.status(f"[cyan]ブランチをマージ中: {branch_name}", spinner="dots"):
                result = subprocess.run([
                    "git", "merge", branch_name, "--no-ff", 
                    "-m", f"Merge {branch_name}: AI-generated changes"
                ], cwd=self.base_repo_path, capture_output=True, text=True)
            
            if result.returncode != 0:
                console.print(f"[red]❌[/red] マージに失敗: {result.stderr}")
                return False
            
            console.print(f"[green]✓[/green] マージ完了: [bold cyan]{branch_name}[/bold cyan]")
            
            # worktreeを削除（ブランチ削除の前に実行）
            self.remove_worktree(task_id)
            
            # ブランチを削除
            with console.status("[yellow]ブランチを削除中...", spinner="dots"):
                subprocess.run(["git", "branch", "-d", branch_name], cwd=self.base_repo_path)
            console.print(f"[green]✓[/green] ブランチ削除完了: [bold cyan]{branch_name}[/bold cyan]")
            
            return True
            
        except subprocess.CalledProcessError as e:
            console.print(f"[red]エラー:[/red] Git操作に失敗: {e}")
            return False


def version_callback(value: bool) -> None:
    """Display version information."""
    if value:
        console.print(f"hello-cli version: [bold blue]{__version__}[/bold blue]")
        raise typer.Exit()


@app.command()
def hello(
    name: Annotated[
        Optional[str],
        typer.Argument(help="Name to greet. If not provided, greets the world."),
    ] = None,
    count: Annotated[
        int,
        typer.Option(
            "--count",
            "-c",
            help="Number of greetings to display",
            min=1,
            max=100,
            rich_help_panel="Customization Options",
        ),
    ] = 1,
    uppercase: Annotated[
        bool,
        typer.Option(
            "--uppercase",
            "-u",
            help="Convert greeting to uppercase",
            rich_help_panel="Customization Options",
        ),
    ] = False,
    style: Annotated[
        str,
        typer.Option(
            "--style",
            "-s",
            help="Style of the greeting",
            rich_help_panel="Customization Options",
        ),
    ] = "simple",
) -> None:
    """
    Display a greeting message.

    This command shows a friendly greeting message with various customization options.
    """
    # Determine who to greet
    target = name or "World"

    # Create the greeting message
    message = f"Hello {target}!"

    if uppercase:
        message = message.upper()

    # Display greetings based on style
    if style == "fancy":
        for i in range(count):
            panel = Panel(
                Text(message, style="bold magenta"),
                title=f"Greeting #{i + 1}",
                border_style="bright_blue",
                padding=(1, 2),
            )
            console.print(panel)
    elif style == "table":
        table = Table(title="Greetings")
        table.add_column("Number", style="cyan", no_wrap=True)
        table.add_column("Message", style="magenta")

        for i in range(count):
            table.add_row(str(i + 1), message)

        console.print(table)
    else:
        # Simple style (default)
        for _ in range(count):
            console.print(f"[bold green]{message}[/bold green]")


@app.command()
def info() -> None:
    """Display information about this CLI tool."""
    info_table = Table(title="CLI Tool Information")
    info_table.add_column("Property", style="cyan", no_wrap=True)
    info_table.add_column("Value", style="magenta")

    info_table.add_row("Name", "hello-cli")
    info_table.add_row("Version", __version__)
    info_table.add_row("Description", "A modern Python CLI tool example")
    info_table.add_row("Framework", "Typer + Rich")
    info_table.add_row(
        "Python",
        f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
    )

    console.print(info_table)


@app.command()
def cleanup_worktrees() -> None:
    """
    残ったworktreeを確認・削除します。
    """
    git_manager = GitWorktreeManager()
    
    try:
        # 現在のworktreeをリスト
        result = subprocess.run([
            "git", "worktree", "list"
        ], cwd=git_manager.base_repo_path, capture_output=True, text=True)
        
        if result.returncode != 0:
            console.print("[red]❌ worktreeリストの取得に失敗しました[/red]")
            return
        
        worktrees = result.stdout.strip().split('\n')
        task_worktrees = [w for w in worktrees if 'task-' in w]
        
        if not task_worktrees:
            console.print("[green]✅ 残ったworktreeはありません[/green]")
            return
        
        console.print(f"[yellow]⚠️  {len(task_worktrees)}個のworktreeが見つかりました:[/yellow]")
        for worktree in task_worktrees:
            console.print(f"  - {worktree}")
        
        if typer.confirm("\nすべて削除しますか？"):
            for worktree in task_worktrees:
                parts = worktree.split()
                if len(parts) >= 1:
                    path = parts[0]
                    console.print(f"削除中: {path}")
                    subprocess.run([
                        "git", "worktree", "remove", path, "--force"
                    ], cwd=git_manager.base_repo_path)
            console.print("[green]✅ すべてのworktreeを削除しました[/green]")
        
    except Exception as e:
        console.print(f"[red]❌ エラー: {e}[/red]")


@app.command()
def claude(
    prompt: Annotated[
        str,
        typer.Argument(help="プロンプトメッセージを指定"),
    ],
    no_worktree: Annotated[
        bool,
        typer.Option(
            "--no-worktree",
            help="git worktreeを使用せずに現在のディレクトリで実行",
            rich_help_panel="Worktree Options",
        ),
    ] = False,
    base_branch: Annotated[
        str,
        typer.Option(
            "--base-branch",
            help="worktree作成時のベースブランチ",
            rich_help_panel="Worktree Options",
        ),
    ] = "main",
    auto_merge: Annotated[
        bool,
        typer.Option(
            "--auto-merge",
            help="作業完了後に自動的にメインブランチにマージ",
            rich_help_panel="Worktree Options",
        ),
    ] = False,
    max_turns: Annotated[
        int,
        typer.Option(
            "--max-turns",
            "-m",
            help="最大ターン数",
            min=1,
            max=50,
            rich_help_panel="Claude Options",
        ),
    ] = 5,
    system_prompt: Annotated[
        Optional[str],
        typer.Option(
            "--system",
            "-s",
            help="システムプロンプト",
            rich_help_panel="Claude Options",
        ),
    ] = None,
) -> None:
    """
    Claude Code SDKを使用してプロンプトを実行します。
    
    このコマンドはClaude Code SDKを使用してプロンプトを実行し、
    結果をリアルタイムで表示します。デフォルトで独立したgit worktreeで
    作業を行い、完了後に変更をマージできます。--no-worktreeオプションで
    現在のディレクトリでの実行に変更できます。
    """
    if not CLAUDE_SDK_AVAILABLE:
        console.print(
            "[bold red]Error:[/bold red] claude-code-sdk が利用できません。"
            "\n[yellow]インストール方法:[/yellow]"
            "\n  uv add claude-code-sdk"
            "\n  npm install -g @anthropic-ai/claude-code"
        )
        raise typer.Exit(1)
    
    # worktreeを使用するかどうかを決定
    use_worktree = not no_worktree
    
    # タスクIDを生成
    task_id = str(uuid.uuid4())[:8]
    git_manager = GitWorktreeManager()
    worktree_path = None
    branch_name = None
    
    async def run_claude():
        nonlocal worktree_path, branch_name
        
        try:
            # ヘッダー表示
            console.print()
            console.print(Panel(
                f"[bold white]🤖 Claude Code 実行[/bold white]\n" +
                f"プロンプト: [cyan]{prompt}[/cyan]",
                title="[bold blue]AI エンジニア[/bold blue]",
                border_style="blue"
            ))
            
            # worktreeを使用する場合
            if use_worktree:
                console.print(f"\n[bold cyan]🌿 Git Worktreeモード[/bold cyan]")
                console.print(f"📋 タスクID: [bold yellow]{task_id}[/bold yellow]")
                
                # worktreeを作成
                worktree_path, branch_name = git_manager.create_worktree(task_id, base_branch)
                working_directory = worktree_path
                
                console.print(f"📁 作業ディレクトリ: [bold green]{working_directory}[/bold green]")
                console.print(f"🌿 ブランチ: [bold cyan]{branch_name}[/bold cyan]")
            else:
                working_directory = None
                console.print(f"\n📁 作業ディレクトリ: [bold green]現在のディレクトリ[/bold green]")
            
            console.print(f"🔄 最大ターン数: [bold yellow]{max_turns}[/bold yellow]")
            
            if use_worktree:
                # worktree内で独立したClaude Codeを実行
                console.print("\n" + "=" * 60)
                console.print("[bold white]🚀 Worktree内でClaude Code実行[/bold white]")
                console.print("=" * 60)
                
                # worktree内で別のClaude Codeプロセスを起動
                worktree_prompt = f"""
                作業ディレクトリ: {working_directory}
                タスク: {prompt}
                
                以下の手順で開発を進めてください：
                1. 既存のコードベースを確認
                2. 要求された変更を実装
                3. テストを実行して動作確認
                4. 変更内容をgit addで準備（コミットはしないでください）
                
                注意: この作業はgit worktreeで行われているため、メインブランチには影響しません。
                """
                
                # サブプロセスとしてClaude Codeを実行
                worktree_options = ClaudeCodeOptions(
                    system_prompt="あなたは独立したgit worktreeで作業するAIエンジニアです。与えられたタスクを完了してください。",
                    max_turns=max_turns,
                    allowed_tools=["Read", "Write", "Bash", "Glob", "Grep", "Edit", "MultiEdit"],
                    cwd=working_directory
                )
                
                console.print(f"\n[bold cyan]🤖 Worktree AIエンジニア起動[/bold cyan]")
                console.print(f"[dim]作業内容: {prompt}[/dim]\n")
                
                # worktree内でのClaude実行
                async for message in query(prompt=worktree_prompt, options=worktree_options):
                    try:
                        if hasattr(message, 'subtype') and message.subtype == 'init':
                            console.print("[dim]🔧 Worktree AI初期化完了[/dim]")
                            continue
                        
                        if hasattr(message, 'content'):
                            for content_item in message.content:
                                if hasattr(content_item, 'text'):
                                    console.print(f"\n[bold green]🌿 Worktree AI:[/bold green] {content_item.text}")
                                elif hasattr(content_item, 'name'):
                                    tool_name = content_item.name
                                    console.print(f"\n[yellow]🔧 ツール実行:[/yellow] [cyan]{tool_name}[/cyan]")
                                    if hasattr(content_item, 'input') and content_item.input:
                                        if 'file_path' in content_item.input:
                                            console.print(f"   📁 ファイル: [green]{content_item.input['file_path']}[/green]")
                                        if 'old_string' in content_item.input and 'new_string' in content_item.input:
                                            console.print(f"   ✏️  編集操作を実行中...")
                    except Exception as msg_error:
                        console.print(f"[red]Worktreeメッセージエラー:[/red] {msg_error}")
                
                console.print("\n[green]✅ Worktree AI作業完了[/green]")
                
                # worktreeでの変更をコミット
                console.print("\n[bold cyan]📝 変更内容を確認中...[/bold cyan]")
                
                # 変更内容を表示
                diff_result = subprocess.run([
                    "git", "diff", "--stat"
                ], cwd=working_directory, capture_output=True, text=True)
                
                if diff_result.stdout:
                    console.print(f"[dim]{diff_result.stdout}[/dim]")
                    
                    # 変更をステージング
                    subprocess.run(["git", "add", "-A"], cwd=working_directory, check=True)
                    
                    # 変更をコミット
                    commit_msg = f"feat: {prompt[:50]}..." if len(prompt) > 50 else f"feat: {prompt}"
                    subprocess.run([
                        "git", "commit", "-m", commit_msg
                    ], cwd=working_directory, check=True)
                    console.print(f"[green]✅ 変更をコミットしました[/green]")
                else:
                    console.print(f"[yellow]⚠️  変更がありませんでした[/yellow]")
                
            else:
                # 通常モード（現在のディレクトリで実行）
                options = ClaudeCodeOptions(
                    system_prompt=system_prompt or "あなたは経験豊富なソフトウェアエンジニアです。",
                    max_turns=max_turns,
                    allowed_tools=["Read", "Write", "Bash", "Glob", "Grep", "Edit"],
                )
                
                console.print("\n" + "=" * 60)
                console.print("[bold white]🚀 Claude実行開始[/bold white]")
                console.print("=" * 60)
                
                async for message in query(prompt=prompt, options=options):
                    try:
                        if hasattr(message, 'subtype') and message.subtype == 'init':
                            console.print("[dim]🔧 Claude初期化完了[/dim]")
                            continue
                        
                        if hasattr(message, 'content'):
                            for content_item in message.content:
                                if hasattr(content_item, 'text'):
                                    console.print(f"\n[bold blue]💭 Claude:[/bold blue] {content_item.text}")
                                elif hasattr(content_item, 'name'):
                                    tool_name = content_item.name
                                    console.print(f"\n[yellow]🔧 ツール実行:[/yellow] [cyan]{tool_name}[/cyan]")
                                    if hasattr(content_item, 'input') and content_item.input:
                                        if 'file_path' in content_item.input:
                                            console.print(f"   📁 ファイル: [green]{content_item.input['file_path']}[/green]")
                                        if 'old_string' in content_item.input and 'new_string' in content_item.input:
                                            console.print(f"   ✏️  編集操作を実行中...")
                    except Exception as msg_error:
                        console.print(f"[red]メッセージ処理エラー:[/red] {msg_error}")
            
            console.print("\n" + "=" * 60)
            console.print("[bold green]✅ Claude実行完了[/bold green]")
            console.print("=" * 60)
            
        except Exception as e:
            console.print(f"\n[bold red]❌ エラー:[/bold red] {str(e)}")
            console.print(f"[dim]エラータイプ: {type(e).__name__}[/dim]")
            # TaskGroupのエラーの場合、より詳細な情報を表示
            if hasattr(e, '__cause__') and e.__cause__:
                console.print(f"[dim]原因: {e.__cause__}[/dim]")
            return  # typer.Exit(1)の代わりにreturnを使用
    
    try:
        # 非同期関数を実行
        anyio.run(run_claude)
    except Exception as outer_error:
        console.print(f"\n[bold red]❌ 実行エラー:[/bold red] {str(outer_error)}")
        console.print(f"[dim]エラータイプ: {type(outer_error).__name__}[/dim]")
        # エラーが発生してもworktree後処理は実行する
    
    # worktreeを使用した場合の後処理（エラーに関係なく実行）
    if use_worktree and worktree_path and branch_name:
        console.print()
        console.print(Panel(
            f"[bold white]📊 作業完了レポート[/bold white]\n" +
            f"ブランチ: [cyan]{branch_name}[/cyan]\n" +
            f"Worktree: [green]{worktree_path}[/green]",
            title="[bold yellow]🎯 結果[/bold yellow]",
            border_style="yellow"
        ))
        
        if auto_merge:
            console.print(f"\n[bold cyan]🔄 自動マージモード[/bold cyan]")
            success = git_manager.merge_and_cleanup(task_id, branch_name)
            if success:
                console.print()
                console.print(Panel(
                    "[bold green]✅ 変更をメインブランチに統合しました[/bold green]",
                    title="[bold green]完了[/bold green]",
                    border_style="green"
                ))
            else:
                console.print()
                console.print(Panel(
                    f"[bold red]❌ マージに失敗しました[/bold red]\n" +
                    f"ブランチ: [cyan]{branch_name}[/cyan]\n" +
                    f"手動で確認してください",
                    title="[bold red]エラー[/bold red]",
                    border_style="red"
                ))
        else:
            console.print(f"\n[bold blue]🤔 次のアクション[/bold blue]")
            console.print(f"手動マージコマンド: [dim]git checkout main && git merge {branch_name}[/dim]")
            
            # ユーザーに確認
            try:
                if typer.confirm("\n変更をメインブランチにマージしますか？"):
                    success = git_manager.merge_and_cleanup(task_id, branch_name)
                    if success:
                        console.print()
                        console.print(Panel(
                            "[bold green]✅ 変更をメインブランチに統合しました[/bold green]",
                            title="[bold green]完了[/bold green]",
                            border_style="green"
                        ))
                    else:
                        console.print()
                        console.print(Panel(
                            "[bold red]❌ マージに失敗しました[/bold red]",
                            title="[bold red]エラー[/bold red]",
                            border_style="red"
                        ))
                else:
                    console.print()
                    console.print(Panel(
                        f"[bold yellow]⚠️  Worktreeが残っています[/bold yellow]\n" +
                        f"ブランチ: [cyan]{branch_name}[/cyan]\n" +
                        f"Worktree: [green]{worktree_path}[/green]\n" +
                        f"手動マージ: [cyan]git checkout main && git merge {branch_name}[/cyan]\n" +
                        f"削除: [cyan]git worktree remove {worktree_path}[/cyan]",
                        title="[bold yellow]手動操作が必要[/bold yellow]",
                        border_style="yellow"
                    ))
            except KeyboardInterrupt:
                console.print()
                console.print(Panel(
                    f"[bold yellow]⚠️  処理が中断されました[/bold yellow]\n" +
                    f"Worktreeが残っています: [cyan]{worktree_path}[/cyan]\n" +
                    f"削除: [cyan]git worktree remove {worktree_path} --force[/cyan]",
                    title="[bold yellow]中断[/bold yellow]",
                    border_style="yellow"
                ))
                raise typer.Exit(1)


@app.callback()
def main(
    version: Annotated[
        Optional[bool],
        typer.Option(
            "--version",
            "-v",
            callback=version_callback,
            is_eager=True,
            help="Show version and exit",
        ),
    ] = None,
) -> None:
    """
    A modern Python CLI tool with Claude Code SDK integration.

    This tool demonstrates modern Python CLI development practices including:
    - Type hints and annotations
    - Rich text formatting and styling
    - Comprehensive help system
    - Input validation
    - Multiple output formats
    - Claude Code SDK integration for AI-powered development
    - Git worktree integration for isolated development environments
    """
    # version変数を使用してPylance警告を回避
    if version is not None:
        pass


if __name__ == "__main__":
    app()
