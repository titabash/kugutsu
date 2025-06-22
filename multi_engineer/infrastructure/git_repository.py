"""Git repository implementation."""

import subprocess
from pathlib import Path
from typing import Optional
from rich.console import Console

from ..domain.repositories import IGitRepository

console = Console()


class GitRepository(IGitRepository):
    """Git操作の実装"""
    
    def __init__(self, base_repo_path: str = "."):
        self.base_repo_path = Path(base_repo_path)
        self.worktree_base_path = self.base_repo_path / "worktrees"
    
    def create_worktree(self, task_id: str, branch_name: str, base_branch: str) -> str:
        """worktreeを作成"""
        # パス長を短縮（JSONパースエラーを回避）
        short_id = task_id[:8] if len(task_id) > 8 else task_id
        worktree_path = self.worktree_base_path / f"t-{short_id}"
        
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
        return str(worktree_path)
    
    def remove_worktree(self, task_id: str) -> None:
        """worktreeを削除"""
        # パス長を短縮（create_worktreeと一致）
        short_id = task_id[:8] if len(task_id) > 8 else task_id
        worktree_path = self.worktree_base_path / f"t-{short_id}"
        
        if worktree_path.exists():
            with console.status(f"[yellow]Worktreeを削除中...", spinner="dots"):
                subprocess.run([
                    "git", "worktree", "remove", 
                    str(worktree_path), "--force"
                ], cwd=self.base_repo_path)
            console.print(f"[green]✓[/green] Worktree削除完了")
    
    def commit_changes(self, worktree_path: str, message: str) -> bool:
        """変更をコミット"""
        try:
            # 変更をステージング
            subprocess.run(["git", "add", "-A"], cwd=worktree_path, check=True)
            
            # 変更をコミット
            subprocess.run([
                "git", "commit", "-m", message
            ], cwd=worktree_path, check=True)
            
            return True
        except subprocess.CalledProcessError:
            return False
    
    def merge_branch(self, branch_name: str) -> bool:
        """ブランチをマージ"""
        try:
            # メインブランチに切り替え
            with console.status("[cyan]メインブランチに切り替え中...", spinner="dots"):
                subprocess.run(["git", "checkout", "main"], cwd=self.base_repo_path, check=True)
            
            # マージ
            with console.status(f"[cyan]ブランチをマージ中: {branch_name}", spinner="dots"):
                result = subprocess.run([
                    "git", "merge", branch_name, "--no-ff", 
                    "-m", f"Merge {branch_name}: AI-generated changes"
                ], cwd=self.base_repo_path, capture_output=True, text=True)
            
            if result.returncode != 0:
                console.print(f"[red]❌[/red] マージに失敗: {result.stderr}")
                return False
            
            console.print(f"[green]✓[/green] マージ完了: [bold cyan]{branch_name}[/bold cyan]")
            
            # ブランチを削除
            with console.status("[yellow]ブランチを削除中...", spinner="dots"):
                subprocess.run(["git", "branch", "-d", branch_name], cwd=self.base_repo_path)
            console.print(f"[green]✓[/green] ブランチ削除完了: [bold cyan]{branch_name}[/bold cyan]")
            
            return True
            
        except subprocess.CalledProcessError as e:
            console.print(f"[red]エラー:[/red] Git操作に失敗: {e}")
            return False
    
    def get_diff_stats(self, branch_name: str) -> str:
        """差分統計を取得"""
        result = subprocess.run([
            "git", "diff", f"main...{branch_name}", "--stat"
        ], cwd=self.base_repo_path, capture_output=True, text=True)
        
        return result.stdout