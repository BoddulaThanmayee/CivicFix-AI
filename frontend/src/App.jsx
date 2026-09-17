import { useState } from "react";
import "./App.css";
import ReportIssue from "./ReportIssue";

function App() {
  const [showReport, setShowReport] = useState(false);

  if (showReport) {
    return <ReportIssue onBack={() => setShowReport(false)} />;
  }

  return (
    <div className="app">
      <header className="navbar">
        <div className="logo">
          <div className="logo-icon">C</div>
          <span>CivicFix AI</span>
        </div>

        <div className="location">
          📍 Location enabled
        </div>
      </header>

      <main className="hero">
        <div className="hero-content">
          <p className="tagline">
            SMARTER CITIES • BETTER COMMUNITIES
          </p>

          <h1>
            Report Civic Issues
            <br />
            <span>with AI</span>
          </h1>

          <p className="description">
            Capture a photo of a public issue and let CivicFix AI
            identify it, assess its severity, and help you report it
            with the exact location.
          </p>

          <button
            className="report-button"
            onClick={() => setShowReport(true)}
          >
            📷 Report an Issue
          </button>

          <div className="quick-options">
            <button
              className="option-card"
              onClick={() => setShowReport(true)}
            >
              <span className="option-icon">📷</span>

              <div>
                <strong>Camera</strong>
                <small>Take a photo</small>
              </div>
            </button>

            <button
              className="option-card"
              onClick={() => setShowReport(true)}
            >
              <span className="option-icon">🖼️</span>

              <div>
                <strong>Gallery</strong>
                <small>Choose an image</small>
              </div>
            </button>
          </div>
        </div>

        <div className="hero-visual">
          <div className="visual-card">
            <div className="scan-circle">
              <span>📷</span>
            </div>

            <h3>AI-Powered Detection</h3>

            <p>
              Potholes • Garbage • Water Leakage
            </p>

            <div className="status">
              <span className="status-dot"></span>
              Ready to detect
            </div>
          </div>
        </div>
      </main>

      <section className="features">
        <div className="feature">
          <span>🤖</span>

          <div>
            <h3>AI Detection</h3>
            <p>Automatically identify civic issues.</p>
          </div>
        </div>

        <div className="feature">
          <span>📍</span>

          <div>
            <h3>GPS Location</h3>
            <p>Pinpoint exactly where the issue exists.</p>
          </div>
        </div>

        <div className="feature">
          <span>⚡</span>

          <div>
            <h3>Quick Reporting</h3>
            <p>Create structured complaints easily.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;