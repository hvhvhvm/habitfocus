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
    created_at = Column(DateTime, default=datetime.utcnow)

    pillars = relationship("Pillar", back_populates="user", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="user", cascade="all, delete-orphan")
    routines = relationship("Routine", back_populates="user", cascade="all, delete-orphan")
    protein_logs = relationship("ProteinLog", back_populates="user", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "avatar": self.avatar,
            "dayNumber": self.day_number,
            "streakDays": self.streak_days,
            "totalDaysGoal": self.total_days_goal,
            "currentLevel": self.current_level,
            "points": self.points,
            "proteinGoal": self.protein_goal,
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
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="protein_logs")

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "foodName": self.food_name,
            "proteinGrams": self.protein_grams,
            "time": self.logged_time,
        }
