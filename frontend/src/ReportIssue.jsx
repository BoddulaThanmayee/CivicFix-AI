import { useRef, useState, useEffect } from "react";
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

// Backend URL
// Change this later when deploying the backend.
const API_BASE_URL = "http://127.0.0.1:8000";

function ReportIssue({ onBack }) {
  const [image, setImage] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const [analysisResult, setAnalysisResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Location states
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState("");
  const [address, setAddress] = useState(null);

  // Complaint states
  const [complaintSubmitted, setComplaintSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [complaintId, setComplaintId] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // ----------------------------------
  // Reset previous complaint data
  // ----------------------------------
  const resetComplaintData = () => {
    setAnalysisResult(null);
    setComplaintSubmitted(false);
    setComplaintId(null);
  };

  // ----------------------------------
  // Get current GPS location
  // ----------------------------------
  const getCurrentLocation = () => {
    setLocationLoading(true);
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError(
        "Geolocation is not supported by this browser."
      );
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        setLocation({
          latitude,
          longitude,
        });

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
          console.error("Address fetching error:", error);

          setLocationError(
            "Location found, but address could not be retrieved."
          );
        }

        setLocationLoading(false);
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

  // Automatically request location when page opens
  useEffect(() => {
    getCurrentLocation();

    return () => {
      stopCamera();
    };
  }, []);

  // ----------------------------------
  // Analyze image using FastAPI
  // ----------------------------------
  const analyzeIssue = async () => {
    if (!selectedFile) {
      alert("Please capture or select an image first.");
      return;
    }

    setAnalyzing(true);
    setAnalysisResult(null);
    setComplaintSubmitted(false);
    setComplaintId(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

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

      alert(
        "Unable to analyze the image. Make sure the FastAPI backend is running."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  // ----------------------------------
  // Submit complaint
  // ----------------------------------
  const submitComplaint = async () => {
    if (!analysisResult) {
      alert("Please analyze the image first.");
      return;
    }

    if (!location) {
      alert("Please detect your location first.");
      return;
    }

    if (!address) {
      alert("Address details are not available yet.");
      return;
    }

    setSubmitting(true);

    try {
      const complaintData = {
        issue: analysisResult.issue,
        confidence: analysisResult.confidence,
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

      setComplaintId(response.data.complaint_id);
      setComplaintSubmitted(true);

      alert("Complaint submitted successfully!");
    } catch (error) {
      console.error("Submission error:", error);

      alert(
        "Unable to submit complaint. Make sure the backend has the /submit-complaint endpoint."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ----------------------------------
  // Gallery image selection
  // ----------------------------------
  const handleImageChange = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    setImage(URL.createObjectURL(file));
    setSelectedFile(file);
    resetComplaintData();
  };

  // ----------------------------------
  // Open camera
  // ----------------------------------
  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraOpen(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (error) {
      console.error("Camera error:", error);

      alert(
        "Unable to access the camera. Please allow camera permission in your browser."
      );
    }
  };

  // ----------------------------------
  // Capture camera photo
  // ----------------------------------
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
        if (blob) {
          const file = new File(
            [blob],
            "civic-issue.jpg",
            {
              type: "image/jpeg",
            }
          );

          setImage(URL.createObjectURL(blob));
          setSelectedFile(file);
          resetComplaintData();

          closeCamera();
        }
      },
      "image/jpeg",
      0.9
    );
  };

  // ----------------------------------
  // Stop camera stream
  // ----------------------------------
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      streamRef.current = null;
    }
  };

  // ----------------------------------
  // Close camera
  // ----------------------------------
  const closeCamera = () => {
    stopCamera();
    setCameraOpen(false);
  };

  // ----------------------------------
  // Remove selected image
  // ----------------------------------
  const removeImage = () => {
    if (image) {
      URL.revokeObjectURL(image);
    }

    setImage(null);
    setSelectedFile(null);
    resetComplaintData();
  };

  // ----------------------------------
  // UI
  // ----------------------------------
  return (
    <div className="report-page">

      {/* Header */}
      <header className="report-header">
        <button
          className="back-button"
          onClick={() => {
            closeCamera();
            onBack();
          }}
        >
          ← Back
        </button>

        <h2>CivicFix AI</h2>

        <span className="step-text">
          Step 1 of 4
        </span>
      </header>


      {/* Main Content */}
      <main className="report-container">

        <div className="report-title">
          <p className="report-label">
            REPORT A CIVIC ISSUE
          </p>

          <h1>
            What did you find?
          </h1>

          <p>
            Take a photo or choose an existing image of
            the public issue. Our AI will analyze it
            automatically.
          </p>
        </div>


        {/* =========================
            GPS LOCATION
        ========================= */}

        <div className="location-section">

          <h3>📍 Detected Location</h3>

          {locationLoading ? (
            <p>Getting your location...</p>
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

                <p>
                  <strong>Country:</strong>{" "}
                  {address.country}
                </p>

                <p>
                  <strong>Full Address:</strong>{" "}
                  {address.fullAddress}
                </p>

                <p>
                  <strong>Latitude:</strong>{" "}
                  {location.latitude}
                </p>

                <p>
                  <strong>Longitude:</strong>{" "}
                  {location.longitude}
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
                    height: "300px",
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
              ? "Getting Location..."
              : "📍 Refresh Location"}
          </button>

        </div>


        {/* =========================
            CAMERA
        ========================= */}

        {cameraOpen && !image && (

          <div className="camera-area">

            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="camera-video"
            />

            <div className="camera-controls">

              <button
                className="cancel-camera"
                onClick={closeCamera}
              >
                Cancel
              </button>

              <button
                className="capture-button"
                onClick={capturePhoto}
              >
                📷 Capture
              </button>

            </div>

          </div>

        )}


        {/* =========================
            UPLOAD AREA
        ========================= */}

        {!cameraOpen && !image && (

          <div className="upload-area">

            <div className="upload-icon">
              📷
            </div>

            <h2>
              Capture the issue
            </h2>

            <p>
              Take a clear photo of the problem or select
              one from your gallery.
            </p>


            <div className="upload-buttons">

              <button
                className="camera-button"
                onClick={openCamera}
              >
                📷 Open Camera
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


            <div className="photo-tip">
              💡 Tip: Take a clear photo showing the
              entire issue.
            </div>

          </div>

        )}


        {/* =========================
            IMAGE PREVIEW
        ========================= */}

        {image && (

          <div className="preview-area">

            <div className="preview-header">

              <h2>
                Image Preview
              </h2>

              <button
                className="remove-button"
                onClick={removeImage}
              >
                Remove
              </button>

            </div>


            <img
              src={image}
              alt="Selected civic issue"
              className="issue-preview"
            />


            {/* Analyze Button */}

            <button
              className="analyze-button"
              onClick={analyzeIssue}
              disabled={analyzing}
            >
              {analyzing
                ? "⏳ Analyzing..."
                : "🔍 Analyze Issue with AI"}
            </button>


            {/* AI Result */}

            {analysisResult && (

              <div className="analysis-result">

                <h3>🤖 AI Detection Results</h3>

                {analysisResult.filename && (
                  <p>
                    <strong>File:</strong>{" "}
                    {analysisResult.filename}
                  </p>
                )}

                {analysisResult.image_width && (
                  <p>
                    <strong>Image Size:</strong>{" "}
                    {analysisResult.image_width} ×{" "}
                    {analysisResult.image_height}
                  </p>
                )}

                {analysisResult.message && (
                  <p className="success-message">
                    {analysisResult.message}
                  </p>
                )}


                {analysisResult.issue ? (

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
                          {analysisResult.confidence}%
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


                    {analysisResult.detections &&
                      analysisResult.detections.length > 0 && (

                        <>
                          <h4>Detected Objects</h4>

                          <div className="detections-list">

                            {analysisResult.detections.map(
                              (detection, index) => (

                                <div
                                  className="detection-item"
                                  key={index}
                                >

                                  <strong>
                                    {detection.object}
                                  </strong>

                                  <span>
                                    Confidence:{" "}
                                    {detection.confidence}%
                                  </span>

                                  <span>
                                    Severity:{" "}
                                    {detection.severity}
                                  </span>

                                  <span>
                                    Department:{" "}
                                    {detection.department}
                                  </span>

                                  {detection.bounding_box && (
                                    <small>
                                      Position: (
                                      {detection.bounding_box.x1},{" "}
                                      {detection.bounding_box.y1}
                                      ) to (
                                      {detection.bounding_box.x2},{" "}
                                      {detection.bounding_box.y2}
                                      )
                                    </small>
                                  )}

                                </div>

                              )
                            )}

                          </div>

                        </>

                      )}

                  </>

                ) : (

                  <p className="no-detection">
                    No civic issue detected in this image.
                  </p>

                )}

              </div>

            )}


            {/* Complaint Submission */}

            {analysisResult &&
              analysisResult.issue &&
              !complaintSubmitted && (

                <button
                  className="submit-complaint-button"
                  onClick={submitComplaint}
                  disabled={submitting}
                >
                  {submitting
                    ? "⏳ Submitting Complaint..."
                    : "🚨 Submit Complaint"}
                </button>

              )}


            {/* Complaint Success */}

            {complaintSubmitted && (

              <div className="complaint-success">

                <h3>✅ Complaint Submitted Successfully</h3>

                <p>
                  Your civic issue has been registered.
                </p>

                {complaintId && (
                  <p>
                    <strong>Complaint ID:</strong>{" "}
                    {complaintId}
                  </p>
                )}

                <p>
                  Department:{" "}
                  {analysisResult.department}
                </p>

                <p>
                  Status: Submitted
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