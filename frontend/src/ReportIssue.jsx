import { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./ReportIssue.css";

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const API_BASE_URL = "http://127.0.0.1:8000";

function ReportIssue({ onBack, user }) {
  const [image, setImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);

  const [analysisResult, setAnalysisResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState("");
  const [address, setAddress] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [complaintSubmitted, setComplaintSubmitted] = useState(false);
  const [complaintId, setComplaintId] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // --------------------------------------------------
  // STOP CAMERA
  // --------------------------------------------------
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // --------------------------------------------------
  // GET GPS + REVERSE GEOCODE
  // --------------------------------------------------
  const getCurrentLocation = () => {
    setLocationLoading(true);
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser.");
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        setLocation({ latitude, longitude });

        try {
          const response = await axios.get(
            "https://nominatim.openstreetmap.org/reverse",
            {
              params: {
                lat: latitude,
                lon: longitude,
                format: "json",
                addressdetails: 1,
              },
              headers: {
                Accept: "application/json",
              },
            }
          );

          const data = response.data;
          const addressData = data.address || {};

          setAddress({
            area:
              addressData.suburb ||
              addressData.neighbourhood ||
              addressData.village ||
              addressData.town ||
              "Not available",

            village:
              addressData.village ||
              addressData.town ||
              addressData.city ||
              "Not available",

            district:
              addressData.county ||
              addressData.district ||
              "Not available",

            state: addressData.state || "Not available",
            country: addressData.country || "India",
            fullAddress:
              data.display_name || "Address not available",
          });

          setLocationError("");
        } catch (error) {
          console.error("Reverse geocoding error:", error);
          setLocationError(
            "Location found, but the readable address could not be retrieved."
          );
        } finally {
          setLocationLoading(false);
        }
      },
      (error) => {
        console.error("Location error:", error);
        setLocationError(
          "Unable to get your location. Please allow location permission."
        );
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // --------------------------------------------------
  // ANALYZE IMAGE AUTOMATICALLY
  // --------------------------------------------------
  const analyzeFile = async (file) => {
    if (!file) return;

    setSelectedFile(file);
    setAnalysisResult(null);
    setComplaintSubmitted(false);
    setComplaintId(null);
    setAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await axios.post(
        `${API_BASE_URL}/analyze`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setAnalysisResult(response.data);
    } catch (error) {
      console.error("Analysis error:", error);

      setAnalysisResult({
        success: false,
        message:
          "Unable to analyze the image. Please make sure the backend is running.",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // --------------------------------------------------
  // OPEN CAMERA
  // --------------------------------------------------
  const openCamera = async () => {
    try {
      setCameraStarting(true);
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraOpen(true);

      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
    } catch (error) {
      console.error("Camera error:", error);
      setCameraOpen(false);
      alert(
        "Unable to access the camera. Please allow camera permission or use Gallery."
      );
    } finally {
      setCameraStarting(false);
    }
  };

  // --------------------------------------------------
  // CAPTURE PHOTO → AUTOMATIC ANALYSIS
  // --------------------------------------------------
  const capturePhoto = () => {
    const video = videoRef.current;

    if (!video || video.videoWidth === 0) {
      alert("Camera is not ready yet. Please wait a moment.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const file = new File(
          [blob],
          "civic-issue.jpg",
          { type: "image/jpeg" }
        );

        const previewUrl = URL.createObjectURL(blob);

        setImage((oldImage) => {
          if (oldImage) URL.revokeObjectURL(oldImage);
          return previewUrl;
        });

        stopCamera();
        setCameraOpen(false);

        // No Analyze button — analysis starts immediately.
        analyzeFile(file);
      },
      "image/jpeg",
      0.9
    );
  };

  // --------------------------------------------------
  // GALLERY → AUTOMATIC ANALYSIS
  // --------------------------------------------------
  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const previewUrl = URL.createObjectURL(file);

    setImage((oldImage) => {
      if (oldImage) URL.revokeObjectURL(oldImage);
      return previewUrl;
    });

    stopCamera();
    setCameraOpen(false);

    // No Analyze button — analysis starts immediately.
    analyzeFile(file);

    event.target.value = "";
  };

  // --------------------------------------------------
  // REMOVE IMAGE / START AGAIN
  // --------------------------------------------------
  const removeImage = () => {
    stopCamera();

    setImage((oldImage) => {
      if (oldImage) URL.revokeObjectURL(oldImage);
      return null;
    });

    setSelectedFile(null);
    setAnalysisResult(null);
    setComplaintSubmitted(false);
    setComplaintId(null);

    // Return to the camera-first state.
    openCamera();
  };

  // --------------------------------------------------
  // SUBMIT COMPLAINT
  // --------------------------------------------------
  const submitComplaint = async () => {
    if (!user?.id) {
      alert("User information is missing. Please login again.");
      return;
    }

    if (!analysisResult?.issue) {
      alert("No civic issue was detected.");
      return;
    }

    if (!location || !address) {
      alert("Location information is not available yet.");
      return;
    }

    setSubmitting(true);

    try {
      const complaintData = {
        user_id: user.id,

        issue: analysisResult.issue,
        confidence:
          analysisResult.confidence_percentage !== undefined
            ? analysisResult.confidence_percentage / 100
            : analysisResult.confidence,

        severity: analysisResult.severity,
        department: analysisResult.department,

        area: address.area,
        village: address.village,
        district: address.district,
        state: address.state,
        country: address.country,
        full_address: address.fullAddress,

        latitude: location.latitude,
        longitude: location.longitude,
      };

      const response = await axios.post(
        `${API_BASE_URL}/submit-complaint`,
        complaintData
      );

      if (response.data.success) {
        setComplaintId(response.data.complaint_id);
        setComplaintSubmitted(true);
      } else {
        alert(
          response.data.message ||
            "Unable to submit the complaint."
        );
      }
    } catch (error) {
      console.error("Submission error:", error);

      alert(
        "Unable to submit complaint. Please make sure the backend is running."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // --------------------------------------------------
  // CAMERA + LOCATION ON PAGE OPEN
  // --------------------------------------------------
  useEffect(() => {
    getCurrentLocation();
    openCamera();

    return () => {
      stopCamera();
    };
  }, []);

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <div className="report-page">

      {/* HEADER */}
      <header className="report-header">
        <button
          className="back-button"
          onClick={() => {
            stopCamera();
            onBack();
          }}
        >
          ← Back
        </button>

        <h2>CivicFix AI</h2>

        <div className="report-user">
          👤 {user?.full_name || "User"}
        </div>
      </header>

      <main className="report-container">

        {/* TITLE */}
        <div className="report-title">
          <p className="report-label">
            AI-POWERED CIVIC REPORTING
          </p>

          <h1>Report an Issue</h1>

          <p>
            Capture a civic issue or choose an image.
            CivicFix AI will automatically identify the
            issue, assess its severity, assign the department,
            and locate it.
          </p>
        </div>

        {/* LOCATION STATUS */}
        <div className="location-section">

          <h3>📍 Current Location</h3>

          {locationLoading ? (
            <p>Detecting your location...</p>
          ) : location && address ? (
            <>
              <div className="location-details">
                <p>
                  <strong>Area:</strong>{" "}
                  {address.area}
                </p>

                <p>
                  <strong>Village / Town:</strong>{" "}
                  {address.village}
                </p>

                <p>
                  <strong>District:</strong>{" "}
                  {address.district}
                </p>

                <p>
                  <strong>State:</strong>{" "}
                  {address.state}
                </p>
              </div>

              <div className="map-container">
                <MapContainer
                  center={[
                    location.latitude,
                    location.longitude,
                  ]}
                  zoom={16}
                  scrollWheelZoom={true}
                  style={{
                    height: "260px",
                    width: "100%",
                  }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  <Marker
                    position={[
                      location.latitude,
                      location.longitude,
                    ]}
                  >
                    <Popup>
                      <strong>CivicFix AI Location</strong>
                      <br />
                      {address.area}, {address.state}
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
            </>
          ) : (
            <p className="location-error">
              {locationError}
            </p>
          )}

          <button
            className="location-button"
            onClick={getCurrentLocation}
            disabled={locationLoading}
          >
            {locationLoading
              ? "Detecting..."
              : "📍 Refresh Location"}
          </button>
        </div>

        {/* CAMERA / GALLERY */}
        {!image && !cameraOpen && (
          <div className="upload-area">
            <div className="upload-icon">📷</div>

            <h2>Start your report</h2>

            <p>
              Open your camera to capture the issue,
              or select an image from your gallery.
            </p>

            <div className="upload-buttons">
              <button
                className="camera-button"
                onClick={openCamera}
                disabled={cameraStarting}
              >
                {cameraStarting
                  ? "Opening Camera..."
                  : "📷 Open Camera"}
              </button>

              <label className="gallery-button">
                🖼️ Choose from Gallery

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  hidden
                />
              </label>
            </div>
          </div>
        )}

        {/* CAMERA */}
        {cameraOpen && (
          <div className="camera-area">
            <div className="camera-heading">
              <span>🔴 CAMERA ACTIVE</span>
              <small>Point the camera at the civic issue</small>
            </div>

            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="camera-video"
            />

            <div className="camera-controls">
              <label className="gallery-button">
                🖼️ Gallery

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  hidden
                />
              </label>

              <button
                className="capture-button"
                onClick={capturePhoto}
              >
                📷 Capture & Analyze
              </button>
            </div>
          </div>
        )}

        {/* SELECTED IMAGE */}
        {image && (
          <div className="preview-area">

            <div className="preview-header">
              <h2>📷 Captured Image</h2>

              <button
                className="remove-button"
                onClick={removeImage}
                disabled={analyzing || submitting}
              >
                Retake
              </button>
            </div>

            <img
              src={image}
              alt="Selected civic issue"
              className="issue-preview"
            />

            {/* AUTOMATIC ANALYSIS */}
            {analyzing && (
              <div className="analysis-loading">
                <div className="analysis-spinner"></div>

                <h3>🤖 AI is analyzing the image...</h3>

                <p>
                  Detecting the civic issue, confidence,
                  severity and responsible department.
                </p>
              </div>
            )}

            {/* AI RESULT */}
            {!analyzing && analysisResult && (
              <div className="analysis-result">

                <h3>🤖 AI Detection Result</h3>

                {analysisResult.success &&
                analysisResult.issue ? (
                  <>
                    <div className="issue-summary">

                      <div className="result-card">
                        <span className="result-label">
                          Detected Issue
                        </span>

                        <strong>
                          {analysisResult.issue}
                        </strong>
                      </div>

                      <div className="result-card">
                        <span className="result-label">
                          Confidence
                        </span>

                        <strong>
                          {analysisResult.confidence_percentage !==
                          undefined
                            ? `${analysisResult.confidence_percentage}%`
                            : `${(
                                analysisResult.confidence * 100
                              ).toFixed(2)}%`}
                        </strong>
                      </div>

                      <div className="result-card">
                        <span className="result-label">
                          Severity
                        </span>

                        <strong>
                          {analysisResult.severity}
                        </strong>
                      </div>

                      <div className="result-card">
                        <span className="result-label">
                          Department
                        </span>

                        <strong>
                          {analysisResult.department}
                        </strong>
                      </div>

                    </div>

                    {/* COMPLAINT REPORT FOR VERIFICATION */}
                    {location && address && (
                      <div className="complaint-report">

                        <h3>📄 Complaint Report</h3>

                        <div className="complaint-report-grid">

                          <p>
                            <strong>Issue:</strong>{" "}
                            {analysisResult.issue}
                          </p>

                          <p>
                            <strong>Severity:</strong>{" "}
                            {analysisResult.severity}
                          </p>

                          <p>
                            <strong>Department:</strong>{" "}
                            {analysisResult.department}
                          </p>

                          <p>
                            <strong>Area:</strong>{" "}
                            {address.area}
                          </p>

                          <p>
                            <strong>Village / Town:</strong>{" "}
                            {address.village}
                          </p>

                          <p>
                            <strong>District:</strong>{" "}
                            {address.district}
                          </p>

                          <p>
                            <strong>State:</strong>{" "}
                            {address.state}
                          </p>

                          <p>
                            <strong>Country:</strong>{" "}
                            {address.country}
                          </p>

                          <p className="full-address">
                            <strong>Location:</strong>{" "}
                            {address.fullAddress}
                          </p>

                        </div>

                        <div className="verification-box">
                          <strong>
                            Please verify the report
                          </strong>

                          <p>
                            The AI has automatically prepared
                            the complaint. If the detected issue
                            and location are correct, press
                            Submit Complaint.
                          </p>
                        </div>

                        <button
                          className="submit-complaint-button"
                          onClick={submitComplaint}
                          disabled={
                            submitting ||
                            complaintSubmitted
                          }
                        >
                          {submitting
                            ? "⏳ Submitting..."
                            : "📤 Verify & Submit Complaint"}
                        </button>

                      </div>
                    )}
                  </>
                ) : (
                  <div className="no-detection">
                    <h3>⚠️ No Civic Issue Detected</h3>

                    <p>
                      CivicFix AI could not identify a supported
                      civic issue in this image.
                    </p>

                    <button
                      className="camera-button"
                      onClick={removeImage}
                    >
                      📷 Try Another Image
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* SUCCESS */}
            {complaintSubmitted && (
              <div className="complaint-success">

                <div className="success-icon">✓</div>

                <h3>
                  Complaint Submitted Successfully!
                </h3>

                <p>
                  Your civic issue has been registered and
                  forwarded to the concerned department.
                </p>

                {complaintId && (
                  <p className="complaint-id">
                    <strong>Complaint ID:</strong>{" "}
                    {complaintId}
                  </p>
                )}

                <p>
                  <strong>Status:</strong> Submitted
                </p>

              </div>
            )}

          </div>
        )}

      </main>
    </div>
  );
}

export default ReportIssue;
