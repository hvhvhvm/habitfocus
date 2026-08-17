import uuid
from sqlalchemy import Column, String, Integer, Boolean, Float, ForeignKey, DateTime, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True) # Matches Supabase auth user_id
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, default="Lock-In Operator")
    avatar = Column(String, default="⚡")
    day_number = Column(Integer, default=1)
    streak_days = Column(Integer, default=1)
    total_days_goal = Column(Integer, default=90)
    current_level = Column(Integer, default=4)
    points = Column(Integer, default=1250)
    protein_goal = Column(Integer, default=160)
    last_active_date = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    pillars = relationship("Pillar", back_populates="user", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="user", cascade="all, delete-orphan")
    routines = relationship("Routine", back_populates="user", cascade="all, delete-orphan")
    protein_logs = relationship("ProteinLog", back_populates="user", cascade="all, delete-orphan")
    task_logs = relationship("TaskLog", back_populates="user", cascade="all, delete-orphan")
    routine_logs = relationship("RoutineLog", back_populates="user", cascade="all, delete-orphan")
    push_subscriptions = relationship("PushSubscription", back_populates="user", cascade="all, delete-orphan")

    def to_dict(self):
        # Sync level dynamically (400 points per level, starting at lvl 1, default 1250 gives lvl 4)
        computed_level = max(1, (self.points // 400) + 1)
        if self.current_level != computed_level:
            self.current_level = computed_level
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "avatar": self.avatar,
            "dayNumber": self.day_number,
            "streakDays": self.streak_days,
            "totalDaysGoal": self.total_days_goal,
            "currentLevel": computed_level,
            "points": self.points,
            "totalPoints": self.points,
            "proteinGoal": self.protein_goal,
            "lastActiveDate": self.last_active_date,
        }

class Pillar(Base):
    __tablename__ = "pillars"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    icon = Column(String, default="🔥")
    color = Column(String, default="#3ECF8E")
    daily_goal = Column(String, default="1 Task/day")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="pillars")
    tasks = relationship("Task", back_populates="pillar", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "name": self.name,
            "icon": self.icon,
            "color": self.color,
            "dailyGoal": self.daily_goal,
        }

class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    pillar_id = Column(String, ForeignKey("pillars.id", ondelete="CASCADE"), nullable=False, index=True)
    time_block = Column(String, default="morning") # morning, afternoon, evening, night
    name = Column(String, nullable=False)
    points = Column(Integer, default=50)
    completed = Column(Boolean, default=False)
    repeat_frequency = Column(String, default="daily")
    custom_days = Column(JSON, default=list) # e.g. ["Mon", "Wed"]
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="tasks")
    pillar = relationship("Pillar", back_populates="tasks")
    logs = relationship("TaskLog", back_populates="task", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "pillarId": self.pillar_id,
            "timeBlock": self.time_block,
            "name": self.name,
            "points": self.points,
            "completed": self.completed,
            "repeatFrequency": self.repeat_frequency,
            "customDays": self.custom_days or [],
        }

class Routine(Base):
    __tablename__ = "routines"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    icon = Column(String, default="🌅")
    duration_mins = Column(Integer, default=30)
    total_steps = Column(Integer, default=3)
    completed = Column(Boolean, default=False)
    subtasks = Column(JSON, default=list) # List of dicts: [{id, text, duration, completed}]
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="routines")
    logs = relationship("RoutineLog", back_populates="routine", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "name": self.name,
            "title": self.name,
            "icon": self.icon,
            "durationMins": self.duration_mins,
            "totalSteps": self.total_steps,
            "completed": self.completed,
            "subtasks": self.subtasks or [],
            "isMaster": True,
        }

class ProteinLog(Base):
    __tablename__ = "protein_logs"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    food_name = Column(String, nullable=False)
    protein_grams = Column(Integer, nullable=False)
    logged_time = Column(String, default="Today")
    logged_date = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="protein_logs")

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "foodName": self.food_name,
            "proteinGrams": self.protein_grams,
            "time": self.logged_time,
            "loggedDate": self.logged_date,
        }

class TaskLog(Base):
    __tablename__ = "task_logs"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    task_id = Column(String, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    completed_date = Column(String, nullable=False, index=True) # YYYY-MM-DD
    points_awarded = Column(Integer, default=50)
    completed_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="task_logs")
    task = relationship("Task", back_populates="logs")

    def to_dict(self):
        return {
            "id": self.id,
            "taskId": self.task_id,
            "userId": self.user_id,
            "completedDate": self.completed_date,
            "pointsAwarded": self.points_awarded,
            "completedAt": self.completed_at.isoformat() if self.completed_at else None,
        }

class RoutineLog(Base):
    __tablename__ = "routine_logs"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    routine_id = Column(String, ForeignKey("routines.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    completed_date = Column(String, nullable=False, index=True) # YYYY-MM-DD
    points_awarded = Column(Integer, default=75)
    completed_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="routine_logs")
    routine = relationship("Routine", back_populates="logs")

    def to_dict(self):
        return {
            "id": self.id,
            "routineId": self.routine_id,
            "userId": self.user_id,
            "completedDate": self.completed_date,
            "pointsAwarded": self.points_awarded,
            "completedAt": self.completed_at.isoformat() if self.completed_at else None,
        }

class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    endpoint = Column(Text, nullable=False)
    p256dh = Column(Text, nullable=False)
    auth = Column(Text, nullable=False)
    preferred_time = Column(String, default="07:00") # Format: "07:00"
    morning_time = Column(String, default="07:00")
    afternoon_time = Column(String, default="12:30")
    evening_time = Column(String, default="17:30")
    night_time = Column(String, default="21:30")
    notify_morning = Column(Boolean, default=True)
    notify_afternoon = Column(Boolean, default=True)
    notify_evening = Column(Boolean, default=True)
    notify_night = Column(Boolean, default=True)
    last_morning_sent = Column(String, default="")
    last_afternoon_sent = Column(String, default="")
    last_evening_sent = Column(String, default="")
    last_night_sent = Column(String, default="")
    timezone = Column(String, default="UTC")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="push_subscriptions")

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "endpoint": self.endpoint,
            "preferredTime": self.preferred_time or "07:00",
            "morningTime": self.morning_time or "07:00",
            "afternoonTime": self.afternoon_time or "12:30",
            "eveningTime": self.evening_time or "17:30",
            "nightTime": self.night_time or "21:30",
            "notifyMorning": self.notify_morning if self.notify_morning is not None else True,
            "notifyAfternoon": self.notify_afternoon if self.notify_afternoon is not None else True,
            "notifyEvening": self.notify_evening if self.notify_evening is not None else True,
            "notifyNight": self.notify_night if self.notify_night is not None else True,
            "timezone": self.timezone or "UTC",
            "isActive": self.is_active,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }

