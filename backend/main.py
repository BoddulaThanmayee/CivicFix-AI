from fastapi import FastAPI, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Float,
    DateTime
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from datetime import datetime
from pathlib import Path

import cv2
import numpy as np

from ultralytics import YOLO


# =========================================================
# FASTAPI APP
# =========================================================

app = FastAPI(title="CivicFix AI Backend")


# =========================================================
# CORS CONFIGURATION
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# DATABASE CONFIGURATION
# =========================================================

DATABASE_URL = "sqlite:///./civicfix.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)

    issue = Column(String)
    confidence = Column(Float)
    severity = Column(String)
    department = Column(String)

    area = Column(String, nullable=True)
    village = Column(String, nullable=True)
    district = Column(String, nullable=True)
    state = Column(String, nullable=True)
    country = Column(String, nullable=True)
    full_address = Column(String, nullable=True)

    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# =========================================================
# YOLO MODEL CONFIGURATION
# =========================================================

BASE_DIR = Path(__file__).resolve().parent

# Actual location:
# CivicFix-AI/backend/weights/best.pt

MODEL_PATH = BASE_DIR / "weights" / "best.pt"

print("=" * 60)
print("YOLO MODEL CONFIGURATION")
print("Backend directory:", BASE_DIR)
print("Looking for model at:", MODEL_PATH)
print("Model exists:", MODEL_PATH.is_file())
print("=" * 60)

model = None

if not MODEL_PATH.is_file():

    print("WARNING: YOLO model not found!")
    print("Expected model location:")
    print(MODEL_PATH)

else:

    try:

        model = YOLO(str(MODEL_PATH))

        print("YOLO model loaded successfully!")
        print("Model class names:", model.names)

    except Exception as e:

        print("ERROR loading YOLO model:", e)
        model = None


# =========================================================
# CIVIC ISSUE CLASS NAMES
# =========================================================

# IMPORTANT:
# Class ID 0 is mapped to Open Drainage based on your testing.
#
# If your YOLO dataset was trained with a different order,
# these numbers must match the training dataset.

ISSUE_CLASSES = {
    0: "Open Drainage",
    1: "Pothole",
    2: "Garbage",
    3: "Water Leakage",
    4: "Damaged Road",
    5: "Broken Streetlight"
}


# =========================================================
# PYDANTIC SCHEMA
# =========================================================

class ComplaintRequest(BaseModel):

    issue: str
    confidence: float
    severity: str
    department: str

    area: str | None = None
    village: str | None = None
    district: str | None = None
    state: str | None = None
    country: str | None = None
    full_address: str | None = None

    latitude: float | None = None
    longitude: float | None = None


# =========================================================
# BASIC ROUTES
# =========================================================

@app.get("/")
def home():

    return {
        "message": "CivicFix AI backend is running!",
        "status": "success"
    }


@app.get("/health")
def health():

    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "model_path": str(MODEL_PATH),
        "model_exists": MODEL_PATH.is_file()
    }


# =========================================================
# HELPER FUNCTIONS
# =========================================================

def calculate_severity(confidence: float):

    if confidence >= 0.85:
        return "High"

    elif confidence >= 0.60:
        return "Medium"

    else:
        return "Low"


def get_department(issue: str):

    issue = issue.lower()

    if "pothole" in issue or "road" in issue:
        return "Roads & Infrastructure"

    elif "garbage" in issue or "waste" in issue:
        return "Sanitation Department"

    elif "water" in issue or "leakage" in issue:
        return "Water Supply Department"

    elif "streetlight" in issue or "light" in issue:
        return "Electrical Department"

    elif "drain" in issue or "sewer" in issue:
        return "Drainage & Sanitation Department"

    else:
        return "Municipal Corporation"


# =========================================================
# YOLO CLASS NAME HELPER
# =========================================================

def get_class_name(class_id: int) -> str:

    """
    Converts the YOLO class ID into the correct CivicFix AI
    issue name using the manual class mapping.
    """

    return ISSUE_CLASSES.get(
        class_id,
        "Unknown Civic Issue"
    )


# =========================================================
# YOLO ANALYSIS ROUTE
# =========================================================

@app.post("/analyze")
async def analyze_issue(file: UploadFile = File(...)):

    try:

        # -------------------------------------------------
        # CHECK MODEL
        # -------------------------------------------------

        if model is None:

            return {
                "success": False,
                "message": "YOLO model is not loaded. Check best.pt path."
            }


        # -------------------------------------------------
        # READ UPLOADED IMAGE
        # -------------------------------------------------

        image_bytes = await file.read()

        if not image_bytes:

            return {
                "success": False,
                "message": "Uploaded image is empty."
            }


        image_array = np.frombuffer(
            image_bytes,
            np.uint8
        )

        image = cv2.imdecode(
            image_array,
            cv2.IMREAD_COLOR
        )


        if image is None:

            return {
                "success": False,
                "message": "Unable to read uploaded image."
            }


        # -------------------------------------------------
        # RUN YOLO PREDICTION
        # -------------------------------------------------

        results = model.predict(
            source=image,
            conf=0.25,
            verbose=False
        )


        # -------------------------------------------------
        # CHECK DETECTIONS
        # -------------------------------------------------

        if not results or len(results[0].boxes) == 0:

            return {
                "success": False,
                "message": "No civic issue detected in the image."
            }


        result = results[0]


        # -------------------------------------------------
        # GET HIGHEST CONFIDENCE DETECTION
        # -------------------------------------------------

        best_box = None
        highest_confidence = 0.0

        for box in result.boxes:

            confidence = float(box.conf[0])

            if confidence > highest_confidence:

                highest_confidence = confidence
                best_box = box


        if best_box is None:

            return {
                "success": False,
                "message": "No valid detection found."
            }


        # -------------------------------------------------
        # GET CLASS ID
        # -------------------------------------------------

        class_id = int(best_box.cls[0])

        print("Detected class ID:", class_id)


        # -------------------------------------------------
        # GET CLASS NAME
        # -------------------------------------------------

        issue = get_class_name(class_id)

        print("Detected issue:", issue)


        # -------------------------------------------------
        # CALCULATE CONFIDENCE
        # -------------------------------------------------

        confidence = round(highest_confidence, 4)


        # -------------------------------------------------
        # CALCULATE SEVERITY
        # -------------------------------------------------

        severity = calculate_severity(confidence)


        # -------------------------------------------------
        # ASSIGN DEPARTMENT
        # -------------------------------------------------

        department = get_department(issue)


        # -------------------------------------------------
        # RETURN RESPONSE
        # -------------------------------------------------

        return {

            "success": True,

            "issue": issue,

            "class_id": class_id,

            "confidence": confidence,

            "confidence_percentage": round(
                confidence * 100,
                2
            ),

            "severity": severity,

            "department": department,

            "message": "Civic issue detected successfully."

        }


    except Exception as e:

        print("Analysis Error:", e)

        return {

            "success": False,

            "message": f"Error analyzing image: {str(e)}"

        }


# =========================================================
# SUBMIT COMPLAINT ROUTE
# =========================================================

@app.post("/submit-complaint")
def submit_complaint(
    complaint: ComplaintRequest,
    db: Session = Depends(get_db)
):

    new_complaint = Complaint(

        issue=complaint.issue,
        confidence=complaint.confidence,
        severity=complaint.severity,
        department=complaint.department,

        area=complaint.area,
        village=complaint.village,
        district=complaint.district,
        state=complaint.state,
        country=complaint.country,
        full_address=complaint.full_address,

        latitude=complaint.latitude,
        longitude=complaint.longitude

    )

    db.add(new_complaint)
    db.commit()
    db.refresh(new_complaint)


    return {

        "success": True,

        "message": "Complaint submitted successfully!",

        "complaint_id": f"CIVIC-{new_complaint.id:04d}",

        "submitted_at": new_complaint.created_at

    }


# =========================================================
# VIEW ALL COMPLAINTS
# =========================================================

@app.get("/complaints")
def get_complaints(db: Session = Depends(get_db)):

    complaints = db.query(Complaint).order_by(
        Complaint.created_at.desc()
    ).all()

    return complaints