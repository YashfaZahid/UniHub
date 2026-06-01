"""Notification helpers — normalize rows and restrict supported types."""

ALLOWED_NOTIFICATION_TYPES = frozenset({
    "new_message",
    "new_order",
    "order_accepted",
    "order_rejected",
    "order_shipped",
    "order_completed",
})


def notification_reference_data(reference_id: str | None = None, **extra) -> dict:
    """Build notification payload data with order/message reference."""
    data = dict(extra)
    if reference_id:
        data["reference_id"] = reference_id
        if "order_id" not in data:
            data["order_id"] = reference_id
    return data


def is_allowed_notification_type(type_: str) -> bool:
    return type_ in ALLOWED_NOTIFICATION_TYPES


def normalize_notification(row: dict | None) -> dict | None:
    if not row:
        return None
    out = dict(row)
    read = out.get("read")
    if read is None:
        read = out.get("is_read")
    out["read"] = bool(read)
    out["body"] = (out.get("body") or out.get("message") or out.get("content") or "").strip()
    if not out.get("title"):
        out["title"] = out["type"].replace("_", " ").title() if out.get("type") else "Notification"
    data = out.get("data")
    if data is None:
        out["data"] = {}
    if not out.get("reference_id"):
        out["reference_id"] = out["data"].get("reference_id") or out["data"].get("order_id")
    return out
