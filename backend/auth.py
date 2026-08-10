import os
import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User, Pillar, Task, Routine

security = HTTPBearer()

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL") or ""
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY") or ""

async def get_current_user(
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

    user_id = None
    email = None
    name = "Lock-In Operator"

    # Verify token with Supabase Auth API if credentials are provided and token is a Supabase token
    is_local_token = token.startswith("demo_token_") or ":" in token or token.startswith("usr_")
    if SUPABASE_URL and SUPABASE_ANON_KEY and not is_local_token:
        auth_url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/user"
        headers = {
            "Authorization": f"Bearer {token}",
            "apikey": SUPABASE_ANON_KEY,
        }
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(auth_url, headers=headers, timeout=5.0)
                if res.status_code == 200:
                    data = res.json()
                    user_id = data.get("id")
                    email = data.get("email")
                    metadata = data.get("user_metadata", {})
                    name = metadata.get("name") or metadata.get("full_name") or (email.split("@")[0] if email else "Lock-In Operator")
                else:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid or expired authentication token",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to connect to Auth service",
            )
    else:
        # Fallback for demo tokens or local tokens without Supabase credentials
        if token.startswith("demo_token_"):
            user_id = "demo_user_123"
            email = "demo@lockin.app"
            name = "Lock-In Operator (Demo)"
        elif ":" in token:
            parts = token.split(":")
            user_id = parts[0]
            email = parts[1] if len(parts) > 1 else f"{user_id}@lockin.app"
            name = email.split("@")[0].title()
        else:
            user_id = token if token.startswith("usr_") else f"user_{token[:16]}"
            email = f"{user_id}@lockin.app"
            name = "Lock-In Operator"

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not verify user identity from token",
        )

    # Fetch user from SQLAlchemy database or create initial default profile if new user
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
            protein_goal=160
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Seed initial pillars & tasks for new user
        seed_user_defaults(db, user_id)

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
