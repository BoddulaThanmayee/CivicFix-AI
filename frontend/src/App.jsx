import { useEffect, useState } from "react";
import "./App.css";

import ReportIssue from "./ReportIssue";
import AdminDashboard from "./AdminDashboard";
import UserDashboard from "./UserDashboard";
import Notifications from "./Notifications";
const API_BASE_URL = "http://127.0.0.1:8000";
const USER_STORAGE_KEY = "civicfix_user";


// =========================================================
// AUTH PAGE
// =========================================================

function AuthPage({ onLogin }) {

  const [mode, setMode] = useState("login");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");


  const resetMessages = () => {
    setMessage("");
    setError("");
  };


  const switchMode = (newMode) => {

    setMode(newMode);

    resetMessages();

    setFullName("");
    setPhone("");
    setPassword("");
  };


  // =========================================================
  // LOGIN / REGISTER
  // =========================================================

  const handleSubmit = async (event) => {

    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");


    try {

      // =====================================================
      // REGISTER
      // =====================================================

      if (mode === "register") {

        if (!fullName.trim()) {

          setError("Please enter your full name.");
          setLoading(false);
          return;
        }


        if (!email.trim()) {

          setError("Please enter your email.");
          setLoading(false);
          return;
        }


        if (password.length < 6) {

          setError("Password must contain at least 6 characters.");
          setLoading(false);
          return;
        }


        const response = await fetch(
          `${API_BASE_URL}/register`,
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({
              full_name: fullName.trim(),
              email: email.trim(),
              phone: phone.trim() || null,
              password,
            }),
          }
        );


        const data = await response.json();


        if (!response.ok || !data.success) {

          setError(
            data.message || "Registration failed."
          );

          setLoading(false);
          return;
        }


        localStorage.setItem(
          USER_STORAGE_KEY,
          JSON.stringify(data.user)
        );


        onLogin(data.user);

        return;
      }


      // =====================================================
      // LOGIN
      // =====================================================

      const response = await fetch(
        `${API_BASE_URL}/login`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        }
      );


      const data = await response.json();


      if (!response.ok || !data.success) {

        setError(
          data.message || "Login failed."
        );

        setLoading(false);
        return;
      }


      localStorage.setItem(
        USER_STORAGE_KEY,
        JSON.stringify(data.user)
      );


      onLogin(data.user);


    } catch (err) {

      console.error(
        "Authentication error:",
        err
      );


      setError(
        "Unable to connect to CivicFix AI. Please make sure the backend is running."
      );


    } finally {

      setLoading(false);
    }
  };


  // =========================================================
  // AUTH UI
  // =========================================================

  return (

    <div className="auth-page">

      <div className="auth-card">


        <div className="auth-logo">

          <div className="auth-logo-icon">
            C
          </div>

          <span>
            CivicFix AI
          </span>

        </div>


        <div className="auth-heading">

          <p className="auth-tagline">
            SMARTER CITIES • BETTER COMMUNITIES
          </p>


          <h1>

            {mode === "login"
              ? "Welcome back"
              : "Create your account"}

          </h1>


          <p>

            {mode === "login"
              ? "Login to report civic issues with AI."
              : "Register once to start reporting civic issues."}

          </p>

        </div>


        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >


          {mode === "register" && (

            <>

              <label>

                Full Name

                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(event) =>
                    setFullName(event.target.value)
                  }
                  autoComplete="name"
                />

              </label>


              <label>

                Phone Number

                <input
                  type="tel"
                  placeholder="Enter your phone number"
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value)
                  }
                  autoComplete="tel"
                />

              </label>

            </>

          )}


          <label>

            Email

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="email"
              required
            />

          </label>


          <label>

            Password

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete={
                mode === "login"
                  ? "current-password"
                  : "new-password"
              }
              required
            />

          </label>


          {error && (

            <div className="auth-error">
              {error}
            </div>

          )}


          {message && (

            <div className="auth-message">
              {message}
            </div>

          )}


          <button
            type="submit"
            className="auth-submit-button"
            disabled={loading}
          >

            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Login"
                : "Create Account"}

          </button>


        </form>


        <div className="auth-switch">

          {mode === "login" ? (

            <>

              <span>
                Don't have an account?
              </span>


              <button
                type="button"
                onClick={() =>
                  switchMode("register")
                }
              >
                Create an account
              </button>

            </>

          ) : (

            <>

              <span>
                Already have an account?
              </span>


              <button
                type="button"
                onClick={() =>
                  switchMode("login")
                }
              >
                Login
              </button>

            </>

          )}

        </div>


      </div>

    </div>

  );
}



// =========================================================
// MAIN APP
// =========================================================

function App() {

  const [currentPage, setCurrentPage] =
    useState("loading");

  const [currentUser, setCurrentUser] =
    useState(null);


  // =========================================================
  // RESTORE SAVED LOGIN
  // =========================================================

  useEffect(() => {

    try {

      const savedUser =
        localStorage.getItem(
          USER_STORAGE_KEY
        );


      if (savedUser) {

        const parsedUser =
          JSON.parse(savedUser);


        if (parsedUser?.id) {

          setCurrentUser(parsedUser);


          // =================================================
          // ADMIN → ADMIN DASHBOARD
          // =================================================

          if (parsedUser.role === "admin") {

            setCurrentPage("admin");

          }


          // =================================================
          // CITIZEN → CAMERA / REPORTING SCREEN
          // =================================================

          else {

            setCurrentPage("report");

          }


          return;
        }
      }


      setCurrentPage("auth");


    } catch (error) {

      console.error(
        "Saved user data error:",
        error
      );


      localStorage.removeItem(
        USER_STORAGE_KEY
      );


      setCurrentPage("auth");
    }

  }, []);


  // =========================================================
  // LOGIN HANDLER
  // =========================================================

  const handleLogin = (user) => {

    setCurrentUser(user);


    // =======================================================
    // ADMIN → ADMIN DASHBOARD
    // =======================================================

    if (user.role === "admin") {

      setCurrentPage("admin");

    }


    // =======================================================
    // CITIZEN → CAMERA / REPORTING SCREEN
    // =======================================================

    else {

      setCurrentPage("report");

    }

  };


  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = () => {

    localStorage.removeItem(
      USER_STORAGE_KEY
    );

    setCurrentUser(null);

    setCurrentPage("auth");
  };


  // =========================================================
  // LOADING
  // =========================================================

  if (currentPage === "loading") {

    return (

      <div className="auth-loading">

        <div className="auth-loading-card">

          <div className="auth-logo-icon">
            C
          </div>

          <h2>
            CivicFix AI
          </h2>

          <p>
            Loading...
          </p>

        </div>

      </div>

    );
  }


  // =========================================================
  // AUTH
  // =========================================================

  if (currentPage === "auth") {

    return (
      <AuthPage
        onLogin={handleLogin}
      />
    );
  }


// =========================================================
// CITIZEN REPORTING / CAMERA
// =========================================================

if (currentPage === "report") {

  return (

    <div className="app">

      <header className="navbar">

        <div className="logo">

          <div className="logo-icon">
            C
          </div>

          <span>
            CivicFix AI
          </span>

        </div>


        <div className="navbar-actions">

          <div className="location">
            📍 Location enabled
          </div>


          <span className="welcome-user">

            Hi{" "}

            {currentUser?.full_name || "User"}

          </span>


          {/* CITIZEN DASHBOARD */}

          {currentUser?.role === "citizen" && (

            <button
              className="admin-nav-button"
              onClick={() =>
                setCurrentPage("dashboard")
              }
            >
              👤 Me
            </button>

          )}


          {/* ADMIN DASHBOARD */}

          {currentUser?.role === "admin" && (

            <button
              className="admin-nav-button"
              onClick={() =>
                setCurrentPage("admin")
              }
            >
              🛠️ Admin Dashboard
            </button>

          )}


                   <button
            className="notification-nav-button"
            onClick={() => setCurrentPage("notifications")}
          >
            🔔 Notifications
          </button>

          <button
            className="logout-button"
            onClick={handleLogout}
          >
            Logout
          </button>

        </div>

      </header>


      {/* CAMERA / REPORT SCREEN */}

      <ReportIssue
        user={currentUser}

        onBack={() =>
          setCurrentPage("report")
        }
      />

    </div>

  );

}


// =========================================================
// CITIZEN DASHBOARD
// =========================================================

if (currentPage === "dashboard") {

  return (

    <UserDashboard
      user={currentUser}

      onBack={() =>
        setCurrentPage("report")
      }
    />

  );

}
if (currentPage === "notifications") {
  return (
    <Notifications
      user={currentUser}
      onBack={() => setCurrentPage("report")}
    />
  );
}
  // =========================================================
  // ADMIN DASHBOARD
  // =========================================================

  if (currentPage === "admin") {

    return (

      <AdminDashboard

        onBack={() =>
          setCurrentPage("home")
        }

      />

    );
  }


  // =========================================================
  // HOME
  // =========================================================

  return (

    <div className="app">


      {/* ===================================================
          NAVBAR
      =================================================== */}

      <header className="navbar">


        <div className="logo">

          <div className="logo-icon">
            C
          </div>

          <span>
            CivicFix AI
          </span>

        </div>


        <div className="navbar-actions">


          <div className="location">
            📍 Location enabled
          </div>


          <span className="welcome-user">

            Hi,{" "}

            {currentUser?.full_name || "User"}

          </span>


          {/* CITIZEN DASHBOARD */}

{currentUser?.role === "citizen" && (
  <button
    className="admin-nav-button"
    onClick={() =>
      setCurrentPage("dashboard")
    }
  >
    👤 Me
  </button>
)}


{/* ADMIN ONLY */}

{currentUser?.role === "admin" && (
  <button
    className="admin-nav-button"
    onClick={() =>
      setCurrentPage("admin")
    }
  >
    🛠️ Admin Dashboard
  </button>
)}

          <button
            className="logout-button"

            onClick={handleLogout}
          >

            Logout

          </button>


        </div>


      </header>


      {/* ===================================================
          HERO
      =================================================== */}

      <main className="hero">


        <div className="hero-content">


          <p className="tagline">
            SMARTER CITIES • BETTER COMMUNITIES
          </p>


          <h1>

            Report Civic Issues

            <br />

            <span>
              with AI
            </span>

          </h1>


          <p className="description">

            Capture a photo of a public issue
            and let CivicFix AI identify it,
            assess its severity, and help you
            report it with the exact location.

          </p>


          <button
            className="report-button"

            onClick={() =>
              setCurrentPage("report")
            }
          >

            📷 Report an Issue

          </button>


          <div className="quick-options">


            <button
              className="option-card"

              onClick={() =>
                setCurrentPage("report")
              }
            >

              <span className="option-icon">
                📷
              </span>


              <div>

                <strong>
                  Camera
                </strong>

                <small>
                  Take a photo
                </small>

              </div>

            </button>


            <button
              className="option-card"

              onClick={() =>
                setCurrentPage("report")
              }
            >

              <span className="option-icon">
                🖼️
              </span>


              <div>

                <strong>
                  Gallery
                </strong>

                <small>
                  Choose an image
                </small>

              </div>

            </button>


          </div>


        </div>


        <div className="hero-visual">


          <div className="visual-card">


            <div className="scan-circle">

              <span>
                📷
              </span>

            </div>


            <h3>
              AI-Powered Detection
            </h3>


            <p>
              Potholes • Garbage • Open Drainage • Cracks
            </p>


            <div className="status">

              <span className="status-dot">
              </span>

              Ready to detect

            </div>


          </div>


        </div>


      </main>


      {/* ===================================================
          FEATURES
      =================================================== */}

      <section className="features">


        <div className="feature">

          <span>
            🤖
          </span>

          <div>

            <h3>
              AI Detection
            </h3>

            <p>
              Automatically identify civic issues.
            </p>

          </div>

        </div>


        <div className="feature">

          <span>
            📍
          </span>

          <div>

            <h3>
              GPS Location
            </h3>

            <p>
              Pinpoint exactly where the issue exists.
            </p>

          </div>

        </div>


        <div className="feature">

          <span>
            ⚡
          </span>

          <div>

            <h3>
              Quick Reporting
            </h3>

            <p>
              Create structured complaints easily.
            </p>

          </div>

        </div>


      </section>


    </div>

  );
}


export default App;