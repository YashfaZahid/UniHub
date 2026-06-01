"""Message helpers — schema uses `content`; frontend may use `body` as alias."""
from datetime import datetime, timezone

from supabase_client import supabase_admin


def message_text(row: dict | None) -> str:
    if not row:
        return ""
    return (row.get("content") or row.get("body") or "").strip()


def normalize_message(row: dict | None) -> dict | None:
    if not row:
        return row
    text = message_text(row)
    row = dict(row)
    row["content"] = text
    row["body"] = text
    return row


def insert_message(conversation_id: str, sender_id: str, text: str) -> dict:
    """Insert a message; tries `content` first (project schema), then `body`."""
    text = (text or "").strip()
    if not text:
        raise ValueError("Message cannot be empty")

    attempts = [
        {"conversation_id": conversation_id, "sender_id": sender_id, "content": text},
        {
            "conversation_id": conversation_id,
            "sender_id": sender_id,
            "body": text,
            "read": False,
        },
    ]
    last_error = None
    for payload in attempts:
        try:
            res = supabase_admin.table("messages").insert(payload).execute()
            if res.data:
                return normalize_message(res.data[0])
        except Exception as e:
            last_error = e
            continue
    raise Exception(str(last_error) if last_error else "Failed to send message")


def update_conversation_after_message(conversation_id: str, preview: str) -> None:
    """Best-effort conversation metadata update."""
    preview = (preview or "")[:200]
    updates = [
        {
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "last_message_preview": preview,
        },
        {"updated_at": datetime.now(timezone.utc).isoformat()},
    ]
    for payload in updates:
        try:
            supabase_admin.table("conversations").update(payload).eq(
                "id", conversation_id
            ).execute()
            return
        except Exception:
            continue


def count_unread_messages(conversation_id: str, reader_id: str) -> int:
    """Count messages from the other participant that are unread."""
    for field in ("read", "is_read"):
        try:
            res = (
                supabase_admin.table("messages")
                .select("id", count="exact")
                .eq("conversation_id", conversation_id)
                .neq("sender_id", reader_id)
                .eq(field, False)
                .execute()
            )
            return res.count or 0
        except Exception:
            continue
    return 0


def mark_messages_read(conversation_id: str, reader_id: str) -> None:
    """Best-effort mark messages as read for the other participant's messages."""
    for field, value in (("read", True), ("is_read", True)):
        try:
            supabase_admin.table("messages").update({field: value}).eq(
                "conversation_id", conversation_id
            ).neq("sender_id", reader_id).execute()
            return
        except Exception:
            continue
