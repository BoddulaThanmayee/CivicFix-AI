import React, { useEffect, useState } from "react";
import axios from "axios";
import "./UserDashboard.css";
import "./UserDashboard_chat.css";
const API_BASE_URL = "http://127.0.0.1:8000";

function UserDashboard({ user, onBack }) {

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeChatId, setActiveChatId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatError, setChatError] = useState("");
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [botQuestion, setBotQuestion] = useState("");
  const [botAnswer, setBotAnswer] = useState("");
  const [botLoading, setBotLoading] = useState(false);
  const [timelineByComplaint, setTimelineByComplaint] = useState({});
  const [expandedTrackingId, setExpandedTrackingId] = useState(null);

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
    if (!user?.id) return undefined;
    // Periodically refresh complaint status so officer/admin updates appear
    // without the citizen needing to reload the page.
    const refreshTimer = setInterval(() => {
      fetchComplaints();
      if (expandedTrackingId !== null) loadTimeline(expandedTrackingId);
    }, 15000);
    return () => clearInterval(refreshTimer);
  }, [user, expandedTrackingId]);


  const loadTimeline = async (complaintId) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/complaints/${complaintId}/timeline`,
        { params: { user_id: user.id } }
      );
      if (Array.isArray(response.data)) {
        setTimelineByComplaint((previous) => ({
          ...previous,
          [complaintId]: response.data
        }));
      }
    } catch (err) {
      console.error("Unable to load complaint timeline:", err);
    }
  };

  const toggleTracking = async (complaintId) => {
    const nextId = expandedTrackingId === complaintId ? null : complaintId;
    setExpandedTrackingId(nextId);
    if (nextId !== null) await loadTimeline(complaintId);
  };

  const loadChat = async (complaintId) => {
    setActiveChatId(complaintId);
    setChatError("");
    try {
      const response = await axios.get(
        `${API_BASE_URL}/complaints/${complaintId}/messages`,
        { params: { user_id: user.id } }
      );
      if (Array.isArray(response.data)) setChatMessages(response.data);
      else {
        setChatMessages([]);
        setChatError(response.data?.message || "Unable to load chat.");
      }
    } catch (err) {
      setChatMessages([]);
      setChatError("Unable to load messages. Check that the backend is running.");
    }
  };

  const sendChatMessage = async (event) => {
    event.preventDefault();
    const message = chatDraft.trim();
    if (!message || !activeChatId) return;
    try {
      const response = await axios.post(
        `${API_BASE_URL}/complaints/${activeChatId}/messages`,
        { sender_role: "citizen", sender_id: user.id, message }
      );
      if (response.data?.success === false) {
        setChatError(response.data.message || "Message could not be sent.");
        return;
      }
      setChatMessages((previous) => [...previous, response.data]);
      setChatDraft("");
      setChatError("");
    } catch (err) {
      setChatError(err.response?.data?.detail || "Message could not be sent.");
    }
  };

  const askChatbot = async (event) => {
    event.preventDefault();
    if (!botQuestion.trim()) return;
    setBotLoading(true);
    setBotAnswer("");
    try {
      const response = await axios.post(`${API_BASE_URL}/chatbot`, {
        question: botQuestion.trim(),
        user_id: user?.id
      });
      setBotAnswer(response.data?.answer || "I couldn't find an answer.");
    } catch {
      setBotAnswer("The help assistant is unavailable. Please check that the backend is running.");
    } finally {
      setBotLoading(false);
    }
  };

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



                    {/* COMPLAINT TRACKING */}
                    <section className="complaint-tracking">
                      <div className="tracking-header">
                        <div>
                          <h3>📦 Track Complaint</h3>
                          <p>Follow the latest progress for CIVIC-{String(complaint.id).padStart(4, "0")}.</p>
                        </div>
                        <button type="button" onClick={() => toggleTracking(complaint.id)}>
                          {expandedTrackingId === complaint.id ? "Hide Timeline" : "View Timeline"}
                        </button>
                      </div>
                      <div className="tracking-progress" aria-label={`Current status: ${complaint.status || "Submitted"}`}>
                        {["Submitted", "Under Review", "Assigned", "In Progress", "Resolved"].map((step, stepIndex) => {
                          const currentIndex = ["Submitted", "Under Review", "Assigned", "In Progress", "Resolved"].indexOf(complaint.status || "Submitted");
                          const completed = currentIndex >= stepIndex;
                          return (
                            <div className={`tracking-step ${completed ? "is-complete" : ""} ${currentIndex === stepIndex ? "is-current" : ""}`} key={step}>
                              <span className="tracking-step-dot">{completed ? "✓" : stepIndex + 1}</span>
                              <span className="tracking-step-label">{step}</span>
                            </div>
                          );
                        })}
                      </div>
                      {expandedTrackingId === complaint.id && (
                        <div className="tracking-timeline">
                          {(timelineByComplaint[complaint.id] || []).length === 0 ? (
                            <p className="tracking-empty">Loading updates…</p>
                          ) : (
                            timelineByComplaint[complaint.id].map((entry, entryIndex) => (
                              <article className="tracking-event" key={entry.id || `${entry.status}-${entryIndex}`}>
                                <span className="tracking-event-dot" />
                                <div>
                                  <strong>{entry.status}</strong>
                                  <p>{entry.note || "Complaint status updated."}</p>
                                  <small>{formatDate(entry.created_at)}</small>
                                </div>
                              </article>
                            ))
                          )}
                          <div className="tracking-location">
                            <strong>📍 Complaint location</strong>
                            <p>{complaint.full_address || [complaint.area, complaint.village, complaint.district, complaint.state].filter(Boolean).join(", ") || "Location not available"}</p>
                            {complaint.latitude != null && complaint.longitude != null && (
                              <a target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${complaint.latitude}&mlon=${complaint.longitude}#map=17/${complaint.latitude}/${complaint.longitude}`}>
                                Open location in map ↗
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </section>

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

                    {/* ========================================
                        OFFICER ASSIGNMENT & QUICK CALL
                    ======================================== */}

                    <div className="officer-contact-card">
                      <h3>👨‍💼 Officer Assignment</h3>

                      {complaint.assigned_officer ? (
                        <>
                          <div className="officer-contact-details">
                            <p>
                              <strong>Officer:</strong>{" "}
                              {complaint.assigned_officer}
                            </p>

                            <p>
                              <strong>Designation:</strong>{" "}
                              {complaint.officer_designation || "Officer"}
                            </p>

                            <p>
                              <strong>Contact:</strong>{" "}
                              {complaint.officer_phone || "Not available"}
                            </p>

                            <p>
                              <strong>Assignment Type:</strong>{" "}
                              {complaint.assignment_method || "Not specified"}
                            </p>

                            <p>
                              <strong>Assigned On:</strong>{" "}
                              {formatDate(complaint.assigned_at)}
                            </p>
                          </div>

                          {complaint.officer_phone && (
                            <a
                              className="call-officer-button"
                              href={`tel:${String(
                                complaint.officer_phone
                              ).replace(/[^\d+]/g, "")}`}
                            >
                              📞 Call Officer
                            </a>
                          )}
                        </>
                      ) : (
                        <p className="officer-pending-message">
                          ⏳ No officer has been assigned to this complaint
                          yet. Please check again later.
                        </p>
                      )}
                    </div>

                    <div className="citizen-chat-card">
                      <div className="citizen-chat-heading">
                        <div>
                          <h3>💬 Message Assigned Officer</h3>
                          <p>Conversation for complaint #{complaint.id}</p>
                        </div>
                        <button type="button" onClick={() => loadChat(complaint.id)} disabled={!complaint.assigned_officer}>
                          {activeChatId === complaint.id ? "Refresh Chat" : "Open Chat"}
                        </button>
                      </div>
                      {activeChatId === complaint.id && (
                        <>
                          <div className="citizen-chat-messages">
                            {chatMessages.length === 0 && <p className="chat-empty">No messages yet. Send a message to start the conversation.</p>}
                            {chatMessages.map((item) => (
                              <div key={item.id} className={`chat-message ${item.sender_role === "citizen" ? "chat-message-own" : ""}`}>
                                <strong>{item.sender_name} · {item.sender_role}</strong>
                                <p>{item.message}</p>
                                <small>{formatDate(item.created_at)}</small>
                              </div>
                            ))}
                          </div>
                          {chatError && <p className="chat-error">{chatError}</p>}
                          <form className="citizen-chat-form" onSubmit={sendChatMessage}>
                            <input value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} maxLength={2000} placeholder="Write a message..." aria-label="Message to officer" />
                            <button type="submit" disabled={!chatDraft.trim()}>Send</button>
                          </form>
                        </>
                      )}
                      {!complaint.assigned_officer && <p className="chat-empty">Chat becomes available after an officer is assigned.</p>}
                    </div>

                  </div>

                )
              )}

            </div>

          )}

      </div>

      <div className="civicfix-chatbot">
        <button className="chatbot-toggle" onClick={() => setChatbotOpen((open) => !open)}>
          {chatbotOpen ? "✕ Close Help" : "🤖 CivicFix Help"}
        </button>
        {chatbotOpen && (
          <div className="chatbot-panel">
            <h3>🤖 CivicFix AI Assistant</h3>
            <p>Ask about reporting issues, complaint status, or contacting your officer.</p>
            {botAnswer && <div className="chatbot-answer">{botAnswer}</div>}
            <form onSubmit={askChatbot}>
              <input value={botQuestion} onChange={(e) => setBotQuestion(e.target.value)} placeholder="Type your question..." aria-label="Ask CivicFix chatbot" />
              <button type="submit" disabled={botLoading || !botQuestion.trim()}>{botLoading ? "..." : "Ask"}</button>
            </form>
          </div>
        )}
      </div>

    </div>

  );
}

export default UserDashboard;