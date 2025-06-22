"""CLI interface for multi-engineer system."""

from typing import Annotated, Optional
import subprocess
import typer
from rich.console import Console
from rich.panel import Panel
import asyncio

from ..domain.entities import DevelopmentTask
from ..infrastructure.git_repository import GitRepository
from ..infrastructure.claude_repository import ClaudeRepository
from ..application.services import DevelopmentTaskService

console = Console()


def main(
    prompt: Annotated[
        str,
        typer.Argument(help="開発タスクの内容"),
    ],
    base_branch: Annotated[
        Optional[str],
        typer.Option(
            "--base-branch",
            "-b",
            help="ベースブランチ（デフォルト: 現在のブランチ）",
            rich_help_panel="Git Options",
        ),
    ] = None,
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
    auto_merge: Annotated[
        bool,
        typer.Option(
            "--auto-merge",
            help="自動的にマージ",
            rich_help_panel="Git Options",
        ),
    ] = False,
    no_worktree: Annotated[
        bool,
        typer.Option(
            "--no-worktree",
            help="Worktreeを使わずに現在のディレクトリで実行",
            rich_help_panel="Git Options",
        ),
    ] = False,
) -> None:
    """
    AIエンジニアに開発タスクを実行させます。
    
    独立したgit worktreeで作業を行い、完了後に変更をマージできます。
    """
    # ヘッダー表示
    console.print()
    console.print(Panel(
        f"[bold white]🤖 AI並列開発システム[/bold white]\n" +
        f"タスク: [cyan]{prompt}[/cyan]",
        title="[bold blue]Multi-Engineer[/bold blue]",
        border_style="blue"
    ))
    
    # リポジトリとサービスを初期化
    git_repo = GitRepository()
    claude_repo = ClaudeRepository()
    service = DevelopmentTaskService(git_repo, claude_repo)
    
    # 現在のブランチを取得（base_branchが指定されていない場合）
    if base_branch is None:
        try:
            result = subprocess.run(
                ["git", "branch", "--show-current"],
                capture_output=True,
                text=True,
                check=True
            )
            base_branch = result.stdout.strip()
            if not base_branch:
                # detached HEADの場合はmainを使用
                base_branch = "main"
                console.print(f"[yellow]⚠️  Detached HEAD状態のため、mainブランチをベースとして使用します[/yellow]")
        except subprocess.CalledProcessError:
            base_branch = "main"
            console.print(f"[yellow]⚠️  現在のブランチを取得できないため、mainブランチをベースとして使用します[/yellow]")
    
    console.print(f"\n[bold cyan]🌿 Git Worktreeモード[/bold cyan]")
    console.print(f"🎯 ベースブランチ: [bold yellow]{base_branch}[/bold yellow]")
    
    async def run_task():
        # ワークフローを実行
        result = await service.execute_task_workflow(prompt, base_branch, max_turns)
        
        console.print("\n" + "=" * 80)
        console.print("[bold purple]🎯 全工程完了[/bold purple]")
        console.print("=" * 80)
        
        if result.success and hasattr(result, 'task'):
            task = result.task
            # 作業完了レポート
            console.print()
            console.print(Panel(
                f"[bold white]📊 作業完了レポート[/bold white]\n" +
                f"👔 プロダクトオーナーAI: 要求分析・指示作成完了\n" +
                f"👩‍💻 AIエンジニア: 実装・テスト完了\n" +
                f"ブランチ: [cyan]{task.branch_name}[/cyan]\n" +
                f"Worktree: [green]{task.worktree_path}[/green]",
                title="[bold yellow]🎯 結果[/bold yellow]",
                border_style="yellow"
            ))
            
            # マージ処理
            if auto_merge:
                console.print(f"\n[bold cyan]🔄 自動マージモード[/bold cyan]")
                merge_result = service.review_and_merge(task)
                
                if merge_result.success:
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
                        f"{merge_result.message}",
                        title="[bold red]エラー[/bold red]",
                        border_style="red"
                    ))
            else:
                console.print(f"\n[bold blue]🤔 次のアクション[/bold blue]")
                console.print(f"手動マージコマンド: [dim]git checkout main && git merge {task.branch_name}[/dim]")
                
                if typer.confirm("\n変更をメインブランチにマージしますか？"):
                    merge_result = service.review_and_merge(task)
                    
                    if merge_result.success:
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
                        f"ブランチ: [cyan]{task.branch_name}[/cyan]\n" +
                        f"Worktree: [green]{task.worktree_path}[/green]\n" +
                        f"手動マージ: [cyan]git checkout main && git merge {task.branch_name}[/cyan]\n" +
                        f"削除: [cyan]git worktree remove {task.worktree_path}[/cyan]",
                        title="[bold yellow]手動操作が必要[/bold yellow]",
                        border_style="yellow"
                    ))
        else:
            # 失敗した場合のレポート
            console.print()
            failure_details = f"[bold red]❌ タスク実行に失敗しました[/bold red]\n"
            
            if hasattr(result, 'task') and result.task:
                task = result.task
                failure_details += f"📋 タスクID: [cyan]{task.id}[/cyan]\n"
                failure_details += f"🌿 ブランチ: [cyan]{task.branch_name}[/cyan]\n"
                failure_details += f"📁 Worktree: [green]{task.worktree_path}[/green]\n"
                failure_details += f"⚠️  ステータス: [red]{task.status.value}[/red]\n"
            
            failure_details += f"\n[bold]エラー詳細:[/bold]\n{result.message}"
            
            console.print(Panel(
                failure_details,
                title="[bold red]❌ 実行失敗[/bold red]",
                border_style="red"
            ))
            
            # Worktreeの手動クリーンアップ手順を提示
            if hasattr(result, 'task') and result.task and result.task.worktree_path:
                console.print()
                console.print(Panel(
                    f"[bold yellow]🧹 手動クリーンアップが必要[/bold yellow]\n" +
                    f"Worktreeが残っています: [green]{result.task.worktree_path}[/green]\n\n" +
                    f"[bold]クリーンアップコマンド:[/bold]\n" +
                    f"• Worktree削除: [cyan]git worktree remove {result.task.worktree_path} --force[/cyan]\n" +
                    f"• ブランチ削除: [cyan]git branch -D {result.task.branch_name}[/cyan]",
                    title="[bold yellow]⚠️  クリーンアップ[/bold yellow]",
                    border_style="yellow"
                ))
    
    try:
        asyncio.run(run_task())
    except KeyboardInterrupt:
        console.print()
        console.print(Panel(
            f"[bold yellow]⚠️  処理が中断されました[/bold yellow]\n" +
            f"タスクID: [cyan]{task.id}[/cyan]",
            title="[bold yellow]中断[/bold yellow]",
            border_style="yellow"
        ))
        raise typer.Exit(1)
    except Exception as e:
        console.print()
        console.print(Panel(
            f"[bold red]❌ 予期しないエラー[/bold red]\n" +
            f"{str(e)}",
            title="[bold red]エラー[/bold red]",
            border_style="red"
        ))
        raise typer.Exit(1)


app = typer.Typer()
app.command()(main)

if __name__ == "__main__":
    app()