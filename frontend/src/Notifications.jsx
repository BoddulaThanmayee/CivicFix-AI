import { useEffect, useState } from "react";

const API_URL = "http://127.0.0.1:8000";

function Notifications({ user, onBack }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    fetch(`${API_URL}/notifications?user_id=${user.id}`)
      .then((response) => response.json())
      .then((data) => {
        setNotifications(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        console.error("Error fetching notifications:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user]);

  return (
    <div className="notifications-page">

      <div className="notifications-header">
        <button onClick={onBack}>← Back</button>
        <h1>🔔 Notifications</h1>
      </div>

      {loading && <p>Loading notifications...</p>}

      {!loading && notifications.length === 0 && (
        <div className="empty-notifications">
          <div>🔔</div>
          <h2>No Notifications</h2>
          <p>You don't have any notifications yet.</p>
        </div>
      )}

      {!loading && notifications.length > 0 && (
        <div className="notification-list">
          {notifications.map((notification) => (
            <div
              className={`notification-card ${
                notification.is_read === 0 ? "unread" : ""
              }`}
              key={notification.id}
            >
              <div className="notification-icon">🔔</div>

              <div className="notification-content">
                <h3>{notification.title}</h3>

                <p>{notification.message}</p>

                {notification.status && (
                  <span className="notification-status">
                    {notification.status}
                  </span>
                )}

                <small>
                  {new Date(notification.created_at).toLocaleString()}
                </small>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

export default Notifications;