"""Domain entities for multi-engineer system."""

from dataclasses import dataclass
from typing import Optional
from enum import Enum
import uuid


class TaskStatus(Enum):
    """タスクのステータス"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    MERGED = "merged"


@dataclass
class DevelopmentTask:
    """開発タスクエンティティ"""
    id: str
    prompt: str
    branch_name: str
    worktree_path: Optional[str] = None
    status: TaskStatus = TaskStatus.PENDING
    base_branch: str = "main"
    
    @classmethod
    def create(cls, prompt: str, base_branch: str = "main") -> "DevelopmentTask":
        """新しいタスクを作成"""
        task_id = str(uuid.uuid4())[:8]
        return cls(
            id=task_id,
            prompt=prompt,
            branch_name=f"feature/task-{task_id}",
            base_branch=base_branch
        )


@dataclass
class ExecutionResult:
    """タスク実行結果"""
    task_id: str
    success: bool
    message: str
    changed_files: list[str] = None
    error: Optional[Exception] = None
    
    def __post_init__(self):
        if self.changed_files is None:
            self.changed_files = []