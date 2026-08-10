import os
import json
import uuid
from typing import List
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.database import engine, get_db, Base
from backend.models import User, Pillar, Task, Routine, ProteinLog
from backend.auth import get_current_user, seed_user_defaults
from backend import schemas

# Create database tables automatically upon startup
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Lock-In Protocol API (FastAPI + Supabase PostgreSQL + SQLAlchemy)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "backend": "FastAPI + SQLAlchemy + Supabase"}

# --- AUTH & USER PROFILE ENDPOINTS ---
@app.post("/api/auth/login")
def auth_login(
    req: schemas.AuthLogin,
    db: Session = Depends(get_db)
):
    email = req.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user_id = f"usr_{uuid.uuid4().hex[:12]}"
        user = User(
            id=user_id,
            email=email,
            name=email.split("@")[0].title(),
            avatar="⚡",
            day_number=1,
            streak_days=1,
            total_days_goal=90,
            current_level=4,
            points=1250,
            protein_goal=160
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        seed_user_defaults(db, user_id)

    token = f"{user.id}:{user.email}"
    return {"user": user.to_dict(), "token": token}

@app.post("/api/auth/register")
def auth_register(
    req: schemas.AuthRegister,
    db: Session = Depends(get_db)
):
    email = req.email.strip().lower()
    name = req.name.strip() or email.split("@")[0].title()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        token = f"{existing_user.id}:{existing_user.email}"
        return {"user": existing_user.to_dict(), "token": token}

    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    user = User(
        id=user_id,
        email=email,
        name=name,
        avatar="⚡",
        day_number=1,
        streak_days=1,
        total_days_goal=90,
        current_level=4,
        points=1250,
        protein_goal=160
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    seed_user_defaults(db, user_id)

    token = f"{user.id}:{user.email}"
    return {"user": user.to_dict(), "token": token}

@app.post("/api/auth/demo")
def auth_demo(db: Session = Depends(get_db)):
    demo_id = "demo_user_123"
    user = db.query(User).filter(User.id == demo_id).first()
    if not user:
        user = User(
            id=demo_id,
            email="demo@lockin.app",
            name="Lock-In Operator (Demo)",
            avatar="⚡",
            day_number=1,
            streak_days=1,
            total_days_goal=90,
            current_level=4,
            points=1250,
            protein_goal=160
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        seed_user_defaults(db, demo_id)

    return {"user": user.to_dict(), "token": "demo_token_lockin_operator_90"}

@app.get("/api/auth/me")
def get_me(user: User = Depends(get_current_user)):
    return {"user": user.to_dict()}

@app.post("/api/auth/profile")
def update_profile(
    req: schemas.ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if req.name is not None:
        user.name = req.name
    if req.avatar is not None:
        user.avatar = req.avatar
    if req.proteinGoal is not None and req.proteinGoal > 0:
        user.protein_goal = req.proteinGoal
    
    db.commit()
    db.refresh(user)
    return {"user": user.to_dict()}

@app.post("/api/auth/reset-90day")
def reset_90day_protocol(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user.day_number = 1
    user.streak_days = 1
    user.total_days_goal = 90

    # Reset task completions for current user
    user_tasks = db.query(Task).filter(Task.user_id == user.id).all()
    for task in user_tasks:
        task.completed = False

    # Reset routine completions for current user
    user_routines = db.query(Routine).filter(Routine.user_id == user.id).all()
    for routine in user_routines:
        routine.completed = False
        if routine.subtasks:
            updated_subtasks = []
            for st in routine.subtasks:
                st_copy = dict(st)
                st_copy["completed"] = False
                updated_subtasks.append(st_copy)
            routine.subtasks = updated_subtasks

    # Clear protein logs for current user
    db.query(ProteinLog).filter(ProteinLog.user_id == user.id).delete()

    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "user": user.to_dict(),
        "tasks": [t.to_dict() for t in db.query(Task).filter(Task.user_id == user.id).all()],
        "routines": [r.to_dict() for r in db.query(Routine).filter(Routine.user_id == user.id).all()],
        "message": "90-Day Lock-In Protocol successfully reset to Day 1!",
    }

# --- PILLARS ENDPOINTS ---
@app.get("/api/pillars")
def get_pillars(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pillars = db.query(Pillar).filter(Pillar.user_id == user.id).all()
    return [p.to_dict() for p in pillars]

@app.post("/api/pillars")
def create_pillar(
    req: schemas.PillarCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pillar = Pillar(
        user_id=user.id,
        name=req.name,
        icon=req.icon or "🔥",
        color=req.color or "#3ECF8E",
        daily_goal=req.dailyGoal or "1 Task/day",
    )
    db.add(pillar)
    db.commit()
    db.refresh(pillar)
    return pillar.to_dict()

@app.delete("/api/pillars/{pillar_id}")
def delete_pillar(
    pillar_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pillar = db.query(Pillar).filter(Pillar.id == pillar_id, Pillar.user_id == user.id).first()
    if not pillar:
        raise HTTPException(status_code=404, detail="Pillar not found")
    db.delete(pillar)
    db.commit()
    return {"success": True}

# --- TASKS ENDPOINTS ---
@app.get("/api/tasks")
def get_tasks(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tasks = db.query(Task).filter(Task.user_id == user.id).all()
    return [t.to_dict() for t in tasks]

@app.post("/api/tasks")
def create_task(
    req: schemas.TaskCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = Task(
        user_id=user.id,
        pillar_id=req.pillarId,
        time_block=req.timeBlock or "morning",
        name=req.name,
        points=req.points or 50,
        completed=False,
        repeat_frequency=req.repeatFrequency or "daily",
        custom_days=req.customDays or [],
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task.to_dict()

@app.patch("/api/tasks/{task_id}/toggle")
def toggle_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.completed = not task.completed
    if task.completed:
        user.points += task.points
    else:
        user.points = max(0, user.points - task.points)

    db.commit()
    db.refresh(task)
    db.refresh(user)

    all_tasks = db.query(Task).filter(Task.user_id == user.id).all()
    return {
        "task": task.to_dict(),
        "tasks": [t.to_dict() for t in all_tasks],
        "user": user.to_dict(),
    }

@app.delete("/api/tasks/{task_id}")
def delete_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return {"success": True}

# --- ROUTINES ENDPOINTS ---
@app.get("/api/routines")
def get_routines(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    routines = db.query(Routine).filter(Routine.user_id == user.id).all()
    return [r.to_dict() for r in routines]

@app.post("/api/routines")
def create_routine(
    req: schemas.RoutineCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    routine = Routine(
        user_id=user.id,
        name=req.name,
        icon=req.icon or "🌅",
        duration_mins=req.durationMins or 30,
        total_steps=len(req.subtasks or []) or req.totalSteps or 3,
        completed=False,
        subtasks=req.subtasks or [],
    )
    db.add(routine)
    db.commit()
    db.refresh(routine)
    return routine.to_dict()

@app.patch("/api/routines/{routine_id}")
def update_routine(
    routine_id: str,
    req: schemas.RoutineUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    routine = db.query(Routine).filter(Routine.id == routine_id, Routine.user_id == user.id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")

    if req.name is not None:
        routine.name = req.name
    if req.icon is not None:
        routine.icon = req.icon
    if req.durationMins is not None:
        routine.duration_mins = req.durationMins
    if req.subtasks is not None:
        routine.subtasks = req.subtasks
        routine.total_steps = len(req.subtasks)

    db.commit()
    db.refresh(routine)
    all_routines = db.query(Routine).filter(Routine.user_id == user.id).all()

    return {
        "routine": routine.to_dict(),
        "routines": [r.to_dict() for r in all_routines],
    }

@app.patch("/api/routines/{routine_id}/subtask/{subtask_id}/toggle")
def toggle_routine_subtask(
    routine_id: str,
    subtask_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    routine = db.query(Routine).filter(Routine.id == routine_id, Routine.user_id == user.id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")

    subtasks = routine.subtasks or []
    updated_subtasks = []
    all_completed = True

    for st in subtasks:
        st_dict = dict(st)
        if st_dict.get("id") == subtask_id:
            st_dict["completed"] = not st_dict.get("completed", False)
        updated_subtasks.append(st_dict)
        if not st_dict.get("completed", False):
            all_completed = False

    routine.subtasks = updated_subtasks
    routine.completed = all_completed
    db.commit()
    db.refresh(routine)

    all_routines = db.query(Routine).filter(Routine.user_id == user.id).all()
    return {
        "routine": routine.to_dict(),
        "routines": [r.to_dict() for r in all_routines],
    }

@app.patch("/api/routines/{routine_id}/complete")
def toggle_routine_complete(
    routine_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    routine = db.query(Routine).filter(Routine.id == routine_id, Routine.user_id == user.id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")

    routine.completed = not routine.completed
    subtasks = routine.subtasks or []
    updated_subtasks = []
    for st in subtasks:
        st_dict = dict(st)
        st_dict["completed"] = routine.completed
        updated_subtasks.append(st_dict)
    routine.subtasks = updated_subtasks

    if routine.completed:
        user.points += 75
    else:
        user.points = max(0, user.points - 75)

    db.commit()
    db.refresh(routine)
    db.refresh(user)

    all_routines = db.query(Routine).filter(Routine.user_id == user.id).all()
    return {
        "routine": routine.to_dict(),
        "routines": [r.to_dict() for r in all_routines],
        "user": user.to_dict(),
    }

@app.delete("/api/routines/{routine_id}")
def delete_routine(
    routine_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    routine = db.query(Routine).filter(Routine.id == routine_id, Routine.user_id == user.id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    db.delete(routine)
    db.commit()
    return {"success": True}

# --- PROTEIN / DIET LOG ENDPOINTS ---
@app.get("/api/protein-log")
def get_protein_log(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    logs = db.query(ProteinLog).filter(ProteinLog.user_id == user.id).all()
    entries = [l.to_dict() for l in logs]
    total_logged = sum(l.protein_grams for l in logs)

    return {
        "entries": entries,
        "totalLoggedGrams": total_logged,
        "goalGrams": user.protein_goal,
        "remainingGrams": max(0, user.protein_goal - total_logged),
    }

@app.post("/api/protein-log")
def add_protein_entry(
    req: schemas.ProteinEntryCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    entry = ProteinLog(
        user_id=user.id,
        food_name=req.foodName,
        protein_grams=req.proteinGrams,
        logged_time=req.time or "Just now",
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    logs = db.query(ProteinLog).filter(ProteinLog.user_id == user.id).all()
    total_logged = sum(l.protein_grams for l in logs)

    # Award points if user met daily goal
    if total_logged >= user.protein_goal:
        user.points += 20
        db.commit()
        db.refresh(user)

    data = {
        "entries": [l.to_dict() for l in logs],
        "totalLoggedGrams": total_logged,
        "goalGrams": user.protein_goal,
        "remainingGrams": max(0, user.protein_goal - total_logged),
    }

    return {
        "entry": entry.to_dict(),
        "data": data,
        "user": user.to_dict(),
    }

@app.delete("/api/protein-log/{entry_id}")
def delete_protein_entry(
    entry_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    entry = db.query(ProteinLog).filter(ProteinLog.id == entry_id, ProteinLog.user_id == user.id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Protein log entry not found")

    db.delete(entry)
    db.commit()

    logs = db.query(ProteinLog).filter(ProteinLog.user_id == user.id).all()
    total_logged = sum(l.protein_grams for l in logs)

    return {
        "entries": [l.to_dict() for l in logs],
        "totalLoggedGrams": total_logged,
        "goalGrams": user.protein_goal,
        "remainingGrams": max(0, user.protein_goal - total_logged),
    }

@app.put("/api/protein-goal")
def update_protein_goal(
    req: schemas.ProteinGoalUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if req.goalGrams > 0:
        user.protein_goal = req.goalGrams
        db.commit()
        db.refresh(user)
    return {"goalGrams": user.protein_goal}

# --- STATS ENDPOINT ---
@app.get("/api/stats")
def get_stats(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tasks = db.query(Task).filter(Task.user_id == user.id).all()
    routines = db.query(Routine).filter(Routine.user_id == user.id).all()
    logs = db.query(ProteinLog).filter(ProteinLog.user_id == user.id).all()

    completed_tasks = sum(1 for t in tasks if t.completed)
    total_tasks = len(tasks)
    task_completion_rate = round((completed_tasks / total_tasks * 100)) if total_tasks > 0 else 0

    completed_routines = sum(1 for r in routines if r.completed)
    total_protein = sum(l.protein_grams for l in logs)

    return {
        "dayNumber": user.day_number,
        "totalDays": user.total_days_goal,
        "streakDays": user.streak_days,
        "points": user.points,
        "level": user.current_level,
        "tasksCompletedToday": completed_tasks,
        "totalTasks": total_tasks,
        "taskCompletionRate": task_completion_rate,
        "routinesCompleted": completed_routines,
        "proteinLogged": total_protein,
        "proteinGoal": user.protein_goal,
        "weeklyMomentum": [
            {"day": "Mon", "score": 85},
            {"day": "Tue", "score": 90},
            {"day": "Wed", "score": 78},
            {"day": "Thu", "score": 95},
            {"day": "Fri", "score": 88},
            {"day": "Sat", "score": 92},
            {"day": "Sun", "score": 96},
        ]
    }

# --- AI ROUTINE GENERATOR ENDPOINT ---
@app.post("/api/ai/suggest-routine")
def suggest_ai_routine(
    req: schemas.AIRoutineRequest,
    user: User = Depends(get_current_user)
):
    # Smart structured routine response matching user request
    routine_name = f"Optimized {req.goal.strip() or 'Focus'} Protocol"
    subtasks = [
        {"id": "ai1", "text": f"Define primary 1-line outcome for {req.goal}", "duration": "5 mins", "completed": False},
        {"id": "ai2", "text": "Eliminate top 3 digital distractions & set timer", "duration": "5 mins", "completed": False},
        {"id": "ai3", "text": "Execute high-intensity focus block", "duration": "15 mins", "completed": False},
        {"id": "ai4", "text": "Review key learnings & log output", "duration": "5 mins", "completed": False},
    ]

    return {
        "routine": {
            "name": routine_name,
            "icon": "⚡",
            "durationMins": 30,
            "totalSteps": len(subtasks),
            "subtasks": subtasks,
        },
        "reasoning": f"Custom protocol generated for operator targeting '{req.goal}' within {req.timeAvailable} available time.",
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
