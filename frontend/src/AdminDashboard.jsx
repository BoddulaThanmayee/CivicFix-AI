

import { useEffect, useState } from "react";

import axios from "axios";

import "./AdminDashboard.css";



const API_BASE_URL = "http://10.0.2.2:8000";



function AdminDashboard({ onBack, theme = "light", toggleTheme }) {

  const [complaints, setComplaints] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [updatingStatus, setUpdatingStatus] = useState(null);

  const [statusError, setStatusError] = useState("");

  const [statusFilter, setStatusFilter] = useState("All");

  const [searchTerm, setSearchTerm] = useState("");



  const [assignmentForms, setAssignmentForms] = useState({});

  const [assigningComplaint, setAssigningComplaint] = useState(null);

  const [assignmentError, setAssignmentError] = useState("");

  const [assignmentSuccess, setAssignmentSuccess] = useState("");



  // Convert backend timestamps to Indian Standard Time.

  // The backend uses datetime.utcnow(), which can return timestamps

  // without a timezone indicator. Treat those timestamps as UTC.

  const formatIndiaDateTime = (timestamp) => {

    if (!timestamp) return "N/A";



    const value = String(timestamp);

    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);

    const normalizedTimestamp = hasTimezone ? value : `${value}Z`;

    const date = new Date(normalizedTimestamp);



    if (Number.isNaN(date.getTime())) return "N/A";



    return date.toLocaleString("en-IN", {

      timeZone: "Asia/Kolkata",

      day: "2-digit",

      month: "short",

      year: "numeric",

      hour: "2-digit",

      minute: "2-digit",

      second: "2-digit",

      hour12: true

    });

  };



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



    if (Number.isNaN(value)) return "N/A";



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

        { status: newStatus }

      );



      setComplaints((currentComplaints) =>

        currentComplaints.map((complaint) =>

          complaint.id === complaintId

            ? { ...complaint, status: newStatus }

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



  const autoAssignComplaint = async (complaint) => {
    try {
      setAssigningComplaint(complaint.id);
      setAssignmentError("");
      setAssignmentSuccess("");

      const response = await axios.post(
        `${API_BASE_URL}/complaints/${complaint.id}/auto-assign`
      );
      const result = response.data || {};

      if (result.success === false) {
        throw new Error(result.message || "AI could not assign an officer.");
      }

      // Support the backend's common response shapes.
      const officer = result.assigned_officer || result.officer?.name || result.officer_name;
      if (!officer) {
        throw new Error(result.message || "No suitable officer was returned. Check the backend response and available officers.");
      }

      const updated = {
        ...complaint,
        department: result.department || result.officer?.department || complaint.department,
        assigned_officer: typeof officer === "string" ? officer : officer.name,
        officer_designation: result.officer_designation || result.officer?.designation || "Not provided",
        officer_phone: result.officer_phone || result.officer?.phone || "Not provided",
        assigned_at: result.assigned_at || new Date().toISOString(),
        assignment_method: result.assignment_method || "AI",
        assignment_reason: result.reason || result.assignment_reason || result.recommendation_reason || "Selected using department, issue type, location, and officer workload.",
        status: result.status || "Assigned"
      };

      setComplaints((current) => current.map((item) => item.id === complaint.id ? updated : item));
      setAssignmentSuccess(`AI assigned an officer to ${complaint.complaint_id || `CIVIC-${String(complaint.id).padStart(4, "0")}`}.`);
    } catch (err) {
      setAssignmentError(
        err.response?.data?.detail || err.response?.data?.message || err.message || "AI officer assignment failed."
      );
    } finally {
      setAssigningComplaint(null);
    }
  };

  const assignComplaintManually = async (complaint) => {
    const form = assignmentForms[complaint.id] || {};
    const payload = {
      department: (form.department ?? complaint.department ?? "").trim(),
      assigned_officer: (form.assigned_officer ?? "").trim(),
      officer_designation: (form.officer_designation ?? "").trim(),
      officer_phone: (form.officer_phone ?? "").trim()
    };

    if (!payload.department || !payload.assigned_officer || !payload.officer_designation || !payload.officer_phone) {
      setAssignmentError("For manual assignment, fill in all officer details.");
      setAssignmentSuccess("");
      return;
    }

    try {
      setAssigningComplaint(complaint.id);
      setAssignmentError("");
      setAssignmentSuccess("");
      const response = await axios.put(`${API_BASE_URL}/complaints/${complaint.id}/assign`, payload);
      if (response.data?.success === false) throw new Error(response.data.message || "Manual assignment failed.");
      setComplaints((current) => current.map((item) => item.id === complaint.id ? {
        ...item,
        department: response.data.department || payload.department,
        assigned_officer: response.data.assigned_officer || payload.assigned_officer,
        officer_designation: response.data.officer_designation || payload.officer_designation,
        officer_phone: response.data.officer_phone || payload.officer_phone,
        assigned_at: response.data.assigned_at,
        assignment_method: "Manual",
        status: response.data.status || "Assigned"
      } : item));
      setAssignmentSuccess(`Officer manually assigned to ${complaint.complaint_id || `CIVIC-${String(complaint.id).padStart(4, "0")}`}.`);
    } catch (err) {
      setAssignmentError(err.response?.data?.detail || err.message || "Unable to assign officer.");
    } finally {
      setAssigningComplaint(null);
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

          (value) => value !== null && value !== undefined

        )

        .some((value) =>

          String(value).toLowerCase().includes(search)

        );



    return matchesStatus && matchesSearch;

  });



  return (

    <div className="admin-page">

      <header className="admin-header">

        <button

          className="admin-back-button"

          onClick={onBack}

        >

          ← Back

        </button>



        <div className="admin-header-title">
          <h1>CivicFix AI</h1>
          <p>Admin & Department Dashboard</p>
        </div>

        <div className="admin-header-actions">
          {typeof toggleTheme === "function" && (
            <button
              className="admin-theme-button"
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? "☀️ Light mode" : "🌙 Dark mode"}
            </button>
          )}

          <button
            className="refresh-button"
            type="button"
            onClick={fetchComplaints}
          >
            🔄 Refresh
          </button>
        </div>

      </header>



      <main className="admin-container">

        <section className="dashboard-title">

          <div>

            <p className="dashboard-label">

              COMPLAINT MANAGEMENT

            </p>

            <h2>Civic Issue Reports</h2>

            <p>

              View AI-detected civic issues submitted by citizens.

            </p>

          </div>

        </section>



        <section className="stats-grid">

          <div className="stat-card">

            <span className="stat-icon">📋</span>

            <div>

              <p>Total Complaints</p>

              <h3>{complaints.length}</h3>

            </div>

          </div>



          <div className="stat-card">

            <span className="stat-icon">🚨</span>

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

            <span className="stat-icon">🛣️</span>

            <div>

              <p>Road Issues</p>

              <h3>

                {

                  complaints.filter((complaint) =>

                    complaint.department?.toLowerCase().includes("road")

                  ).length

                }

              </h3>

            </div>

          </div>



          <div className="stat-card">

            <span className="stat-icon">🤖</span>

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

                    (complaint) => complaint.status === "Assigned"

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

                    (complaint) => complaint.status === "In Progress"

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

                    (complaint) => complaint.status === "Resolved"

                  ).length

                }

              </h3>

            </div>

          </div>

        </section>



        {loading && (

          <div className="dashboard-message">

            <div className="loading-spinner"></div>

            <p>Loading complaints...</p>

          </div>

        )}



        {!loading && error && (

          <div className="dashboard-error">

            <h3>⚠️ Unable to Load Complaints</h3>

            <p>{error}</p>

            <button

              className="retry-button"

              onClick={fetchComplaints}

            >

              Try Again

            </button>

          </div>

        )}



        {!loading && !error && complaints.length === 0 && (

          <div className="empty-state">

            <div className="empty-icon">📭</div>

            <h3>No Complaints Yet</h3>

            <p>Submitted civic issues will appear here.</p>

          </div>

        )}



        {!loading && !error && complaints.length > 0 && (

          <section className="complaints-section">

            <div className="section-header">

              <div>

                <h3>Recent Complaints</h3>

                <p>

                  AI-analyzed civic issues reported by citizens

                </p>

              </div>

              <span className="complaint-count">

                {filteredComplaints.length} Reports

              </span>

            </div>



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

                    <div className="complaint-card-header">

                      <div>

                        <span className="complaint-id">

                          {complaint.complaint_id ||

                            `CIVIC-${String(complaint.id).padStart(4, "0")}`}

                        </span>

                        <h3>

                          {complaint.issue || "Unknown Civic Issue"}

                        </h3>

                      </div>



                      <span

                        className={`severity-badge ${getSeverityClass(

                          complaint.severity

                        )}`}

                      >

                        {complaint.severity || "Unknown"}

                      </span>

                    </div>



                    <div className="complaint-info">

                      <div className="info-item">

                        <span className="info-label">

                          🤖 AI Confidence

                        </span>

                        <strong>

                          {formatConfidence(complaint.confidence)}

                        </strong>

                      </div>



                      <div className="info-item">

                        <span className="info-label">

                          🏢 Department

                        </span>

                        <strong>

                          {complaint.department || "Not assigned"}

                        </strong>

                      </div>



                      <div className="info-item">

                        <span className="info-label">📍 Area</span>

                        <strong>

                          {complaint.area || "Not available"}

                        </strong>

                      </div>



                      <div className="info-item">

                        <span className="info-label">🏘️ District</span>

                        <strong>

                          {complaint.district || "Not available"}

                        </strong>

                      </div>



                      <div className="info-item">

                        <span className="info-label">📌 State</span>

                        <strong>

                          {complaint.state || "Not available"}

                        </strong>

                      </div>



                      <div className="info-item">

                        <span className="info-label">📊 Status</span>

                        <select

                          className="status-select"

                          value={complaint.status || "Submitted"}

                          onChange={(event) =>

                            updateComplaintStatus(

                              complaint.id,

                              event.target.value

                            )

                          }

                          disabled={updatingStatus === complaint.id}

                        >

                          {statusOptions.map((status) => (

                            <option key={status} value={status}>

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



                    <section className="assignment-section">
                      <h4>{complaint.assigned_officer ? "Officer Assignment" : "AI Officer Assignment"}</h4>

                      {complaint.assigned_officer && (
                        <div className="assigned-officer-details">
                          <p><strong>Officer:</strong> {complaint.assigned_officer}</p>
                          <p><strong>Designation:</strong> {complaint.officer_designation || "Not provided"}</p>
                          <p><strong>Contact:</strong> {complaint.officer_phone || "Not provided"}</p>
                          <p><strong>Assignment type:</strong> {complaint.assignment_method || "Previously assigned"}</p>
                          {complaint.assignment_reason && <p><strong>Why selected:</strong> {complaint.assignment_reason}</p>}
                          {complaint.assigned_at && <p><strong>Assigned on:</strong> {formatIndiaDateTime(complaint.assigned_at)}</p>}
                        </div>
                      )}

                      <p className="assignment-help">Let CivicFix AI choose a suitable demo officer using department, issue type, location, and workload.</p>
                      <button
                        type="button"
                        className="assignment-button"
                        onClick={() => autoAssignComplaint(complaint)}
                        disabled={assigningComplaint === complaint.id}
                      >
                        {assigningComplaint === complaint.id ? "Finding best officer..." : complaint.assigned_officer ? "Reassign with AI" : "🤖 Find Best Officer with AI"}
                      </button>

                      <details className="manual-assignment-details">
                        <summary>Choose an officer manually instead</summary>
                        <div className="assignment-form">
                          <input type="text" placeholder="Department" value={assignmentForms[complaint.id]?.department ?? complaint.department ?? ""} onChange={(event) => setAssignmentForms((current) => ({ ...current, [complaint.id]: { ...current[complaint.id], department: event.target.value } }))} />
                          <input type="text" placeholder="Officer name" value={assignmentForms[complaint.id]?.assigned_officer ?? ""} onChange={(event) => setAssignmentForms((current) => ({ ...current, [complaint.id]: { ...current[complaint.id], assigned_officer: event.target.value } }))} />
                          <input type="text" placeholder="Designation" value={assignmentForms[complaint.id]?.officer_designation ?? ""} onChange={(event) => setAssignmentForms((current) => ({ ...current, [complaint.id]: { ...current[complaint.id], officer_designation: event.target.value } }))} />
                          <input type="tel" placeholder="Officer contact number" value={assignmentForms[complaint.id]?.officer_phone ?? ""} onChange={(event) => setAssignmentForms((current) => ({ ...current, [complaint.id]: { ...current[complaint.id], officer_phone: event.target.value } }))} />
                          <button type="button" className="assignment-button manual-assignment-button" onClick={() => assignComplaintManually(complaint)} disabled={assigningComplaint === complaint.id}>
                            {assigningComplaint === complaint.id ? "Assigning..." : "Assign Manually"}
                          </button>
                        </div>
                      </details>
                    </section>

                    {assignmentError && (
                      <p className="assignment-error">{assignmentError}</p>
                    )}
                    {assignmentSuccess && (
                      <p className="assignment-success">{assignmentSuccess}</p>
                    )}

                    {complaint.full_address && (

                      <div className="address-box">

                        <span>📍 Location</span>

                        <p>{complaint.full_address}</p>

                      </div>

                    )}



                    {complaint.created_at && (

                      <div className="complaint-footer">

                        <span>🕒 Submitted</span>

                        <span>

                          {formatIndiaDateTime(complaint.created_at)}

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
