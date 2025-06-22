"""Repository interfaces for multi-engineer system."""

from abc import ABC, abstractmethod
from typing import Optional, List
from .entities import DevelopmentTask, ExecutionResult


class ITaskRepository(ABC):
    """タスクリポジトリインターフェース"""
    
    @abstractmethod
    def save(self, task: DevelopmentTask) -> None:
        """タスクを保存"""
        pass
    
    @abstractmethod
    def find_by_id(self, task_id: str) -> Optional[DevelopmentTask]:
        """IDでタスクを検索"""
        pass
    
    @abstractmethod
    def find_all(self) -> List[DevelopmentTask]:
        """すべてのタスクを取得"""
        pass
    
    @abstractmethod
    def update_status(self, task_id: str, status: str) -> None:
        """タスクのステータスを更新"""
        pass


class IGitRepository(ABC):
    """Gitリポジトリインターフェース"""
    
    @abstractmethod
    def create_worktree(self, task_id: str, branch_name: str, base_branch: str) -> str:
        """worktreeを作成"""
        pass
    
    @abstractmethod
    def remove_worktree(self, task_id: str) -> None:
        """worktreeを削除"""
        pass
    
    @abstractmethod
    def commit_changes(self, worktree_path: str, message: str) -> bool:
        """変更をコミット"""
        pass
    
    @abstractmethod
    def merge_branch(self, branch_name: str) -> bool:
        """ブランチをマージ"""
        pass
    
    @abstractmethod
    def get_diff_stats(self, branch_name: str) -> str:
        """差分統計を取得"""
        pass