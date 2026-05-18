import { useState } from "react";
import "./CreateRequest.css";

function CreateRequest({ setRequests }) {
  const [title, setTitle] = useState("");
  const [budget, setBudget] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title || !budget) {
      setMessage("Title and Budget are required ❗");
      return;
    }

    const newRequest = {
      title,
      budget,
      description,
      category,
      contact,
      status,
    };

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("http://localhost:5000/add-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newRequest),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("Your request has been sent successfully! ");

        // safer handling (works whether backend returns array or object)
        const newItem = Array.isArray(data.data) ? data.data[0] : data.data;

        setRequests((prev) => [...prev, newItem]);

        // clear form
        setTitle("");
        setBudget("");
        setDescription("");
        setCategory("");
        setContact("");
        setStatus("");
      } else {
        setMessage(data?.error || "Failed to send request ❌");
      }
    } catch (error) {
      console.log("Backend error:", error);
      setMessage("Server error ❌ Please try again");
    }

    setLoading(false);
  };

  return (
    <div className="form">
      <h3>Create Request</h3>

      <input
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <input
        placeholder="Budget"
        value={budget}
        onChange={(e) => setBudget(e.target.value)}
      />

      <input
        placeholder="Category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      />

      <input
        placeholder="Contact"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
      />

      <input
        placeholder="Status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      />

      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Submitting..." : "Submit Request"}
      </button>

      {message && <p style={{ marginTop: "10px" }}>{message}</p>}
    </div>
  );
}

export default CreateRequest;