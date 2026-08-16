import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from backend.database import engine, get_db, Base, SessionLocal
from backend.models import User, Pillar, Task, Routine, ProteinLog, TaskLog, RoutineLog, PushSubscription
from backend.auth import get_current_user
from backend import schemas
from sqlalchemy import text
from datetime import datetime, timedelta

logger = logging.getLogger("lockin.scheduler")

# Create database tables automatically upon startup
Base.metadata.create_all(bind=engine)

# Auto-migrate: Add missing columns / tables for existing databases
for migration_sql in [
    "ALTER TABLE users ADD COLUMN last_active_date VARCHAR DEFAULT ''",
    "ALTER TABLE protein_logs ADD COLUMN logged_date VARCHAR DEFAULT ''",
]:
    try:
        with engine.connect() as conn:
            conn.execute(text(migration_sql))
            conn.commit()
    except Exception:
        pass

# ---------------------------------------------------------------------------
# Background Scheduler: sends push notifications at each time block
# ---------------------------------------------------------------------------

def dispatch_time_block_briefings(time_block: str):
    """Called by APScheduler — sends push for all active subscriptions for this time block."""
    from backend.notifications import send_time_block_briefing_to_user
    db = SessionLocal()
    try:
        users = db.query(User).join(
            PushSubscription,
            PushSubscription.user_id == User.id
        ).filter(PushSubscription.is_active == True).distinct().all()

        sent_total = 0
        for user in users:
            try:
                result = send_time_block_briefing_to_user(user, db, time_block)
                sent_total += result.get("sentCount", 0)
            except Exception as e:
                logger.warning(f"Failed sending {time_block} push for user {user.id}: {e}")

        logger.info(f"[Scheduler] {time_block.capitalize()} briefing: sent {sent_total} push(es) to {len(users)} user(s).")
    except Exception as e:
        logger.error(f"[Scheduler] Error in {time_block} dispatch: {e}")
    finally:
        db.close()


scheduler = BackgroundScheduler(timezone="UTC")

# ☀️  Morning:   07:00 IST = 01:30 UTC
# ✨  Afternoon: 12:30 IST = 07:00 UTC
# 🌇  Evening:   17:30 IST = 12:00 UTC
# 🌙  Night:     21:30 IST = 16:00 UTC
TIME_BLOCK_SCHEDULE = [
    {"block": "morning",   "hour": 1,  "minute": 30},
    {"block": "afternoon", "hour": 7,  "minute": 0},
    {"block": "evening",   "hour": 12, "minute": 0},
    {"block": "night",     "hour": 16, "minute": 0},
]

for entry in TIME_BLOCK_SCHEDULE:
    scheduler.add_job(
        dispatch_time_block_briefings,
        CronTrigger(hour=entry["hour"], minute=entry["minute"], timezone="UTC"),
        args=[entry["block"]],
        id=f"notify_{entry['block']}",
        replace_existing=True,
        misfire_grace_time=900,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    logger.info("[Scheduler] Time-block push notification scheduler started.")
    yield
    scheduler.shutdown(wait=False)
    logger.info("[Scheduler] Scheduler stopped.")


app = FastAPI(
    title="Lock-In Protocol API (FastAPI + Supabase PostgreSQL + SQLAlchemy)",
    lifespan=lifespan,
)

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
# Authentication is handled exclusively via Supabase Auth on the frontend.
# All protected endpoints verify the Supabase Bearer token via get_current_user.

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

    # Archive (tag) protein logs rather than deleting them so history is preserved
    reset_date = user.last_active_date or "reset"
    untagged = db.query(ProteinLog).filter(
        ProteinLog.user_id == user.id,
        (ProteinLog.logged_date == None) | (ProteinLog.logged_date == "")
    ).all()
    for plog in untagged:
        plog.logged_date = reset_date

    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "user": user.to_dict(),
        "tasks": [t.to_dict() for t in db.query(Task).filter(Task.user_id == user.id).all()],
        "routines": [r.to_dict() for r in db.query(Routine).filter(Routine.user_id == user.id).all()],
        "message": "90-Day Lock-In Protocol successfully reset to Day 1!",
    }

@app.post("/api/auth/simulate-next-day")
def simulate_next_day(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from backend.auth import execute_rollover_logic
    
    local_date = request.headers.get("x-local-date") or ""
    base_date_str = user.last_active_date or local_date
    if not base_date_str:
        base_date_str = datetime.utcnow().strftime("%Y-%m-%d")

    try:
        base_dt = datetime.strptime(base_date_str, "%Y-%m-%d")
    except Exception:
        base_dt = datetime.utcnow()

    next_date_str = (base_dt + timedelta(days=1)).strftime("%Y-%m-%d")

    # Run the rollover logic to force-advance 1 day
    execute_rollover_logic(user, db, 1, next_date_str)

    return {
        "success": True,
        "user": user.to_dict(),
        "tasks": [t.to_dict() for t in db.query(Task).filter(Task.user_id == user.id).all()],
        "routines": [r.to_dict() for r in db.query(Routine).filter(Routine.user_id == user.id).all()],
        "message": f"Successfully simulated rollover to Day {user.day_number} ({next_date_str})!",
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
    if not req.name or not req.name.strip():
        raise HTTPException(status_code=400, detail="Pillar name is required.")
        
    pillar = Pillar(
        user_id=user.id,
        name=req.name.strip(),
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
    if not req.name or not req.name.strip():
        raise HTTPException(status_code=400, detail="Task name is required.")

    # Safely verify pillar belongs to user or resolve to a valid fallback
    target_pillar = db.query(Pillar).filter(Pillar.id == req.pillarId, Pillar.user_id == user.id).first()
    if not target_pillar:
        # Resolve to user's first existing pillar, or auto-create a default pillar
        target_pillar = db.query(Pillar).filter(Pillar.user_id == user.id).first()
        if not target_pillar:
            target_pillar = Pillar(
                user_id=user.id,
                name="General Focus",
                icon="⚡",
                color="#3ECF8E",
                daily_goal="Daily Protocol",
            )
            db.add(target_pillar)
            db.commit()
            db.refresh(target_pillar)

    task = Task(
        user_id=user.id,
        pillar_id=target_pillar.id,
        time_block=req.timeBlock or "morning",
        name=req.name.strip(),
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
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    local_date = request.headers.get("x-local-date") or datetime.utcnow().strftime("%Y-%m-%d")

    task.completed = not task.completed
    if task.completed:
        user.points += task.points
        # Record completion in task history log
        existing_log = db.query(TaskLog).filter(
            TaskLog.task_id == task.id,
            TaskLog.completed_date == local_date
        ).first()
        if not existing_log:
            db.add(TaskLog(
                task_id=task.id,
                user_id=user.id,
                completed_date=local_date,
                points_awarded=task.points,
            ))
    else:
        user.points = max(0, user.points - task.points)
        # Remove completion log if task is un-checked on same day
        db.query(TaskLog).filter(
            TaskLog.task_id == task.id,
            TaskLog.completed_date == local_date
        ).delete()

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
    routine_title = req.title or req.name or "Daily Protocol Routine"
    routine = Routine(
        user_id=user.id,
        name=routine_title,
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
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    routine = db.query(Routine).filter(Routine.id == routine_id, Routine.user_id == user.id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")

    local_date = request.headers.get("x-local-date") or datetime.utcnow().strftime("%Y-%m-%d")

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
        # Record in routine history log
        existing_log = db.query(RoutineLog).filter(
            RoutineLog.routine_id == routine.id,
            RoutineLog.completed_date == local_date
        ).first()
        if not existing_log:
            db.add(RoutineLog(
                routine_id=routine.id,
                user_id=user.id,
                completed_date=local_date,
                points_awarded=75,
            ))
    else:
        user.points = max(0, user.points - 75)
        # Remove log if un-completed on same day
        db.query(RoutineLog).filter(
            RoutineLog.routine_id == routine.id,
            RoutineLog.completed_date == local_date
        ).delete()

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
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    local_date = request.headers.get("x-local-date") or datetime.utcnow().strftime("%Y-%m-%d")
    # Only return TODAY's entries so the dashboard shows today's intake
    logs = db.query(ProteinLog).filter(
        ProteinLog.user_id == user.id,
        (ProteinLog.logged_date == local_date) | (ProteinLog.logged_date == "") | (ProteinLog.logged_date == None)
    ).all()
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
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    local_date = request.headers.get("x-local-date") or datetime.utcnow().strftime("%Y-%m-%d")
    entry = ProteinLog(
        user_id=user.id,
        food_name=req.foodName,
        protein_grams=req.proteinGrams,
        logged_time=req.time or "Just now",
        logged_date=local_date,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    # Only today's logs count toward the daily total
    logs = db.query(ProteinLog).filter(
        ProteinLog.user_id == user.id,
        (ProteinLog.logged_date == local_date) | (ProteinLog.logged_date == "") | (ProteinLog.logged_date == None)
    ).all()
    total_logged = sum(l.protein_grams for l in logs)

    # Award points if user met daily goal (only first time)
    if total_logged >= user.protein_goal and total_logged - req.proteinGrams < user.protein_goal:
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
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    entry = db.query(ProteinLog).filter(ProteinLog.id == entry_id, ProteinLog.user_id == user.id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Protein log entry not found")

    local_date = request.headers.get("x-local-date") or datetime.utcnow().strftime("%Y-%m-%d")
    db.delete(entry)
    db.commit()

    logs = db.query(ProteinLog).filter(
        ProteinLog.user_id == user.id,
        (ProteinLog.logged_date == local_date) | (ProteinLog.logged_date == "") | (ProteinLog.logged_date == None)
    ).all()
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
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    local_date = request.headers.get("x-local-date") or datetime.utcnow().strftime("%Y-%m-%d")

    tasks = db.query(Task).filter(Task.user_id == user.id).all()
    routines = db.query(Routine).filter(Routine.user_id == user.id).all()

    # Today's protein only
    protein_logs_today = db.query(ProteinLog).filter(
        ProteinLog.user_id == user.id,
        (ProteinLog.logged_date == local_date) | (ProteinLog.logged_date == "") | (ProteinLog.logged_date == None)
    ).all()

    completed_tasks = sum(1 for t in tasks if t.completed)
    total_tasks = len(tasks)
    task_completion_rate = round((completed_tasks / total_tasks * 100)) if total_tasks > 0 else 0

    completed_routines = sum(1 for r in routines if r.completed)
    total_protein = sum(l.protein_grams for l in protein_logs_today)

    # Build real 7-day weekly data from TaskLog history
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    try:
        base_dt = datetime.strptime(local_date, "%Y-%m-%d")
    except Exception:
        base_dt = datetime.utcnow()

    weekly_data = []
    for i in range(6, -1, -1):
        day_dt = base_dt - timedelta(days=i)
        day_str = day_dt.strftime("%Y-%m-%d")
        day_label = day_names[day_dt.weekday()]

        if day_str == local_date:
            # Today — use live state
            daily_completed = completed_tasks
            daily_total = total_tasks
        else:
            # Past day — pull from TaskLog
            daily_completed = db.query(TaskLog).filter(
                TaskLog.user_id == user.id,
                TaskLog.completed_date == day_str
            ).count()
            daily_total = total_tasks or 1  # Fallback to avoid division by zero

        weekly_data.append({
            "day": day_label,
            "completed": daily_completed,
            "total": daily_total,
            "points": daily_completed * 15,
        })

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
        "weeklyData": weekly_data,
        "weeklyMomentum": [{"day": d["day"], "score": round(d["completed"] / max(d["total"], 1) * 100)} for d in weekly_data],
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

# --- DAY-WISE HISTORY & 90-DAY PROTOCOL ROADMAP ---
@app.get("/api/days-history")
def get_days_history(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    local_date = request.headers.get("x-local-date") or datetime.utcnow().strftime("%Y-%m-%d")
    current_day = user.day_number or 1
    total_days = user.total_days_goal or 90

    # Fetch all tasks and task logs for user
    all_tasks = db.query(Task).filter(Task.user_id == user.id).all()
    total_tasks_count = len(all_tasks)
    today_completed_tasks = [t for t in all_tasks if t.completed]

    all_task_logs = db.query(TaskLog).filter(TaskLog.user_id == user.id).all()
    logs_by_date = {}
    for log in all_task_logs:
        logs_by_date.setdefault(log.completed_date, []).append(log)

    try:
        current_dt = datetime.strptime(local_date, "%Y-%m-%d")
    except Exception:
        current_dt = datetime.utcnow()

    days_data = []
    for day_i in range(1, total_days + 1):
        offset = day_i - current_day
        day_date_str = (current_dt + timedelta(days=offset)).strftime("%Y-%m-%d")

        if day_i < current_day:
            day_logs = logs_by_date.get(day_date_str, [])
            completed_count = len(day_logs)
            points_sum = sum(l.points_awarded for l in day_logs)
            status_str = "completed" if (completed_count >= max(1, total_tasks_count)) else ("partial" if completed_count > 0 else "missed")
            days_data.append({
                "dayNumber": day_i,
                "date": day_date_str,
                "status": status_str,
                "completedCount": completed_count,
                "totalCount": total_tasks_count or 1,
                "points": points_sum,
                "isCurrent": False,
                "isPast": True,
            })
        elif day_i == current_day:
            completed_count = len(today_completed_tasks)
            points_sum = sum(t.points for t in today_completed_tasks)
            status_str = "completed" if (completed_count == total_tasks_count and total_tasks_count > 0) else "active"
            days_data.append({
                "dayNumber": day_i,
                "date": local_date,
                "status": status_str,
                "completedCount": completed_count,
                "totalCount": total_tasks_count,
                "points": points_sum,
                "isCurrent": True,
                "isPast": False,
            })
        else:
            days_data.append({
                "dayNumber": day_i,
                "date": day_date_str,
                "status": "upcoming",
                "completedCount": 0,
                "totalCount": total_tasks_count,
                "points": 0,
                "isCurrent": False,
                "isPast": False,
            })

    return {
        "currentDay": current_day,
        "totalDays": total_days,
        "streakDays": user.streak_days,
        "days": days_data,
    }

# --- PUSH NOTIFICATION ENDPOINTS ---
@app.get("/api/notifications/vapid-public-key")
def get_vapid_key():
    from backend.notifications import get_vapid_public_key
    return {"publicKey": get_vapid_public_key()}

@app.get("/api/notifications/status")
def get_notification_status(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sub = db.query(PushSubscription).filter(
        PushSubscription.user_id == user.id,
        PushSubscription.is_active == True
    ).first()

    return {
        "isSubscribed": sub is not None,
        "preferredTime": sub.preferred_time if sub else "08:00",
        "timezone": sub.timezone if sub else "UTC",
    }

@app.post("/api/notifications/subscribe")
def subscribe_push_notifications(
    req: schemas.PushSubscriptionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sub = db.query(PushSubscription).filter(
        PushSubscription.user_id == user.id,
        PushSubscription.endpoint == req.endpoint
    ).first()

    if sub:
        sub.p256dh = req.keys.p256dh
        sub.auth = req.keys.auth
        sub.preferred_time = req.preferredTime or "08:00"
        sub.timezone = req.timezone or "UTC"
        sub.is_active = True
    else:
        sub = PushSubscription(
            user_id=user.id,
            endpoint=req.endpoint,
            p256dh=req.keys.p256dh,
            auth=req.keys.auth,
            preferred_time=req.preferredTime or "08:00",
            timezone=req.timezone or "UTC",
            is_active=True,
        )
        db.add(sub)

    db.commit()
    db.refresh(sub)
    return {"success": True, "subscription": sub.to_dict()}

@app.post("/api/notifications/test")
def send_test_push_notification(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from backend.notifications import send_daily_briefing_to_user
    result = send_daily_briefing_to_user(user, db)
    return result

@app.post("/api/notifications/test-block")
def send_test_block_push_notification(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    time_block = request.query_params.get("timeBlock", "morning")
    from backend.notifications import send_time_block_briefing_to_user
    result = send_time_block_briefing_to_user(user, db, time_block)
    return result

@app.post("/api/notifications/trigger-briefing")
def trigger_daily_briefing(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from backend.notifications import send_daily_briefing_to_user
    result = send_daily_briefing_to_user(user, db)
    return result

@app.delete("/api/notifications/unsubscribe")
def unsubscribe_push_notifications(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(PushSubscription).filter(PushSubscription.user_id == user.id).delete()
    db.commit()
    return {"success": True, "message": "Successfully unsubscribed from push notifications."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
