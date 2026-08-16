from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class PillarCreate(BaseModel):
    name: str
    icon: Optional[str] = "🔥"
    color: Optional[str] = "#3ECF8E"
    dailyGoal: Optional[str] = "1 Task/day"

class TaskCreate(BaseModel):
    pillarId: str
    timeBlock: str = "morning"
    name: str
    points: Optional[int] = 50
    repeatFrequency: Optional[str] = "daily"
    customDays: Optional[List[str]] = []

class RoutineCreate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    icon: Optional[str] = "🌅"
    durationMins: Optional[int] = 30
    totalSteps: Optional[int] = 3
    subtasks: Optional[List[Dict[str, Any]]] = []

class RoutineUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    durationMins: Optional[int] = None
    subtasks: Optional[List[Dict[str, Any]]] = None

class ProteinEntryCreate(BaseModel):
    foodName: str
    proteinGrams: int
    time: Optional[str] = "Today"

class ProteinGoalUpdate(BaseModel):
    goalGrams: int

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None
    proteinGoal: Optional[int] = None

class AIRoutineRequest(BaseModel):
    goal: str
    timeAvailable: Optional[str] = "30 mins"
    focusArea: Optional[str] = "Productivity & Health"

class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str

class PushSubscriptionCreate(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys
    preferredTime: Optional[str] = "08:00"
    timezone: Optional[str] = "UTC"

class NotificationPreferencesUpdate(BaseModel):
    preferredTime: Optional[str] = "08:00"
    timezone: Optional[str] = "UTC"
    isActive: Optional[bool] = True



