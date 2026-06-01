"""Shared image URL and storage helpers for the Flask backend."""
import os
import uuid

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SHOP_UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads", "shops")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
PRODUCT_IMAGES_BUCKET = "product_images"
AVATARS_BUCKET = "avatars"
MAX_AVATAR_BYTES = 5 * 1024 * 1024

os.makedirs(SHOP_UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def normalize_image_url(image_url: str | None) -> str | None:
    if not image_url:
        return image_url
    image_url = image_url.strip()
    if image_url.startswith(("http://", "https://")):
        return image_url
    if image_url.startswith("/uploads/"):
        return image_url
    if image_url.startswith("uploads/"):
        return f"/{image_url}"
    return image_url


def storage_path_from_url(image_url: str) -> str | None:
    """Extract object path inside product_images bucket from a stored URL or path."""
    if not image_url:
        return None
    marker = f"/storage/v1/object/public/{PRODUCT_IMAGES_BUCKET}/"
    if marker in image_url:
        return image_url.split(marker, 1)[1]
    if image_url.startswith(f"{PRODUCT_IMAGES_BUCKET}/"):
        return image_url[len(f"{PRODUCT_IMAGES_BUCKET}/") :]
    return image_url.lstrip("/")


def upload_product_image(supabase_admin, product_id: str, file) -> tuple[str, str]:
    ext = file.filename.rsplit(".", 1)[1].lower()
    object_path = f"{product_id}/{uuid.uuid4().hex}.{ext}"
    file_bytes = file.read()
    content_type = file.content_type or f"image/{ext}"

    supabase_admin.storage.from_(PRODUCT_IMAGES_BUCKET).upload(
        object_path,
        file_bytes,
        {"content-type": content_type, "upsert": "false"},
    )

    public = supabase_admin.storage.from_(PRODUCT_IMAGES_BUCKET).get_public_url(object_path)
    public_url = public if isinstance(public, str) else getattr(public, "public_url", public)
    return object_path, public_url


def get_storage_public_url(supabase_admin, bucket: str, object_path: str) -> str:
    public = supabase_admin.storage.from_(bucket).get_public_url(object_path)
    return public if isinstance(public, str) else getattr(public, "public_url", str(public))


def upload_avatar(supabase_admin, user_id: str, file) -> str:
    """
    Upload avatar to avatars/{user_id}/avatar.{ext}.
    Storage policies should allow auth.uid() to write under their user_id folder.
  Returns public URL stored in profiles.profile_image.
    """
    ext = file.filename.rsplit(".", 1)[1].lower()
    object_path = f"{user_id}/avatar.{ext}"
    file_bytes = file.read()
    if len(file_bytes) > MAX_AVATAR_BYTES:
        raise ValueError("File too large (max 5MB)")
    content_type = file.content_type or f"image/{ext}"

    supabase_admin.storage.from_(AVATARS_BUCKET).upload(
        object_path,
        file_bytes,
        {"content-type": content_type, "upsert": "true"},
    )
    return get_storage_public_url(supabase_admin, AVATARS_BUCKET, object_path)
