import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createShop, getPublicProfile, formatApiError } from "../../api";
import AppLayout from "../components/AppLayout";
import "./CreateShop.css";

const SHOP_CATEGORIES = [
  "",
  "Food & Beverages",
  "Fashion & Accessories",
  "Electronics",
  "Books & Stationery",
  "Handmade & Crafts",
  "Services",
  "Other",
];

function validateForm(formData) {
  const errors = {};
  const title = formData.title.trim();
  if (!title) {
    errors.title = "Shop title is required.";
  } else if (title.length < 2) {
    errors.title = "Shop title must be at least 2 characters.";
  } else if (title.length > 120) {
    errors.title = "Shop title must be 120 characters or fewer.";
  }

  if (formData.description.length > 2000) {
    errors.description = "Description must be 2000 characters or fewer.";
  }

  if (formData.phone.trim()) {
    const digits = formData.phone.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) {
      errors.phone = "Enter a valid phone number (7–15 digits).";
    }
  }

  if (formData.tags.length > 20) {
    errors.tags = "You can add up to 20 tags.";
  }

  return errors;
}

export default function CreateShop() {
  const navigate = useNavigate();
  const [tagInput, setTagInput] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    phone: "",
    category: "",
    tags: [],
  });

  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("supabase_access_token");
    const userId = localStorage.getItem("user_id");

    if (!token || !userId) {
      navigate("/login", { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const profile = await getPublicProfile(userId);
        if (!cancelled && profile.shops?.length > 0) {
          navigate("/profile", { replace: true });
        }
      } catch (err) {
        console.error("Failed to check existing shop:", err);
      } finally {
        if (!cancelled) setCheckingExisting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    setFormError("");
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFieldErrors((prev) => ({ ...prev, image: "Please choose an image file." }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors((prev) => ({ ...prev, image: "Image must be 5MB or smaller." }));
      return;
    }
    setFieldErrors((prev) => ({ ...prev, image: undefined }));
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const addTag = () => {
    const value = tagInput.trim();
    if (!value) return;
    if (formData.tags.includes(value)) {
      setFieldErrors((prev) => ({ ...prev, tags: "Tag already added." }));
      return;
    }
    if (formData.tags.length >= 20) {
      setFieldErrors((prev) => ({ ...prev, tags: "You can add up to 20 tags." }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      tags: [...prev.tags, value],
    }));
    setTagInput("");
    setFieldErrors((prev) => ({ ...prev, tags: undefined }));
  };

  const removeTag = (index) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem("token") || localStorage.getItem("supabase_access_token");

      if (!token) {
        setFormError("Please log in first.");
        navigate("/login");
        return;
      }

      const payload = new FormData();
      payload.append("title", formData.title.trim());
      payload.append("description", formData.description.trim());
      payload.append("phone", formData.phone.trim());
      payload.append("category", formData.category.trim());
      payload.append("tags", JSON.stringify(formData.tags));

      if (imageFile) {
        payload.append("image", imageFile);
      }

      const shop = await createShop(payload);

      navigate("/profile", {
        replace: true,
        state: { shopCreated: true, shopId: shop.id },
      });
    } catch (err) {
      const msg = err.response?.data?.error;

      if (msg === "Shop already exists") {
        setFormError("You already have a shop.");
        navigate("/profile", { replace: true });
        return;
      }

      if (err.response?.status === 401) {
        setFormError("Session expired. Please log in again.");
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }

      console.error("Create shop error:", err.response?.data || err.message);
      setFormError(formatApiError(err, "Error creating shop"));
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingExisting) {
    return (
      <AppLayout>
        <div className="shop-container">
          <p className="shop-loading">Loading…</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="shop-container">
        <form className="shop-card" onSubmit={handleSubmit} noValidate>
          <h2 className="shop-title">Create Shop</h2>
          <p className="shop-subtitle">Set up your campus storefront</p>

          {formError && (
            <p className="shop-form-error" role="alert">
              {formError}
            </p>
          )}

          <label className="shop-field-label" htmlFor="shop-title">
            Title <span className="shop-required">*</span>
          </label>
          <input
            id="shop-title"
            name="title"
            className="shop-input"
            placeholder="Shop title"
            value={formData.title}
            onChange={handleChange}
            required
            maxLength={120}
            aria-invalid={!!fieldErrors.title}
          />
          {fieldErrors.title && <p className="shop-field-error">{fieldErrors.title}</p>}

          <label className="shop-field-label" htmlFor="shop-description">
            Description
          </label>
          <textarea
            id="shop-description"
            name="description"
            className="shop-textarea"
            placeholder="What do you sell or offer?"
            value={formData.description}
            onChange={handleChange}
            maxLength={2000}
            rows={4}
          />
          {fieldErrors.description && (
            <p className="shop-field-error">{fieldErrors.description}</p>
          )}

          <label className="shop-field-label" htmlFor="shop-category">
            Category
          </label>
          <select
            id="shop-category"
            name="category"
            className="shop-select"
            value={formData.category}
            onChange={handleChange}
          >
            {SHOP_CATEGORIES.map((cat) => (
              <option key={cat || "none"} value={cat}>
                {cat || "Select a category (optional)"}
              </option>
            ))}
          </select>

          <label className="shop-field-label" htmlFor="shop-phone">
            Phone
          </label>
          <input
            id="shop-phone"
            name="phone"
            type="tel"
            className="shop-input"
            placeholder="Contact phone number"
            value={formData.phone}
            onChange={handleChange}
            aria-invalid={!!fieldErrors.phone}
          />
          {fieldErrors.phone && <p className="shop-field-error">{fieldErrors.phone}</p>}

          <label className="shop-field-label">Tags</label>
          <div className="tag-input-wrapper">
            <input
              className="shop-input"
              value={tagInput}
              placeholder="Add tag"
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
            />
            <button type="button" className="tag-add-btn" onClick={addTag}>
              Add
            </button>
          </div>
          {fieldErrors.tags && <p className="shop-field-error">{fieldErrors.tags}</p>}

          <div className="tag-container">
            {formData.tags.map((tag, i) => (
              <div key={i} className="tag" onClick={() => removeTag(i)}>
                {tag} ✕
              </div>
            ))}
          </div>

          <label className="shop-file-label">
            Shop image (optional)
            <input
              type="file"
              accept="image/*"
              className="shop-file-input"
              onChange={handleImageChange}
            />
          </label>
          {fieldErrors.image && <p className="shop-field-error">{fieldErrors.image}</p>}

          {imagePreview && (
            <img src={imagePreview} alt="Preview" className="shop-image-preview" />
          )}

          <button type="submit" className="shop-button shop-submit-btn" disabled={submitting}>
            {submitting ? "Creating…" : "Create Shop"}
          </button>

          <button
            type="button"
            className="shop-button shop-cancel-btn"
            onClick={() => navigate("/profile")}
            disabled={submitting}
          >
            Cancel
          </button>
        </form>
      </div>
    </AppLayout>
  );
}
