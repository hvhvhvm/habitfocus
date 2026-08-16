import os
import httpx
from dotenv import load_dotenv
from datetime import datetime
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User, Pillar, Task, Routine, ProteinLog

load_dotenv(".env.local")
load_dotenv()

security = HTTPBearer()

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL") or ""
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY") or ""
SUPABASE_HOST = SUPABASE_URL.rstrip("/").replace("https://", "").replace("http://", "")


def check_and_perform_rollover(user: User, db: Session, local_date: str) -> bool:
    if not local_date or not local_date.strip():
        return False

    if not user.last_active_date:
        user.last_active_date = local_date
        db.commit()
        db.refresh(user)
        return False

    if user.last_active_date == local_date:
        return False

    # The day has changed!
    try:
        last_date = datetime.strptime(user.last_active_date, "%Y-%m-%d")
        curr_date = datetime.strptime(local_date, "%Y-%m-%d")
        days_passed = (curr_date - last_date).days
    except Exception:
        days_passed = 1

    if days_passed <= 0:
        # Clock adjustment or out of order dates, just update last active date
        user.last_active_date = local_date
        db.commit()
        db.refresh(user)
        return False

    # Execute rollover
    execute_rollover_logic(user, db, days_passed, local_date)
    return True


def execute_rollover_logic(user: User, db: Session, days_passed: int, local_date: str):
    from backend.models import TaskLog, RoutineLog

    # Date being rolled over from (yesterday from user's perspective)
    rollover_date = user.last_active_date or local_date

    # 1. Determine if streak is maintained from the last active day
    user_tasks = db.query(Task).filter(Task.user_id == user.id).all()
    completed_tasks = [t for t in user_tasks if t.completed]
    total_tasks = len(user_tasks)

    # Streak is maintained if days_passed is exactly 1, and the user completed at least 1 task
    # (or if they had 0 tasks).
    is_streak_maintained = False
    if days_passed == 1:
        if total_tasks == 0:
            is_streak_maintained = True
        elif len(completed_tasks) > 0:
            is_streak_maintained = True

    if is_streak_maintained:
        user.streak_days += 1
    else:
        user.streak_days = 0

    # 2. Advance the day number
    user.day_number += days_passed

    # 3. Record TaskLog entries for completed tasks before resetting
    for task in completed_tasks:
        existing_log = db.query(TaskLog).filter(
            TaskLog.task_id == task.id,
            TaskLog.completed_date == rollover_date
        ).first()
        if not existing_log:
            log_entry = TaskLog(
                task_id=task.id,
                user_id=user.id,
                completed_date=rollover_date,
                points_awarded=task.points,
            )
            db.add(log_entry)

    # 4. Reset task completions
    for task in user_tasks:
        task.completed = False

    # 5. Record RoutineLog entries for completed routines before resetting
    user_routines = db.query(Routine).filter(Routine.user_id == user.id).all()
    completed_routines = [r for r in user_routines if r.completed]
    for routine in completed_routines:
        existing_log = db.query(RoutineLog).filter(
            RoutineLog.routine_id == routine.id,
            RoutineLog.completed_date == rollover_date
        ).first()
        if not existing_log:
            log_entry = RoutineLog(
                routine_id=routine.id,
                user_id=user.id,
                completed_date=rollover_date,
                points_awarded=75,
            )
            db.add(log_entry)

    # 6. Reset routine completions and subtasks
    for routine in user_routines:
        routine.completed = False
        if routine.subtasks:
            updated_subtasks = []
            for st in routine.subtasks:
                st_copy = dict(st)
                st_copy["completed"] = False
                updated_subtasks.append(st_copy)
            routine.subtasks = updated_subtasks

    # 7. Tag protein logs with their date so history is preserved (do NOT delete them)
    untagged_protein_logs = db.query(ProteinLog).filter(
        ProteinLog.user_id == user.id,
        (ProteinLog.logged_date == None) | (ProteinLog.logged_date == "")
    ).all()
    for plog in untagged_protein_logs:
        plog.logged_date = rollover_date

    # 8. Update last active date
    user.last_active_date = local_date

    db.commit()
    db.refresh(user)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    token = credentials.credentials
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth service is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.",
        )

    # Verify Supabase access token via Supabase Auth REST API
    auth_url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/user"
    headers = {
        "Authorization": f"Bearer {token}",
        "apikey": SUPABASE_ANON_KEY,
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
            res = await client.get(auth_url, headers=headers, timeout=10.0)
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "FastAPI could not reach Supabase Auth to verify your session. "
                f"Target: {SUPABASE_HOST or 'missing SUPABASE_URL'}. "
                "Check that SUPABASE_URL/SUPABASE_ANON_KEY are set on the backend, "
                "the backend process has internet access, and the Supabase project is reachable. "
                f"Technical detail: {type(e).__name__}: {str(e)}"
            ),
        )

    if res.status_code != 200:
        response_text = res.text[:300]
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "FastAPI reached Supabase Auth, but Supabase rejected the access token. "
                "Please sign in again. "
                f"Supabase status: {res.status_code}. Response: {response_text}"
            ),
            headers={"WWW-Authenticate": "Bearer"},
        )

    data = res.json()
    user_id = data.get("id")
    email = data.get("email")
    metadata = data.get("user_metadata", {})
    name = (
        metadata.get("name")
        or metadata.get("full_name")
        or (email.split("@")[0] if email else "Lock-In Operator")
    )

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not extract user identity from Supabase token.",
        )

    # Fetch or create user record in the database
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = User(
            id=user_id,
            email=email or "operator@lockin.app",
            name=name,
            avatar="⚡",
            day_number=1,
            streak_days=1,
            total_days_goal=90,
            current_level=4,
            points=1250,
            protein_goal=160,
            last_active_date=""
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Seed initial pillars & tasks for new user
        seed_user_defaults(db, user_id)

    # Execute rollover check if X-Local-Date header is present
    local_date = request.headers.get("x-local-date") or ""
    if local_date:
        check_and_perform_rollover(user, db, local_date)

    return user


def seed_user_defaults(db: Session, user_id: str):
    p1 = Pillar(id=f"p1_{user_id}", user_id=user_id, name="Physical Mastery", icon="💪", color="#3ECF8E", daily_goal="Workout / 160g Protein")
    p2 = Pillar(id=f"p2_{user_id}", user_id=user_id, name="Deep Focus & Code", icon="🧠", color="#6BA6FF", daily_goal="4 Hours Deep Work")
    p3 = Pillar(id=f"p3_{user_id}", user_id=user_id, name="Mindset & Discipline", icon="🔥", color="#F5A623", daily_goal="Cold Shower / Reading")
    db.add_all([p1, p2, p3])
    db.commit()

    t1 = Task(id=f"t1_{user_id}", user_id=user_id, pillar_id=p1.id, time_block="morning", name="Hydrate 1L Water & Electromix", points=30)
    t2 = Task(id=f"t2_{user_id}", user_id=user_id, pillar_id=p2.id, time_block="morning", name="90-Min Uninterrupted Deep Work Block", points=100)
    t3 = Task(id=f"t3_{user_id}", user_id=user_id, pillar_id=p1.id, time_block="afternoon", name="Hit 160g Daily Protein Target", points=50)
    t4 = Task(id=f"t4_{user_id}", user_id=user_id, pillar_id=p3.id, time_block="evening", name="Evening Review & Tomorrow Planning", points=40)
    db.add_all([t1, t2, t3, t4])

    r1 = Routine(
        id=f"r1_{user_id}",
        user_id=user_id,
        name="Morning Lock-In Protocol",
        icon="🌅",
        duration_mins=25,
        total_steps=4,
        completed=False,
        subtasks=[
            {"id": "st1", "text": "500ml Cold Water + Salt", "duration": "2 mins", "completed": False},
            {"id": "st2", "text": "5-Min Sunlight Exposure", "duration": "5 mins", "completed": False},
            {"id": "st3", "text": "Cold Shower", "duration": "5 mins", "completed": False},
            {"id": "st4", "text": "Review Top 3 Goals", "duration": "3 mins", "completed": False},
        ]
    )
    db.add(r1)
    db.commit()
