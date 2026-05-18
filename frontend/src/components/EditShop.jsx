import { useState, useEffect } from "react";
import { updateShop, getImageUrl } from "../../api";
import "./EditShop.css";

const PLACEHOLDER = "https://placehold.co/400x240/e8e0f0/6c63ff?text=No+Image";

export default function EditShop({ shop, shopId, onUpdated, onClose }) {
  const existingImage = shop.shop_images?.[0]?.image_url ?? "";
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState(shop.tags ?? []);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(
    getImageUrl(existingImage) ?? PLACEHOLDER
  );
  const [imageUrl, setImageUrl] = useState(
    existingImage.startsWith("http") ? existingImage : ""
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (imageFile && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imageFile, imagePreview]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImageUrl("");
    setImagePreview(URL.createObjectURL(file));
  };

  const addTag = () => {
    const value = tagInput.trim();
    if (!value || tags.includes(value)) return;
    setTags([...tags, value]);
    setTagInput("");
  };

  const removeTag = (index) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = new FormData();
      payload.append("shop_id", shopId);
      payload.append("tags", JSON.stringify(tags));

      if (imageFile) {
        payload.append("image", imageFile, imageFile.name);
      } else if (imageUrl.trim()) {
        payload.append("image_url", imageUrl.trim());
      }

      const updated = await updateShop(shopId, payload);
      onUpdated(updated);
    } catch (err) {
      if (err.response?.status === 401) {
        alert("Session expired. Please log in again.");
        return;
      }
      const detail = err.response?.data?.error || err.message;
      console.error("[EditShop] update failed:", err.response?.data || err);
      alert(detail || "Failed to update shop");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="edit-shop-overlay" onClick={onClose}>
      <div className="edit-shop-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="edit-shop-close" onClick={onClose}>
          ✕
        </button>
        <h3>Update Shop</h3>
        <p className="edit-shop-subtitle">Change your shop image and tags</p>

        <form onSubmit={handleSubmit}>
          <label className="edit-shop-label">Shop image</label>
          <img
            src={imagePreview}
            alt="Preview"
            className="edit-shop-preview"
            onError={(e) => {
              e.target.src = PLACEHOLDER;
            }}
          />
          <input
            type="file"
            accept="image/*"
            className="edit-shop-file"
            onChange={handleImageChange}
          />
          <input
            type="url"
            className="edit-shop-input"
            placeholder="Or paste image URL (https://...)"
            value={imageUrl}
            onChange={(e) => {
              setImageUrl(e.target.value);
              setImageFile(null);
              if (e.target.value.trim()) {
                setImagePreview(e.target.value.trim());
              } else {
                setImagePreview(getImageUrl(existingImage) ?? PLACEHOLDER);
              }
            }}
          />

          <label className="edit-shop-label">Tags</label>
          <div className="edit-shop-tag-row">
            <input
              className="edit-shop-input"
              value={tagInput}
              placeholder="Add a tag"
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
            <button type="button" className="edit-shop-tag-add" onClick={addTag}>
              Add
            </button>
          </div>
          <div className="edit-shop-tags">
            {tags.map((tag, i) => (
              <span key={i} className="edit-shop-tag" onClick={() => removeTag(i)}>
                {tag} ✕
              </span>
            ))}
          </div>
          {tags.length === 0 && (
            <p className="edit-shop-tags-empty">No tags yet — add some above</p>
          )}

          <div className="edit-shop-actions">
            <button
              type="button"
              className="edit-shop-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="edit-shop-save" disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
