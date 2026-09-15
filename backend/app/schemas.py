from datetime import date as date_type, datetime
from typing import Optional
from pydantic import BaseModel


class QuestBase(BaseModel):
    day_type: str
    label: str
    time_label: str
    stat: str


class QuestCreate(QuestBase):
    pass


class QuestUpdate(BaseModel):
    label: Optional[str] = None
    time_label: Optional[str] = None
    stat: Optional[str] = None


class QuestOut(QuestBase):
    id: int
    sort_order: int

    class Config:
        from_attributes = True


class CompletionToggle(BaseModel):
    quest_id: int
    date: date_type
    completed: bool


class ShieldRequest(BaseModel):
    date: date_type


class SettingUpdate(BaseModel):
    key: str
    value: str


class MilestoneOut(BaseModel):
    id: str
    title: str
    desc: str
    reward: int
    achieved: bool
    achieved_at: Optional[datetime] = None


class GlobalStats(BaseModel):
    total_xp: int
    level: int
    rank: str
    coins: int
    current_streak: int
    longest_streak: int
    total_completed: int
    stat_totals: dict
