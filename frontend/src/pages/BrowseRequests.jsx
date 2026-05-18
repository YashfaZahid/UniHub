import { useEffect, useState } from "react";
import "./BrowseRequests.css";

function BrowseRequests() {
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch("http://127.0.0.1:5000/get-requests")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setRequests(data.data);
        }
      })
      .catch(err => console.log(err));
  }, []);

  return (
    <div className="browse-container">
      <h1 className="title">Browse Requests</h1>

      <div className="grid">
        {requests.map((req) => (
          <div
            key={req.id}
            className="card"
            onClick={() => setSelected(req)}
          >
            <h3>{req.title}</h3>
            <p className="category">{req.category}</p>
            <p className="budget">Rs {req.budget}</p>
            <span className="status">{req.status}</span>
          </div>
        ))}
      </div>

      {selected && (
        <div className="overlay">
          <div className="modal">
            <h2>{selected.title}</h2>
            <p><b>Description:</b> {selected.description}</p>
            <p><b>Category:</b> {selected.category}</p>
            <p><b>Budget:</b> Rs {selected.budget}</p>
            <p><b>Contact:</b> {selected.contact}</p>

            <button className="closeBtn" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BrowseRequests;