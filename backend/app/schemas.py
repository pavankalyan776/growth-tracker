import re
from datetime import date as date_type
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

DAY_TYPE_PATTERN = r"^(weekday|saturday|sunday)$"
STAT_PATTERN = r"^(STR|INT|PER|VIT|AGI)$"


def _clean_name(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    if len(value) < 2 or len(value) > 20:
        raise ValueError("Name must be 2 to 20 characters.")
    if re.search(r"[<>]", value):
        raise ValueError("Name can't contain < or >.")
    return value


def _check_password(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters.")
    if len(value) > 128:
        raise ValueError("Password must be 128 characters or fewer.")
    if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
        raise ValueError("Password needs at least one letter and one number.")
    return value


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        return _clean_name(v)

    @field_validator("password")
    @classmethod
    def _pw(cls, v: str) -> str:
        return _check_password(v)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class ChangePasswordIn(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _pw(cls, v: str) -> str:
        return _check_password(v)


class ProfileUpdate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        return _clean_name(v)


class DeleteAccountIn(BaseModel):
    password: str = Field(max_length=128)


class OnboardingIn(BaseModel):
    template: str = Field(pattern=r"^(exam_ai|focus|blank)$")
    plan_start: date_type
    plan_end: date_type


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    role: str
    onboarded: bool
    plan_start: Optional[date_type] = None
    plan_end: Optional[date_type] = None


class AuthOut(BaseModel):
    token: str
    user: UserOut


# ---------------------------------------------------------------------------
# Tracker
# ---------------------------------------------------------------------------

class QuestCreate(BaseModel):
    day_type: str = Field(pattern=DAY_TYPE_PATTERN)
    label: str = Field(min_length=1, max_length=200)
    time_label: str = Field(default="All day", max_length=50)
    stat: str = Field(pattern=STAT_PATTERN)


class QuestUpdate(BaseModel):
    label: Optional[str] = Field(default=None, min_length=1, max_length=200)
    time_label: Optional[str] = Field(default=None, max_length=50)
    stat: Optional[str] = Field(default=None, pattern=STAT_PATTERN)


class QuestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    day_type: str
    label: str
    time_label: str
    stat: str
    sort_order: int


class CompletionToggle(BaseModel):
    quest_id: int
    date: date_type
    completed: bool


class ShieldRequest(BaseModel):
    date: date_type


class JournalIn(BaseModel):
    mood: Optional[int] = Field(default=None, ge=1, le=5)
    note: str = Field(default="", max_length=2000)
    struggle: str = Field(default="", max_length=2000)


class ShopAction(BaseModel):
    key: str


class MilestoneOut(BaseModel):
    id: str
    title: str
    desc: str
    reward: int
    achieved: bool
    achieved_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------

class AdminUserPatch(BaseModel):
    role: Optional[str] = Field(default=None, pattern=r"^(user|admin)$")
    is_active: Optional[bool] = None


class OnboardingPlanIn(BaseModel):
    plan_start: date_type
    plan_end: date_type
