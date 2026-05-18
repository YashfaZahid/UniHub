import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createShop } from "../../api";
import "./CreateShop.css";

export default function CreateShop() {
  const navigate = useNavigate();
  const categories = ["Food", "Fashion", "Electronics", "Services"];

  const [tagInput, setTagInput] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    phone: "",
    tags: [],
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    setFormData({
      ...formData,
      tags: [...formData.tags, tagInput.trim()],
    });
    setTagInput("");
  };

  const removeTag = (index) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        alert("Please login first");
        navigate("/login");
        return;
      }

      const payload = new FormData();
      payload.append("title", formData.title);
      payload.append("description", formData.description);
      payload.append("category", formData.category);
      payload.append("phone", formData.phone);
      payload.append("tags", JSON.stringify(formData.tags));

      if (imageFile) {
        payload.append("image", imageFile);
      }

      await createShop(payload);

      alert("Shop created successfully!");
      navigate("/feed");
    } catch (err) {
      const msg = err.response?.data?.error;

      if (msg === "Shop already exists") {
        alert("You already have a shop.");
        navigate("/feed");
        return;
      }

      if (err.response?.status === 401) {
        alert("Session expired. Please login again.");
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }

      console.log("Create shop error:", err.response?.data || err.message);
      alert("Error creating shop");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="shop-container">
      <form className="shop-card" onSubmit={handleSubmit}>
        <h2 className="shop-title">Create Shop</h2>

        <input
          name="title"
          className="shop-input"
          placeholder="Shop Title"
          value={formData.title}
          onChange={handleChange}
          required
        />

        <input
          name="description"
          className="shop-input"
          placeholder="Description"
          value={formData.description}
          onChange={handleChange}
        />

        <input
          name="phone"
          className="shop-input"
          placeholder="Contact Phone Number"
          value={formData.phone}
          onChange={handleChange}
        />

        <select
          name="category"
          className="shop-select"
          value={formData.category}
          onChange={handleChange}
          required
        >
          <option value="">Select Category</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label className="shop-file-label">
          Shop Image (main)
          <input
            type="file"
            accept="image/*"
            className="shop-file-input"
            onChange={handleImageChange}
          />
        </label>

        {imagePreview && (
          <img src={imagePreview} alt="Preview" className="shop-image-preview" />
        )}

        <input
          className="shop-input"
          value={tagInput}
          placeholder="Add tag"
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
        />

        <button type="button" className="shop-button" onClick={addTag}>
          Add Tag
        </button>

        <div className="tag-container">
          {formData.tags.map((tag, i) => (
            <div key={i} className="tag" onClick={() => removeTag(i)}>
              {tag} ✕
            </div>
          ))}
        </div>

        <button type="submit" className="shop-button" disabled={submitting}>
          {submitting ? "Creating..." : "Create Shop"}
        </button>
      </form>
    </div>
  );
}