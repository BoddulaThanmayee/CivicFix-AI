import { useCallback, useEffect, useState } from "react";
import "./OfficerDashboard.css";

const API_BASE_URL = "https://civicfix-ai-yovc.onrender.com";
const STATUSES = ["Assigned", "Under Review", "In Progress", "Resolved"];

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function OfficerDashboard({ officer, onLogout, onToggleTheme, theme }) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState("");

  const loadComplaints = useCallback(async () => {
    if (!officer?.id) {
      setError("Officer session is missing. Please log in again.");
      setLoading(false);
      return;
    }
    try {
      setError("");
      const response = await fetch(
        `${API_BASE_URL}/officer-complaints?officer_id=${encodeURIComponent(officer.id)}`
      );
      const data = await response.json();
      if (!response.ok || !Array.isArray(data)) {
        throw new Error(data.message || "Could not load assigned complaints.");
      }
      setComplaints(data);
    } catch (err) {
      setError(err.message || "Unable to connect to CivicFix AI backend.");
    } finally {
      setLoading(false);
    }
  }, [officer?.id]);

  useEffect(() => { loadComplaints(); }, [loadComplaints]);

  const updateStatus = async (complaintId, status) => {
    setBusyId(complaintId);
    setNotice("");
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/complaints/${complaintId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Status update failed.");
      }
      setNotice(`Complaint CIVIC-${String(complaintId).padStart(4, "0")} updated to ${status}.`);
      await loadComplaints();
    } catch (err) {
      setError(err.message || "Unable to update complaint.");
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = complaints.filter((c) => c.status !== "Resolved").length;
  const resolvedCount = complaints.filter((c) => c.status === "Resolved").length;

  return (
    <div className="officer-page">
      <header className="officer-topbar">
        <div className="officer-brand">
          <span className="officer-brand-icon">C</span>
          <div><strong>CivicFix AI</strong><small>Officer Workspace</small></div>
        </div>
        <div className="officer-top-actions">
          <button className="officer-secondary-btn" onClick={onToggleTheme}>
            {theme === "light" ? "🌙 Dark mode" : "☀️ Light mode"}
          </button>
          <button className="officer-logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </header>

      <main className="officer-main">
        <section className="officer-welcome">
          <div>
            <p className="officer-eyebrow">OFFICER DASHBOARD</p>
            <h1>Welcome, {officer?.name || "Officer"}</h1>
            <p>Review complaints assigned to you and keep citizens informed about progress.</p>
          </div>
          <button className="officer-refresh-btn" onClick={loadComplaints}>↻ Refresh</button>
        </section>

        <section className="officer-profile">
          <div className="officer-avatar">{(officer?.name || "O").charAt(0).toUpperCase()}</div>
          <div className="officer-profile-info">
            <h2>{officer?.name}</h2>
            <p>{officer?.designation} · {officer?.department}</p>
            <p>📞 {officer?.phone || "Contact not available"}</p>
          </div>
          <span className="officer-role-pill">Verified demo session</span>
        </section>

        <section className="officer-stats">
          <article><span>Assigned complaints</span><strong>{complaints.length}</strong></article>
          <article><span>Active cases</span><strong>{activeCount}</strong></article>
          <article><span>Resolved cases</span><strong>{resolvedCount}</strong></article>
        </section>

        {notice && <div className="officer-notice">{notice}</div>}
        {error && <div className="officer-error">{error}</div>}

        <section className="officer-complaint-section">
          <div className="officer-section-heading">
            <div><h2>My Assigned Complaints</h2><p>Only complaints assigned to your officer account are listed.</p></div>
          </div>

          {loading ? (
            <div className="officer-empty">Loading assigned complaints…</div>
          ) : complaints.length === 0 ? (
            <div className="officer-empty">
              <span>📋</span><h3>No assigned complaints yet</h3>
              <p>When a complaint is assigned to you, it will appear here.</p>
            </div>
          ) : (
            <div className="officer-complaint-list">
              {complaints.map((complaint) => (
                <article className="officer-complaint-card" key={complaint.id}>
                  <div className="officer-complaint-card-head">
                    <div>
                      <span className="officer-complaint-id">CIVIC-{String(complaint.id).padStart(4, "0")}</span>
                      <h3>{complaint.issue || "Civic issue"}</h3>
                    </div>
                    <span className={`officer-status status-${String(complaint.status || "Submitted").toLowerCase().replaceAll(" ", "-")}`}>
                      {complaint.status || "Submitted"}
                    </span>
                  </div>
                  <div className="officer-complaint-details">
                    <p><strong>Department:</strong> {complaint.department || "Not specified"}</p>
                    <p><strong>Severity:</strong> {complaint.severity || "Not specified"}</p>
                    <p><strong>Location:</strong> {[complaint.full_address, complaint.area, complaint.village, complaint.district, complaint.state].filter(Boolean).join(", ") || "Location not available"}</p>
                    <p><strong>Reported:</strong> {formatDate(complaint.created_at)}</p>
                  </div>
                  <div className="officer-status-control">
                    <label htmlFor={`status-${complaint.id}`}>Update status</label>
                    <select
                      id={`status-${complaint.id}`}
                      value={complaint.status || "Submitted"}
                      disabled={busyId === complaint.id}
                      onChange={(event) => updateStatus(complaint.id, event.target.value)}
                    >
                      {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    {busyId === complaint.id && <small>Saving update…</small>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <p className="officer-demo-note">CivicFix AI prototype · Use demo credentials only. Add server-side authorization before production deployment.</p>
      </main>
    </div>
  );
}

