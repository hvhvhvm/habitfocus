import os
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from pywebpush import webpush, WebPushException
from sqlalchemy.orm import Session
from backend.models import User, Task, Routine, PushSubscription

logger = logging.getLogger("lockin.notifications")

VAPID_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".vapid_keys.json")

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

    try:
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.primitives import serialization
        import base64

        private_key_obj = ec.generate_private_key(ec.SECP256R1())
        priv_pem = private_key_obj.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption()
        ).decode("utf-8")

        pub_raw = private_key_obj.public_key().public_bytes(
            serialization.Encoding.X962,
            serialization.PublicFormat.UncompressedPoint
        )
        pub_b64url = base64.urlsafe_b64encode(pub_raw).decode("utf-8").rstrip("=")

        keys_data = {
            "private_key": priv_pem,
            "public_key": pub_b64url,
            "claims_sub": env_claims
        }

        with open(VAPID_FILE, "w") as f:
            json.dump(keys_data, f, indent=2)

        return keys_data
    except Exception as err:
        logger.error(f"Error generating VAPID keys: {err}")
        return {
            "private_key": "-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg4u6p2eWz...\n-----END PRIVATE KEY-----",
            "public_key": "BOxf1pXc_cbPWB8_yr0DZvdzR_eH_Yfh8iPj1rLM1W_e_r_k2q9A2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9g",
            "claims_sub": "mailto:operator@lockin.app"
        }

def get_vapid_public_key() -> str:
    keys = get_or_create_vapid_keys()
    return keys["public_key"]

def calculate_random_morning_time() -> str:
    import random
    hour = random.randint(6, 8)
    minute = random.randint(0, 59)
    if hour == 6 and minute < 30:
        minute = random.randint(30, 59)
    return f"{hour:02d}:{minute:02d}"

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
