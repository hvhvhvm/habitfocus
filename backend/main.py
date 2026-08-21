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
    "ALTER TABLE push_subscriptions ADD COLUMN morning_time VARCHAR DEFAULT '07:00'",
    "ALTER TABLE push_subscriptions ADD COLUMN afternoon_time VARCHAR DEFAULT '12:30'",
    "ALTER TABLE push_subscriptions ADD COLUMN evening_time VARCHAR DEFAULT '17:30'",
    "ALTER TABLE push_subscriptions ADD COLUMN night_time VARCHAR DEFAULT '21:30'",
    "ALTER TABLE push_subscriptions ADD COLUMN notify_morning BOOLEAN DEFAULT TRUE",
    "ALTER TABLE push_subscriptions ADD COLUMN notify_afternoon BOOLEAN DEFAULT TRUE",
    "ALTER TABLE push_subscriptions ADD COLUMN notify_evening BOOLEAN DEFAULT TRUE",
    "ALTER TABLE push_subscriptions ADD COLUMN notify_night BOOLEAN DEFAULT TRUE",
    "ALTER TABLE push_subscriptions ADD COLUMN last_morning_sent VARCHAR DEFAULT ''",
    "ALTER TABLE push_subscriptions ADD COLUMN last_afternoon_sent VARCHAR DEFAULT ''",
    "ALTER TABLE push_subscriptions ADD COLUMN last_evening_sent VARCHAR DEFAULT ''",
    "ALTER TABLE push_subscriptions ADD COLUMN last_night_sent VARCHAR DEFAULT ''",
]:
    try:
        with engine.connect() as conn:
            conn.execute(text(migration_sql))
            conn.commit()
    except Exception:
        pass

# ---------------------------------------------------------------------------
# Background Scheduler: Timezone-aware per-minute dispatcher
# ---------------------------------------------------------------------------

def time_str_to_minutes(time_str: str) -> int:
    try:
        parts = (time_str or "00:00").split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except Exception:
        return 0

def check_and_dispatch_scheduled_notifications():
    """
    Runs every minute. Iterates all active push subscriptions,
    computes each user's local time in their configured timezone,
    and dispatches morning / afternoon / evening / night task briefings
    using time-window resilience.
    """
    from backend.notifications import send_time_block_briefing_to_user
    import zoneinfo

    db = SessionLocal()
    dispatched_count = 0
    try:
        subs = db.query(PushSubscription).filter(PushSubscription.is_active == True).all()
        for sub in subs:
            try:
                tz_name = sub.timezone or "UTC"
                try:
                    user_tz = zoneinfo.ZoneInfo(tz_name)
                except Exception:
                    user_tz = zoneinfo.ZoneInfo("UTC")

                now_local = datetime.now(user_tz)
                current_time = now_local.strftime("%H:%M")
                current_date = now_local.strftime("%Y-%m-%d")
                current_mins = now_local.hour * 60 + now_local.minute

                user = db.query(User).filter(User.id == sub.user_id).first()
                if not user:
                    continue

                morning_target = sub.morning_time or sub.preferred_time or "07:00"
                afternoon_target = sub.afternoon_time or "12:30"
                evening_target = sub.evening_time or "17:30"
                night_target = sub.night_time or "21:30"

                m_mins = time_str_to_minutes(morning_target)
                a_mins = time_str_to_minutes(afternoon_target)
                e_mins = time_str_to_minutes(evening_target)
                n_mins = time_str_to_minutes(night_target)

                # ☀️ Morning Briefing (matches target time within 2 min window)
                if (sub.notify_morning is not False) and (abs(current_mins - m_mins) <= 1) and (sub.last_morning_sent != current_date):
                    logger.info(f"[Scheduler] ☀️ Dispatching Morning Briefing to user {user.id} ({user.email}) at local time {current_time} ({tz_name})")
                    send_time_block_briefing_to_user(user, db, "morning")
                    sub.last_morning_sent = current_date
                    dispatched_count += 1
                    db.commit()

                # ✨ Afternoon Momentum Briefing
                if (sub.notify_afternoon is not False) and (abs(current_mins - a_mins) <= 1) and (sub.last_afternoon_sent != current_date):
                    logger.info(f"[Scheduler] ✨ Dispatching Afternoon Briefing to user {user.id} ({user.email}) at local time {current_time} ({tz_name})")
                    send_time_block_briefing_to_user(user, db, "afternoon")
                    sub.last_afternoon_sent = current_date
                    dispatched_count += 1
                    db.commit()

                # 🌇 Evening Surge Briefing
                if (sub.notify_evening is not False) and (abs(current_mins - e_mins) <= 1) and (sub.last_evening_sent != current_date):
                    logger.info(f"[Scheduler] 🌇 Dispatching Evening Briefing to user {user.id} ({user.email}) at local time {current_time} ({tz_name})")
                    send_time_block_briefing_to_user(user, db, "evening")
                    sub.last_evening_sent = current_date
                    dispatched_count += 1
                    db.commit()

                # 🌙 Night Protocol & Recovery
                if (sub.notify_night is not False) and (abs(current_mins - n_mins) <= 1) and (sub.last_night_sent != current_date):
                    logger.info(f"[Scheduler] 🌙 Dispatching Night Briefing to user {user.id} ({user.email}) at local time {current_time} ({tz_name})")
                    send_time_block_briefing_to_user(user, db, "night")
                    sub.last_night_sent = current_date
                    dispatched_count += 1
                    db.commit()

            except Exception as sub_err:
                logger.warning(f"[Scheduler] Error processing subscription {sub.id}: {sub_err}")
    except Exception as e:
        logger.error(f"[Scheduler] Error in notification dispatcher loop: {e}")
    finally:
        db.close()
    return dispatched_count


scheduler = BackgroundScheduler(timezone="UTC")

# Run notification check interval every 1 minute
scheduler.add_job(
    check_and_dispatch_scheduled_notifications,
    "interval",
    minutes=1,
    id="scheduled_notification_checker",
    replace_existing=True,
    misfire_grace_time=60,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    logger.info("[Scheduler] Timezone-aware push notification background scheduler started.")
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

@app.api_route("/", methods=["GET", "HEAD"])
def root_check():
    return {"status": "ok", "message": "Lock-In Protocol API Server Live"}

@app.api_route("/api/health", methods=["GET", "HEAD"])
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

    # Fetch fresh protein entries for new day
    protein_logs = db.query(ProteinLog).filter(
        ProteinLog.user_id == user.id,
        ProteinLog.logged_date == next_date_str
    ).all()
    total_protein = sum(l.protein_grams for l in protein_logs)

    return {
        "success": True,
        "user": user.to_dict(),
        "tasks": [t.to_dict() for t in db.query(Task).filter(Task.user_id == user.id).all()],
        "routines": [r.to_dict() for r in db.query(Routine).filter(Routine.user_id == user.id).all()],
        "protein": {
            "entries": [l.to_dict() for l in protein_logs],
            "totalLoggedGrams": total_protein,
            "goalGrams": user.protein_goal or 160,
            "remainingGrams": max(0, (user.protein_goal or 160) - total_protein),
        },
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
    from sqlalchemy.orm.attributes import flag_modified
    routine = db.query(Routine).filter(Routine.id == routine_id, Routine.user_id == user.id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")

    subtasks = routine.subtasks or []
    updated_subtasks = []
    all_completed = True

    for idx, st in enumerate(subtasks):
        st_dict = dict(st) if isinstance(st, dict) else {"id": f"sub_{idx}", "name": str(st), "completed": False}
        curr_id = st_dict.get("id") or f"sub_{idx}"
        if curr_id == subtask_id:
            st_dict["completed"] = not st_dict.get("completed", False)
        updated_subtasks.append(st_dict)
        if not st_dict.get("completed", False):
            all_completed = False

    routine.subtasks = updated_subtasks
    flag_modified(routine, "subtasks")
    routine.completed = all_completed and len(updated_subtasks) > 0
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
    from sqlalchemy.orm.attributes import flag_modified
    routine = db.query(Routine).filter(Routine.id == routine_id, Routine.user_id == user.id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")

    local_date = request.headers.get("x-local-date") or datetime.utcnow().strftime("%Y-%m-%d")

    routine.completed = not routine.completed
    subtasks = routine.subtasks or []
    updated_subtasks = []
    for idx, st in enumerate(subtasks):
        st_dict = dict(st) if isinstance(st, dict) else {"id": f"sub_{idx}", "name": str(st), "completed": False}
        st_dict["completed"] = routine.completed
        updated_subtasks.append(st_dict)
    routine.subtasks = updated_subtasks
    flag_modified(routine, "subtasks")

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
    # Only return TODAY's entries so the dashboard reflects today's fresh log
    logs = db.query(ProteinLog).filter(
        ProteinLog.user_id == user.id,
        ProteinLog.logged_date == local_date
    ).order_by(ProteinLog.created_at.desc()).all()
    entries = [l.to_dict() for l in logs]
    total_logged = sum(l.protein_grams for l in logs)

    return {
        "entries": entries,
        "totalLoggedGrams": total_logged,
        "goalGrams": user.protein_goal or 160,
        "remainingGrams": max(0, (user.protein_goal or 160) - total_logged),
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
        logged_time=req.time or datetime.now().strftime("%I:%M %p"),
        logged_date=local_date,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    # Only today's logs count toward the daily total
    logs = db.query(ProteinLog).filter(
        ProteinLog.user_id == user.id,
        ProteinLog.logged_date == local_date
    ).order_by(ProteinLog.created_at.desc()).all()
    total_logged = sum(l.protein_grams for l in logs)

    # Award points if user met daily goal
    if total_logged >= (user.protein_goal or 160) and (total_logged - req.proteinGrams) < (user.protein_goal or 160):
        user.points += 20
        db.commit()
        db.refresh(user)

    data = {
        "entries": [l.to_dict() for l in logs],
        "totalLoggedGrams": total_logged,
        "goalGrams": user.protein_goal or 160,
        "remainingGrams": max(0, (user.protein_goal or 160) - total_logged),
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
        ProteinLog.logged_date == local_date
    ).order_by(ProteinLog.created_at.desc()).all()
    total_logged = sum(l.protein_grams for l in logs)

    return {
        "entries": [l.to_dict() for l in logs],
        "totalLoggedGrams": total_logged,
        "goalGrams": user.protein_goal or 160,
        "remainingGrams": max(0, (user.protein_goal or 160) - total_logged),
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

    if not sub:
        return {
            "isSubscribed": False,
            "preferredTime": "07:00",
            "morningTime": "07:00",
            "afternoonTime": "12:30",
            "eveningTime": "17:30",
            "nightTime": "21:30",
            "notifyMorning": True,
            "notifyAfternoon": True,
            "notifyEvening": True,
            "notifyNight": True,
            "timezone": "UTC",
        }

    return {
        "isSubscribed": True,
        "preferredTime": sub.preferred_time or "07:00",
        "morningTime": sub.morning_time or "07:00",
        "afternoonTime": sub.afternoon_time or "12:30",
        "eveningTime": sub.evening_time or "17:30",
        "nightTime": sub.night_time or "21:30",
        "notifyMorning": sub.notify_morning if sub.notify_morning is not None else True,
        "notifyAfternoon": sub.notify_afternoon if sub.notify_afternoon is not None else True,
        "notifyEvening": sub.notify_evening if sub.notify_evening is not None else True,
        "notifyNight": sub.notify_night if sub.notify_night is not None else True,
        "timezone": sub.timezone or "UTC",
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

    pref_time = req.morningTime or req.preferredTime or "07:00"

    if sub:
        sub.p256dh = req.keys.p256dh
        sub.auth = req.keys.auth
        sub.preferred_time = pref_time
        sub.morning_time = req.morningTime or pref_time
        sub.afternoon_time = req.afternoonTime or "12:30"
        sub.evening_time = req.eveningTime or "17:30"
        sub.night_time = req.nightTime or "21:30"
        if req.notifyMorning is not None:
            sub.notify_morning = req.notifyMorning
        if req.notifyAfternoon is not None:
            sub.notify_afternoon = req.notifyAfternoon
        if req.notifyEvening is not None:
            sub.notify_evening = req.notifyEvening
        if req.notifyNight is not None:
            sub.notify_night = req.notifyNight
        sub.timezone = req.timezone or "UTC"
        sub.is_active = True
    else:
        sub = PushSubscription(
            user_id=user.id,
            endpoint=req.endpoint,
            p256dh=req.keys.p256dh,
            auth=req.keys.auth,
            preferred_time=pref_time,
            morning_time=req.morningTime or pref_time,
            afternoon_time=req.afternoonTime or "12:30",
            evening_time=req.eveningTime or "17:30",
            night_time=req.nightTime or "21:30",
            notify_morning=req.notifyMorning if req.notifyMorning is not None else True,
            notify_afternoon=req.notifyAfternoon if req.notifyAfternoon is not None else True,
            notify_evening=req.notifyEvening if req.notifyEvening is not None else True,
            notify_night=req.notifyNight if req.notifyNight is not None else True,
            timezone=req.timezone or "UTC",
            is_active=True,
        )
        db.add(sub)

    db.commit()
    db.refresh(sub)
    return {"success": True, "subscription": sub.to_dict()}

@app.post("/api/notifications/preferences")
def update_notification_preferences(
    req: schemas.NotificationPreferencesUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    subs = db.query(PushSubscription).filter(
        PushSubscription.user_id == user.id,
        PushSubscription.is_active == True
    ).all()

    for sub in subs:
        if req.preferredTime is not None:
            sub.preferred_time = req.preferredTime
        if req.morningTime is not None:
            sub.morning_time = req.morningTime
        if req.afternoonTime is not None:
            sub.afternoon_time = req.afternoonTime
        if req.eveningTime is not None:
            sub.evening_time = req.eveningTime
        if req.nightTime is not None:
            sub.night_time = req.nightTime
        if req.notifyMorning is not None:
            sub.notify_morning = req.notifyMorning
        if req.notifyAfternoon is not None:
            sub.notify_afternoon = req.notifyAfternoon
        if req.notifyEvening is not None:
            sub.notify_evening = req.notifyEvening
        if req.notifyNight is not None:
            sub.notify_night = req.notifyNight
        if req.timezone is not None:
            sub.timezone = req.timezone

    db.commit()
    return {"success": True, "message": "Notification preferences updated successfully."}

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

@app.api_route("/api/cron/dispatch-notifications", methods=["GET", "POST"])
def cron_dispatch_notifications():
    """
    Webhook / Cron endpoint callable by Vercel Cron, external crons, or background workers.
    Dispatches pending scheduled time-block briefings.
    """
    dispatched = check_and_dispatch_scheduled_notifications()
    return {
        "success": True,
        "dispatchedAlerts": dispatched,
        "timestamp": datetime.utcnow().isoformat(),
    }

@app.post("/api/notifications/dispatch-all")
def manual_dispatch_all(
    user: User = Depends(get_current_user)
):
    dispatched = check_and_dispatch_scheduled_notifications()
    return {
        "success": True,
        "dispatchedAlerts": dispatched,
        "timestamp": datetime.utcnow().isoformat(),
    }

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

