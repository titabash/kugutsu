"""Value objects for multi-engineer system."""

from enum import Enum
from dataclasses import dataclass


class AIRole(Enum):
    """AI の役割"""
    PRODUCT_OWNER = "product_owner"
    ENGINEER = "engineer"
    REVIEWER = "reviewer"


@dataclass(frozen=True)
class AIAgent:
    """AI エージェント"""
    role: AIRole
    name: str
    emoji: str
    color: str
    
    @classmethod
    def product_owner(cls) -> "AIAgent":
        return cls(
            role=AIRole.PRODUCT_OWNER,
            name="プロダクトオーナーAI",
            emoji="👔",
            color="blue"
        )
    
    @classmethod
    def engineer(cls) -> "AIAgent":
        return cls(
            role=AIRole.ENGINEER,
            name="AIエンジニア",
            emoji="👩‍💻",
            color="green"
        )
    
    @classmethod
    def reviewer(cls) -> "AIAgent":
        return cls(
            role=AIRole.REVIEWER,
            name="レビューワーAI",
            emoji="👨‍🔬",
            color="purple"
        )