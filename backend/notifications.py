"""Create in-app notifications via service-role client."""
from supabase_client import supabase_admin
from notification_utils import is_allowed_notification_type, notification_reference_data


def create_notification(user_id: str, type_: str, title: str, body: str = "", data: dict | None = None):
    """
    Best-effort notification insert. Tries common column layouts so marketplace flows
    (orders, messages) are never blocked.
    """
    if not user_id or not is_allowed_notification_type(type_):
        return None

    text = (body or title or "").strip()
    payload_data = data or {}
    ref_id = payload_data.get("reference_id") or payload_data.get("order_id")
    base = {
        "user_id": user_id,
        "type": type_,
        "title": title,
        "data": payload_data,
    }
    if ref_id:
        base["reference_id"] = ref_id

    payloads = [
        {**base, "body": text, "message": text, "read": False, "is_read": False},
        {**base, "body": text, "read": False},
        {**base, "message": text, "read": False},
        {**base, "message": text, "is_read": False},
        {**base, "title": title},
    ]

    last_error = None
    for payload in payloads:
        try:
            res = supabase_admin.table("notifications").insert(payload).execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            last_error = e
            continue

    if last_error:
        print(f"[NOTIFICATION] skipped ({type_}): {last_error}")
    return None
