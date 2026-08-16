import os
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from pywebpush import webpush, WebPushException
from sqlalchemy.orm import Session
from backend.models import User, Task, Routine, PushSubscription, ProteinLog

logger = logging.getLogger("lockin.notifications")

VAPID_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".vapid_keys.json")

DEFAULT_VAPID_PUB = "BMZiB3VFUwDpd0RUTX24kTrzKVQlrK2Ob1aOW3GS5kFzH2bGFUJA2_Gznq53tab7IAzHAAxZ-wkYWmC5t1YsZjY"
DEFAULT_VAPID_PRIV = """-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgclWdnoAQqQS7hbYn
tz1UI9CFL5wpgWYOs3BovfI37DihRANCAATGYgd1RVMA6XdEVE19uJE68ylUJayt
jm9WjltxkuZBcx9mxhVCQNvxs56ud7Wm+yAMxwAMWfsJGFpgubdWLGY2
-----END PRIVATE KEY-----"""

def get_or_create_vapid_keys() -> Dict[str, str]:
    env_priv = os.getenv("VAPID_PRIVATE_KEY")
    env_pub = os.getenv("VAPID_PUBLIC_KEY")
    env_claims = os.getenv("VAPID_CLAIMS_SUB", "mailto:operator@lockin.app")

    if env_priv and env_pub:
        return {
            "private_key": env_priv,
            "public_key": env_pub,
            "claims_sub": env_claims,
        }

    if os.path.exists(VAPID_FILE):
        try:
            with open(VAPID_FILE, "r") as f:
                data = json.load(f)
                if data.get("private_key") and data.get("public_key"):
                    return data
        except Exception as e:
            logger.warning(f"Failed to read {VAPID_FILE}: {e}")

    # Fallback to persistent deterministic keypair (ensures push remains valid across ephemeral restarts)
    return {
        "private_key": DEFAULT_VAPID_PRIV,
        "public_key": DEFAULT_VAPID_PUB,
        "claims_sub": env_claims
    }

def get_vapid_public_key() -> str:
    keys = get_or_create_vapid_keys()
    return keys["public_key"]

TIME_BLOCK_METADATA = {
    "morning": {
        "name": "Morning Lock-In",
        "icon": "☀️",
        "quotes": [
            "Win the morning, win the day. Eliminate distractions and execute.",
            "Discipline is choosing between what you want now and what you want most.",
            "The secret of getting ahead is getting started. Deep work begins now.",
            "Energy flows where attention goes. Protect your morning focus."
        ],
    },
    "afternoon": {
        "name": "Afternoon Momentum",
        "icon": "✨",
        "quotes": [
            "Midday check-in: Push through resistance. Champions build momentum when others fade.",
            "Consistency over intensity. Keep stacking daily wins.",
            "Don't stop when you're tired; stop when you're done.",
            "Small daily improvements over time lead to stunning transformations."
        ],
    },
    "evening": {
        "name": "Evening Surge",
        "icon": "🌇",
        "quotes": [
            "Finish the day strong. Review your goals and close all open loops.",
            "Discipline in the evening sets the foundation for tomorrow's victory.",
            "How you finish today determines how you start tomorrow.",
            "Reflect, review, and lock in your evening routines."
        ],
    },
    "night": {
        "name": "Night Protocol & Recovery",
        "icon": "🌙",
        "quotes": [
            "Rest is fuel for tomorrow's battle. Wind down and recharge.",
            "Celebrate today's wins, let go of the friction, and prepare your mindset.",
            "Sleep is the ultimate performance enhancer. Lock in your sleep protocol.",
            "Another day locked in. Recharge your mind for tomorrow."
        ],
    },
}

def calculate_random_morning_time() -> str:
    import random
    hour = random.randint(6, 8)
    minute = random.randint(0, 59)
    if hour == 6 and minute < 30:
        minute = random.randint(30, 59)
    return f"{hour:02d}:{minute:02d}"

def build_time_block_briefing_payload(user: User, db: Session, time_block: str = "morning") -> Dict[str, Any]:
    import random
    tb_key = time_block.lower() if time_block else "morning"
    if tb_key not in TIME_BLOCK_METADATA:
        tb_key = "morning"

    meta = TIME_BLOCK_METADATA[tb_key]
    quote = random.choice(meta["quotes"])

    tasks = db.query(Task).filter(Task.user_id == user.id).all()
    uncompleted_tasks = [t for t in tasks if not t.completed]
    block_tasks = [t for t in uncompleted_tasks if (t.time_block or 'morning').lower() == tb_key]

    total_tasks = len(tasks)
    day_num = user.day_number or 1
    total_days = user.total_days_goal or 90
    streak = user.streak_days or 1

    # Fetch today's protein logs for user
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    protein_goal = user.protein_goal or 140
    protein_logs = db.query(ProteinLog).filter(
        ProteinLog.user_id == user.id,
        (ProteinLog.logged_date == today_str) | (ProteinLog.logged_date == "") | (ProteinLog.logged_date == None)
    ).all()
    total_protein = sum(p.protein_grams for p in protein_logs)
    rem_protein = max(0, protein_goal - total_protein)

    if tb_key == "morning":
        protein_line = f"🥩 Protein Goal: {protein_goal}g"
    elif tb_key == "afternoon":
        if total_protein >= protein_goal:
            protein_line = f"🥩 Protein: {total_protein}g/{protein_goal}g (Goal Met! 🏆)"
        else:
            protein_line = f"🥩 Protein: {total_protein}g/{protein_goal}g ({rem_protein}g left for lunch/snacks)"
    elif tb_key == "evening":
        if total_protein >= protein_goal:
            protein_line = f"🥩 Protein: {total_protein}g/{protein_goal}g (Goal Met! 🏆)"
        else:
            protein_line = f"🥩 Protein: {total_protein}g/{protein_goal}g ({rem_protein}g left — time for dinner/shake!)"
    else:  # night
        if total_protein >= protein_goal:
            protein_line = f"🥩 Protein: {total_protein}g/{protein_goal}g (+20 PTS Earned! 🏆)"
        else:
            protein_line = f"🥩 Protein: {total_protein}g/{protein_goal}g ({rem_protein}g remaining today)"

    title = f"{meta['icon']} {meta['name']} — Day {day_num} of {total_days}"

    task_count = len(block_tasks)
    total_remaining = len(uncompleted_tasks)

    if total_tasks == 0:
        body = (
            f"Day {day_num} Protocol ({meta['icon']} {meta['name']}): 0 tasks set.\n"
            f"{protein_line}\n"
            f"💡 \"{quote}\"\n"
            f"🔥 Streak: {streak} days. Open Lock-In to set habits!"
        )
    elif total_remaining == 0:
        body = (
            f"Day {day_num}: All tasks 100% completed today!\n"
            f"{protein_line}\n"
            f"💡 \"{quote}\"\n"
            f"🔥 Streak: {streak} days active. Outstanding discipline!"
        )
    elif task_count == 0:
        body = (
            f"Day {day_num}: All {meta['name']} tasks finished! ({total_remaining} left in other blocks).\n"
            f"{protein_line}\n"
            f"💡 \"{quote}\"\n"
            f"🔥 Streak: {streak} days active."
        )
    else:
        task_preview = "\n".join([f"• {t.name}" for t in block_tasks[:2]])
        if task_count > 2:
            task_preview += f"\n• +{task_count - 2} more"

        body = (
            f"Day {day_num}: You have {task_count} {tb_key.capitalize()} task{'s' if task_count != 1 else ''} ({total_remaining} left today):\n"
            f"{task_preview}\n"
            f"{protein_line}\n"
            f"💡 \"{quote}\"\n"
            f"🔥 Streak: {streak} days. Lock in!"
        )

    return {
        "title": title,
        "body": body,
        "icon": "/icon-192.png",
        "badge": "/icon-192.png",
        "dayNumber": day_num,
        "totalDays": total_days,
        "streakDays": streak,
        "timeBlock": tb_key,
        "blockTasksCount": task_count,
        "remainingTasks": total_remaining,
        "quote": quote,
        "url": "/",
        "timestamp": datetime.utcnow().isoformat(),
    }

def build_daily_briefing_payload(user: User, db: Session) -> Dict[str, Any]:
    tasks = db.query(Task).filter(Task.user_id == user.id).all()
    uncompleted_tasks = [t for t in tasks if not t.completed]
    total_tasks = len(tasks)
    day_num = user.day_number or 1
    total_days = user.total_days_goal or 90
    streak = user.streak_days or 1

    # Count tasks by time block
    morning_tasks = [t for t in uncompleted_tasks if (t.time_block or 'morning').lower() == 'morning']
    afternoon_tasks = [t for t in uncompleted_tasks if (t.time_block or '').lower() == 'afternoon']
    evening_tasks = [t for t in uncompleted_tasks if (t.time_block or '').lower() == 'evening']
    night_tasks = [t for t in uncompleted_tasks if (t.time_block or '').lower() == 'night']

    m_count = len(morning_tasks)
    a_count = len(afternoon_tasks)
    e_count = len(evening_tasks)
    n_count = len(night_tasks)
    remaining_count = len(uncompleted_tasks)

    title = f"⚡ Day {day_num} of {total_days} Protocol"

    if total_tasks == 0:
        body = f"Day {day_num} begins! 0 tasks set.\n☀️ Morning: 0 | ✨ Aft: 0 | 🌇 Eve: 0 | 🌙 Night: 0\n🔥 Streak: {streak} days. Open Lock-In to add habits!"
    elif remaining_count == 0:
        body = f"Day {day_num}: All {total_tasks} tasks locked in for today! 100% complete.\n🔥 Streak: {streak} days active. Incredible discipline!"
    else:
        body = (
            f"Day {day_num}: You have {remaining_count} tasks scheduled today:\n"
            f"☀️ Morning: {m_count} task{'s' if m_count != 1 else ''}\n"
            f"✨ Afternoon: {a_count} task{'s' if a_count != 1 else ''}\n"
            f"🌇 Evening: {e_count} task{'s' if e_count != 1 else ''}\n"
            f"🌙 Night: {n_count} task{'s' if n_count != 1 else ''}\n"
            f"🔥 Streak: {streak} days active. Time to lock in!"
        )

    return {
        "title": title,
        "body": body,
        "icon": "/icon-192.png",
        "badge": "/icon-192.png",
        "dayNumber": day_num,
        "totalDays": total_days,
        "streakDays": streak,
        "totalTasks": total_tasks,
        "remainingTasks": remaining_count,
        "timeBlocks": {
            "morning": m_count,
            "afternoon": a_count,
            "evening": e_count,
            "night": n_count,
        },
        "url": "/",
        "timestamp": datetime.utcnow().isoformat(),
    }

def send_push_notification(subscription: PushSubscription, payload: Dict[str, Any]) -> bool:
    vapid_keys = get_or_create_vapid_keys()
    sub_info = {
        "endpoint": subscription.endpoint,
        "keys": {
            "p256dh": subscription.p256dh,
            "auth": subscription.auth,
        }
    }

    try:
        webpush(
            subscription_info=sub_info,
            data=json.dumps(payload),
            vapid_private_key=vapid_keys["private_key"],
            vapid_claims={"sub": vapid_keys["claims_sub"]},
            ttl=86400,
        )
        return True
    except WebPushException as ex:
        logger.warning(f"WebPush error: {ex}")
        if hasattr(ex, "response") and ex.response is not None and ex.response.status_code in (404, 410):
            subscription.is_active = False
        return False
    except Exception as err:
        logger.error(f"Error sending push: {err}")
        return False

def send_daily_briefing_to_user(user: User, db: Session) -> Dict[str, Any]:
    subs = db.query(PushSubscription).filter(
        PushSubscription.user_id == user.id,
        PushSubscription.is_active == True
    ).all()

    payload = build_daily_briefing_payload(user, db)
    sent_count = 0

    for sub in subs:
        if send_push_notification(sub, payload):
            sent_count += 1

    db.commit()
    return {
        "success": True,
        "sentCount": sent_count,
        "totalSubscriptions": len(subs),
        "payload": payload,
    }

def send_time_block_briefing_to_user(user: User, db: Session, time_block: str = "morning") -> Dict[str, Any]:
    subs = db.query(PushSubscription).filter(
        PushSubscription.user_id == user.id,
        PushSubscription.is_active == True
    ).all()

    payload = build_time_block_briefing_payload(user, db, time_block)
    sent_count = 0

    for sub in subs:
        if send_push_notification(sub, payload):
            sent_count += 1

    db.commit()
    return {
        "success": True,
        "sentCount": sent_count,
        "totalSubscriptions": len(subs),
        "payload": payload,
    }
