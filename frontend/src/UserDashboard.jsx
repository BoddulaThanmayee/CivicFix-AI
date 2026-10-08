import React, { useEffect, useState } from "react";
import axios from "axios";
import "./UserDashboard.css";
const API_BASE_URL = "http://127.0.0.1:8000";

function UserDashboard({ user, onBack }) {

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // =========================================================
  // FETCH THIS CITIZEN'S COMPLAINTS
  // =========================================================

  const fetchComplaints = async () => {

    try {

      setLoading(true);
      setError("");

      if (!user || !user.id) {
        setError("User information not available.");
        return;
      }

      const response = await axios.get(
        `${API_BASE_URL}/complaints`,
        {
          params: {
            user_id: user.id
          }
        }
      );

      // Make sure we received an array
      if (Array.isArray(response.data)) {
        setComplaints(response.data);
      } else {
        setComplaints([]);
      }

    } catch (error) {

      console.error(
        "Error fetching complaints:",
        error
      );

      setError(
        "Unable to load your complaints."
      );

    } finally {

      setLoading(false);

    }
  };


  // =========================================================
  // LOAD COMPLAINTS WHEN DASHBOARD OPENS
  // =========================================================

  useEffect(() => {

    fetchComplaints();

  }, [user]);


  // =========================================================
  // STATUS COUNTS
  // =========================================================

  const totalComplaints = complaints.length;

  const submittedCount = complaints.filter(
    (complaint) =>
      complaint.status === "Submitted"
  ).length;

  const underReviewCount = complaints.filter(
    (complaint) =>
      complaint.status === "Under Review"
  ).length;

  const assignedCount = complaints.filter(
    (complaint) =>
      complaint.status === "Assigned"
  ).length;

  const inProgressCount = complaints.filter(
    (complaint) =>
      complaint.status === "In Progress"
  ).length;

  const resolvedCount = complaints.filter(
    (complaint) =>
      complaint.status === "Resolved"
  ).length;


  // =========================================================
  // STATUS CLASS
  // =========================================================

  const getStatusClass = (status) => {

    switch (status) {

      case "Submitted":
        return "status-submitted";

      case "Under Review":
        return "status-review";

      case "Assigned":
        return "status-assigned";

      case "In Progress":
        return "status-progress";

      case "Resolved":
        return "status-resolved";

      default:
        return "status-default";
    }
  };


  // =========================================================
  // FORMAT DATE
  // =========================================================

  const formatDate = (date) => {

    if (!date) {
      return "N/A";
    }

    try {

      return new Date(date).toLocaleString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }
      );

    } catch {

      return date;
    }
  };


  // =========================================================
  // DASHBOARD
  // =========================================================

  return (

    <div className="user-dashboard">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="dashboard-header">

        <div>

          <h1>
            👤 My Dashboard
          </h1>

          <p>
            Welcome,{" "}
            <strong>
              {user?.full_name || "Citizen"}
            </strong>
          </p>

        </div>


        <button
          className="dashboard-back-button"
          onClick={onBack}
        >
          ← Back to Camera
        </button>

      </div>


      {/* =====================================================
          ERROR MESSAGE
      ===================================================== */}

      {error && (

        <div className="dashboard-error">

          ⚠️ {error}

        </div>

      )}


      {/* =====================================================
          STATISTICS
      ===================================================== */}

      <div className="dashboard-stats">

        <div className="stat-card total">

          <div className="stat-icon">
            📋
          </div>

          <div>

            <h3>
              {totalComplaints}
            </h3>

            <p>
              Total Complaints
            </p>

          </div>

        </div>


        <div className="stat-card submitted">

          <div className="stat-icon">
            📤
          </div>

          <div>

            <h3>
              {submittedCount}
            </h3>

            <p>
              Submitted
            </p>

          </div>

        </div>


        <div className="stat-card review">

          <div className="stat-icon">
            🔍
          </div>

          <div>

            <h3>
              {underReviewCount}
            </h3>

            <p>
              Under Review
            </p>

          </div>

        </div>


        <div className="stat-card assigned">

          <div className="stat-icon">
            👨‍💼
          </div>

          <div>

            <h3>
              {assignedCount}
            </h3>

            <p>
              Assigned
            </p>

          </div>

        </div>


        <div className="stat-card progress">

          <div className="stat-icon">
            🚧
          </div>

          <div>

            <h3>
              {inProgressCount}
            </h3>

            <p>
              In Progress
            </p>

          </div>

        </div>


        <div className="stat-card resolved">

          <div className="stat-icon">
            ✅
          </div>

          <div>

            <h3>
              {resolvedCount}
            </h3>

            <p>
              Resolved
            </p>

          </div>

        </div>

      </div>


      {/* =====================================================
          MY COMPLAINTS
      ===================================================== */}

      <div className="my-complaints-section">

        <div className="section-header">

          <div>

            <h2>
              📋 My Complaints
            </h2>

            <p>
              Track the complaints you have reported.
            </p>

          </div>


          <button
            className="refresh-button"
            onClick={fetchComplaints}
          >
            🔄 Refresh
          </button>

        </div>


        {/* ===================================================
            LOADING
        =================================================== */}

        {loading && (

          <div className="dashboard-loading">

            <div className="loading-spinner"></div>

            <p>
              Loading your complaints...
            </p>

          </div>

        )}


        {/* ===================================================
            NO COMPLAINTS
        =================================================== */}

        {!loading &&
          complaints.length === 0 && (

            <div className="no-complaints">

              <div className="no-complaints-icon">
                📭
              </div>

              <h3>
                No Complaints Yet
              </h3>

              <p>
                You haven't reported any civic issues yet.
              </p>

              <button
                className="report-now-button"
                onClick={onBack}
              >
                📷 Report an Issue
              </button>

            </div>

          )}


        {/* ===================================================
            COMPLAINT LIST
        =================================================== */}

        {!loading &&
          complaints.length > 0 && (

            <div className="complaints-list">

              {complaints.map(
                (complaint, index) => (

                  <div
                    className="complaint-card"
                    key={
                      complaint.id || index
                    }
                  >

                    {/* ========================================
                        COMPLAINT HEADER
                    ======================================== */}

                    <div className="complaint-card-header">

                      <div>

                        <span className="complaint-label">
                          Complaint ID
                        </span>

                        <h3>
                          #{complaint.id}
                        </h3>

                      </div>


                      <span
                        className={`complaint-status ${getStatusClass(
                          complaint.status
                        )}`}
                      >
                        {complaint.status ||
                          "Submitted"}
                      </span>

                    </div>


                    {/* ========================================
                        COMPLAINT INFORMATION
                    ======================================== */}

                    <div className="complaint-information">

                      <div className="info-item">

                        <span className="info-label">
                          🚧 Issue
                        </span>

                        <span className="info-value">
                          {complaint.issue ||
                            "N/A"}
                        </span>

                      </div>


                      <div className="info-item">

                        <span className="info-label">
                          🏢 Department
                        </span>

                        <span className="info-value">
                          {complaint.department ||
                            "N/A"}
                        </span>

                      </div>


                      <div className="info-item">

                        <span className="info-label">
                          📍 Location
                        </span>

                        <span className="info-value">

                          {complaint.full_address ||
                            complaint.area ||
                            complaint.village ||
                            complaint.district ||
                            "Location unavailable"}

                        </span>

                      </div>


                      <div className="info-item">

                        <span className="info-label">
                          📅 Reported On
                        </span>

                        <span className="info-value">
                          {formatDate(
                            complaint.created_at
                          )}
                        </span>

                      </div>

                    </div>


                    {/* ========================================
                        LOCATION DETAILS
                    ======================================== */}

                    {(complaint.area ||
                      complaint.village ||
                      complaint.district ||
                      complaint.state) && (

                      <div className="location-details">

                        <strong>
                          📍 Location Details
                        </strong>

                        <p>

                          {[
                            complaint.area,
                            complaint.village,
                            complaint.district,
                            complaint.state
                          ]
                            .filter(Boolean)
                            .join(", ")}

                        </p>

                      </div>

                    )}

                  </div>

                )
              )}

            </div>

          )}

      </div>

    </div>

  );
}

export default UserDashboard;