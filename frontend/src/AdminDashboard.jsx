import { useEffect, useState } from "react";
import axios from "axios";
import "./AdminDashboard.css";

const API_BASE_URL = "http://127.0.0.1:8000";

function AdminDashboard({ onBack }) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [statusError, setStatusError] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await axios.get(
        `${API_BASE_URL}/complaints`
      );

      setComplaints(response.data || []);
    } catch (err) {
      console.error("Error fetching complaints:", err);

      setError(
        "Unable to load complaints. Make sure the FastAPI backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const getSeverityClass = (severity) => {
    if (!severity) return "";

    return severity.toLowerCase().replace(/\s+/g, "-");
  };

  const formatConfidence = (confidence) => {
    if (confidence === null || confidence === undefined) {
      return "N/A";
    }

    const value = Number(confidence);

    if (Number.isNaN(value)) {
      return "N/A";
    }

    // New backend stores confidence between 0 and 1.
    // Older records may already contain percentage values.
    if (value <= 1) {
      return `${(value * 100).toFixed(2)}%`;
    }

    return `${value.toFixed(2)}%`;
  };

  const updateComplaintStatus = async (complaintId, newStatus) => {
    try {
      setUpdatingStatus(complaintId);
      setStatusError("");

      await axios.put(
        `${API_BASE_URL}/complaints/${complaintId}/status`,
        {
          status: newStatus
        }
      );

      setComplaints((currentComplaints) =>
        currentComplaints.map((complaint) =>
          complaint.id === complaintId
            ? {
                ...complaint,
                status: newStatus
              }
            : complaint
        )
      );
    } catch (err) {
      console.error("Error updating complaint status:", err);

      setStatusError(
        "Unable to update complaint status. Please make sure the backend is running."
      );
    } finally {
      setUpdatingStatus(null);
    }
  };

  const statusOptions = [
    "Submitted",
    "Under Review",
    "Assigned",
    "In Progress",
    "Resolved"
  ];

  const filteredComplaints = complaints.filter((complaint) => {
    const matchesStatus =
      statusFilter === "All" ||
      (complaint.status || "Submitted") === statusFilter;

    const search = searchTerm.trim().toLowerCase();

    const matchesSearch =
      !search ||
      [
        complaint.id,
        complaint.complaint_id,
        complaint.issue,
        complaint.department,
        complaint.area,
        complaint.village,
        complaint.district,
        complaint.state,
        complaint.country,
        complaint.full_address
      ]
        .filter(
          (value) =>
            value !== null &&
            value !== undefined
        )
        .some((value) =>
          String(value).toLowerCase().includes(search)
        );

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="admin-page">

      {/* Header */}
      <header className="admin-header">

        <button
          className="admin-back-button"
          onClick={onBack}
        >
          ← Back
        </button>

        <div>
          <h1>CivicFix AI</h1>
          <p>Admin & Department Dashboard</p>
        </div>

        <button
          className="refresh-button"
          onClick={fetchComplaints}
        >
          🔄 Refresh
        </button>

      </header>


      {/* Main Content */}
      <main className="admin-container">

        {/* Page Title */}
        <section className="dashboard-title">

          <div>
            <p className="dashboard-label">
              COMPLAINT MANAGEMENT
            </p>

            <h2>
              Civic Issue Reports
            </h2>

            <p>
              View AI-detected civic issues submitted by citizens.
            </p>
          </div>

        </section>


        {/* Statistics */}
        <section className="stats-grid">

          <div className="stat-card">

            <span className="stat-icon">
              📋
            </span>

            <div>
              <p>Total Complaints</p>
              <h3>{complaints.length}</h3>
            </div>

          </div>


          <div className="stat-card">

            <span className="stat-icon">
              🚨
            </span>

            <div>
              <p>High Severity</p>

              <h3>
                {
                  complaints.filter(
                    (complaint) =>
                      complaint.severity?.toLowerCase() === "high"
                  ).length
                }
              </h3>

            </div>

          </div>


          <div className="stat-card">

            <span className="stat-icon">
              🛣️
            </span>

            <div>
              <p>Road Issues</p>

              <h3>
                {
                  complaints.filter((complaint) =>
                    complaint.department
                      ?.toLowerCase()
                      .includes("road")
                  ).length
                }
              </h3>

            </div>

          </div>


          <div className="stat-card">

            <span className="stat-icon">
              🤖
            </span>

            <div>
              <p>AI Detected</p>

              <h3>
                {
                  complaints.filter(
                    (complaint) => complaint.issue
                  ).length
                }
              </h3>

            </div>

          </div>

        </section>


        {/* Status Summary */}
        <section className="status-summary-grid">

          <div className="status-summary-card submitted">
            <span className="status-summary-icon">📋</span>
            <div>
              <p>Submitted</p>
              <h3>
                {
                  complaints.filter(
                    (complaint) =>
                      (complaint.status || "Submitted") === "Submitted"
                  ).length
                }
              </h3>
            </div>
          </div>

          <div className="status-summary-card under-review">
            <span className="status-summary-icon">🔎</span>
            <div>
              <p>Under Review</p>
              <h3>
                {
                  complaints.filter(
                    (complaint) =>
                      complaint.status === "Under Review"
                  ).length
                }
              </h3>
            </div>
          </div>

          <div className="status-summary-card assigned">
            <span className="status-summary-icon">🛠️</span>
            <div>
              <p>Assigned</p>
              <h3>
                {
                  complaints.filter(
                    (complaint) =>
                      complaint.status === "Assigned"
                  ).length
                }
              </h3>
            </div>
          </div>

          <div className="status-summary-card in-progress">
            <span className="status-summary-icon">⚙️</span>
            <div>
              <p>In Progress</p>
              <h3>
                {
                  complaints.filter(
                    (complaint) =>
                      complaint.status === "In Progress"
                  ).length
                }
              </h3>
            </div>
          </div>

          <div className="status-summary-card resolved">
            <span className="status-summary-icon">✅</span>
            <div>
              <p>Resolved</p>
              <h3>
                {
                  complaints.filter(
                    (complaint) =>
                      complaint.status === "Resolved"
                  ).length
                }
              </h3>
            </div>
          </div>

        </section>


        {/* Loading */}
        {loading && (

          <div className="dashboard-message">
            <div className="loading-spinner"></div>

            <p>
              Loading complaints...
            </p>
          </div>

        )}


        {/* Error */}
        {!loading && error && (

          <div className="dashboard-error">

            <h3>
              ⚠️ Unable to Load Complaints
            </h3>

            <p>
              {error}
            </p>

            <button
              className="retry-button"
              onClick={fetchComplaints}
            >
              Try Again
            </button>

          </div>

        )}


        {/* Empty State */}
        {!loading &&
          !error &&
          complaints.length === 0 && (

            <div className="empty-state">

              <div className="empty-icon">
                📭
              </div>

              <h3>
                No Complaints Yet
              </h3>

              <p>
                Submitted civic issues will appear here.
              </p>

            </div>

          )}


        {/* Complaints */}
        {!loading &&
          !error &&
          complaints.length > 0 && (

            <section className="complaints-section">

              <div className="section-header">

                <div>
                  <h3>
                    Recent Complaints
                  </h3>

                  <p>
                    AI-analyzed civic issues reported by citizens
                  </p>
                </div>

                <span className="complaint-count">
                  {filteredComplaints.length} Reports
                </span>

              </div>


              {/* Complaint Search */}
              <div className="complaint-search-container">
                <label htmlFor="complaint-search">
                  Search Complaints
                </label>

                <input
                  id="complaint-search"
                  type="text"
                  className="complaint-search-input"
                  placeholder="Search by ID, issue, department, area, district..."
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(event.target.value)
                  }
                />
              </div>


              {/* Status Filter */}
              <div className="status-filter-container">
                <label htmlFor="status-filter">
                  Filter by Status
                </label>

                <select
                  id="status-filter"
                  className="status-filter-select"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value)
                  }
                >
                  <option value="All">All Statuses</option>

                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>


              {statusError && (
                <div className="status-update-error">
                  ⚠️ {statusError}
                </div>
              )}

              <div className="complaints-grid">

                {filteredComplaints
                  .slice()
                  .reverse()
                  .map((complaint) => (

                    <article
                      className="complaint-card"
                      key={complaint.id}
                    >

                      {/* Card Header */}
                      <div className="complaint-card-header">

                        <div>

                          <span className="complaint-id">
                            {complaint.complaint_id ||
                              `CIVIC-${String(
                                complaint.id
                              ).padStart(4, "0")}`}
                          </span>

                          <h3>
                            {complaint.issue ||
                              "Unknown Civic Issue"}
                          </h3>

                        </div>

                        <span
                          className={`severity-badge ${getSeverityClass(
                            complaint.severity
                          )}`}
                        >
                          {complaint.severity ||
                            "Unknown"}
                        </span>

                      </div>


                      {/* AI Information */}
                      <div className="complaint-info">

                        <div className="info-item">

                          <span className="info-label">
                            🤖 AI Confidence
                          </span>

                          <strong>
                            {formatConfidence(
                              complaint.confidence
                            )}
                          </strong>

                        </div>


                        <div className="info-item">

                          <span className="info-label">
                            🏢 Department
                          </span>

                          <strong>
                            {complaint.department ||
                              "Not assigned"}
                          </strong>

                        </div>


                        <div className="info-item">

                          <span className="info-label">
                            📍 Area
                          </span>

                          <strong>
                            {complaint.area ||
                              "Not available"}
                          </strong>

                        </div>


                        <div className="info-item">

                          <span className="info-label">
                            🏘️ District
                          </span>

                          <strong>
                            {complaint.district ||
                              "Not available"}
                          </strong>

                        </div>


                        <div className="info-item">

                          <span className="info-label">
                            📌 State
                          </span>

                          <strong>
                            {complaint.state ||
                              "Not available"}
                          </strong>

                        </div>


                        <div className="info-item">

                          <span className="info-label">
                            📊 Status
                          </span>

                          <select
                            className="status-select"
                            value={complaint.status || "Submitted"}
                            onChange={(event) =>
                              updateComplaintStatus(
                                complaint.id,
                                event.target.value
                              )
                            }
                            disabled={
                              updatingStatus === complaint.id
                            }
                          >
                            {statusOptions.map((status) => (
                              <option
                                key={status}
                                value={status}
                              >
                                {status}
                              </option>
                            ))}
                          </select>

                          {updatingStatus === complaint.id && (
                            <small className="status-saving">
                              Updating...
                            </small>
                          )}

                        </div>

                      </div>


                      {/* Full Address */}
                      {complaint.full_address && (

                        <div className="address-box">

                          <span>
                            📍 Location
                          </span>

                          <p>
                            {complaint.full_address}
                          </p>

                        </div>

                      )}


                      {/* Date */}
                      {complaint.created_at && (

                        <div className="complaint-footer">

                          <span>
                            🕒 Submitted
                          </span>

                          <span>
                            {new Date(
                              complaint.created_at
                            ).toLocaleString()}
                          </span>

                        </div>

                      )}

                    </article>

                  ))}

              </div>

            </section>

          )}

      </main>

    </div>
  );
}

export default AdminDashboard;