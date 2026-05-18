import { useState } from "react";
import { createProduct } from "../../api";
import "./AddProduct.css";

export default function AddProduct({ shopId, onProductAdded, onClose }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price_or_range: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const product = await createProduct(shopId, formData);
      onProductAdded(product);
      setFormData({ title: "", description: "", price_or_range: "" });
      onClose();
    } catch (err) {
      if (err.response?.status === 401) {
        const reason = err.response?.data?.reason || err.response?.data?.error;
        alert(`Session expired or not logged in (${reason}). Please log in again.`);
        return;
      }
      const msg = err.response?.data?.error || "Failed to add product";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="add-product-overlay" onClick={onClose}>
      <div className="add-product-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="add-product-close" onClick={onClose}>
          ✕
        </button>
        <h3>Add Product / Service</h3>

        <form onSubmit={handleSubmit}>
          <input
            name="title"
            className="add-product-input"
            placeholder="Title"
            value={formData.title}
            onChange={handleChange}
            required
          />
          <textarea
            name="description"
            className="add-product-textarea"
            placeholder="Description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
          />
          <input
            name="price_or_range"
            className="add-product-input"
            placeholder="Price or service range (e.g. Rs 500 - Rs 2000)"
            value={formData.price_or_range}
            onChange={handleChange}
          />
          <button type="submit" className="add-product-submit" disabled={submitting}>
            {submitting ? "Adding..." : "Add Product"}
          </button>
        </form>
      </div>
    </div>
  );
}
