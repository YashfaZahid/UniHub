import { useState } from "react";
import { createShop } from "../../api";
import "./CreateShop.css";

export default function CreateShop() {
  const categories = ["Food", "Fashion", "Electronics", "Services"];

  const [tagInput, setTagInput] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    tags: []
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const addTag = () => {
    if (!tagInput.trim()) return;

    setFormData({
      ...formData,
      tags: [...formData.tags, tagInput.trim()]
    });

    setTagInput("");
  };

  const removeTag = (index) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((_, i) => i !== index)
    });
  };

const handleSubmit = async (e) => {
  e.preventDefault();

  try {
    const token = localStorage.getItem("token");

    if (!token) {
      alert("Please login first");
      return;
    }

    const payload = {
      title: formData.title,
      description: formData.description,
      category: formData.category,
      tags: formData.tags
    };

    await createShop(payload, token);

    alert("Shop created successfully!");
    navigate('/feed');

  } catch (err) {
    const msg = err.response?.data?.error;

    if (msg === "Shop already exists") {
      alert("⚠️ You already have a shop.");
      navigate("/feed"); // or "/profile"
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
  }
};

  return (
    <div className="shop-container">
      <div className="shop-card">

        <h2 className="shop-title">Create Shop</h2>

        <input name="title" className="shop-input" placeholder="Shop Title" onChange={handleChange} />

        <input name="description" className="shop-input" placeholder="Description" onChange={handleChange} />

        <select name="category" className="shop-select" onChange={handleChange}>
          <option value="">Select Category</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <input
          className="shop-input"
          value={tagInput}
          placeholder="Add tag"
          onChange={(e) => setTagInput(e.target.value)}
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

        <button className="shop-button" onClick={handleSubmit}>
          Create Shop
        </button>

      </div>
    </div>
  );
}