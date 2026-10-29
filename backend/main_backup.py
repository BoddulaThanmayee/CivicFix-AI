from fastapi import FastAPI, UploadFile, File, Depends

from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel

from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Float,
    DateTime,
    text
)

from sqlalchemy.orm import declarative_base, sessionmaker, Session

from datetime import datetime
from pathlib import Path
import hashlib
import secrets

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
    allow_headers=["*"]
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


# =========================================================
# DATABASE MODEL
# =========================================================

class User(Base):

    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    full_name = Column(
        String,
        nullable=False
    )

    email = Column(
        String,
        unique=True,
        index=True,
        nullable=False
    )

    phone = Column(
        String,
        nullable=True
    )

    password_hash = Column(
        String,
        nullable=False
    )

    role = Column(
        String,
        default="citizen",
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


class Complaint(Base):

    __tablename__ = "complaints"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id = Column(
        Integer,
        nullable=True,
        index=True
    )

    issue = Column(String)

    confidence = Column(Float)

    severity = Column(String)

    department = Column(String)

    area = Column(
        String,
        nullable=True
    )

    village = Column(
        String,
        nullable=True
    )

    district = Column(
        String,
        nullable=True
    )

    state = Column(
        String,
        nullable=True
    )

    country = Column(
        String,
        nullable=True
    )

    full_address = Column(
        String,
        nullable=True
    )

    latitude = Column(
        Float,
        nullable=True
    )

    longitude = Column(
        Float,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    status = Column(
        String,
        default="Submitted"
    )


# Create database tables

Base.metadata.create_all(bind=engine)


# =========================================================
# NOTIFICATION DATABASE MODEL
# =========================================================

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    complaint_id = Column(Integer, nullable=True, index=True)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    status = Column(String, nullable=True)
    is_read = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


Notification.__table__.create(
    bind=engine,
    checkfirst=True
)

# =========================================================
# ADD STATUS COLUMN TO EXISTING DATABASE
# =========================================================

with engine.connect() as connection:

    columns = connection.execute(
        text("PRAGMA table_info(complaints)")
    ).fetchall()

    column_names = [column[1] for column in columns]

    if "status" not in column_names:

        connection.execute(
            text(
                "ALTER TABLE complaints "
                "ADD COLUMN status VARCHAR DEFAULT 'Submitted'"
            )
        )

        connection.commit()


# =========================================================
# DATABASE MIGRATION FOR USER ID
# =========================================================

with engine.connect() as connection:

    columns = connection.execute(
        text("PRAGMA table_info(complaints)")
    ).fetchall()

    column_names = [column[1] for column in columns]

    if "user_id" not in column_names:

        connection.execute(
            text(
                "ALTER TABLE complaints "
                "ADD COLUMN user_id INTEGER"
            )
        )

        connection.commit()


# =========================================================
# PASSWORD HELPERS
# =========================================================

# =========================================================
# DATABASE MIGRATION FOR USER ROLE
# =========================================================

with engine.connect() as connection:

    columns = connection.execute(
        text("PRAGMA table_info(users)")
    ).fetchall()

    column_names = [column[1] for column in columns]

    if "role" not in column_names:

        connection.execute(
            text(
                "ALTER TABLE users "
                "ADD COLUMN role VARCHAR DEFAULT 'citizen'"
            )
        )

        connection.commit()


def hash_password(password: str) -> str:

    salt = secrets.token_hex(16)

    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000
    ).hex()

    return f"{salt}${password_hash}"


def verify_password(
    password: str,
    stored_password: str
) -> bool:

    try:

        salt, stored_hash = stored_password.split("$")

        password_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            100000
        ).hex()

        return secrets.compare_digest(
            password_hash,
            stored_hash
        )

    except Exception:

        return False


# =========================================================
# DATABASE DEPENDENCY
# =========================================================

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

MODEL_PATH = (
    BASE_DIR /
    "weights" /
    "civicfix_best.pt"
)


print()

print("=" * 70)

print("CIVICFIX AI - YOLO MODEL CONFIGURATION")

print("=" * 70)

print(
    "Backend directory:",
    BASE_DIR
)

print(
    "Model path:",
    MODEL_PATH
)

print(
    "Model exists:",
    MODEL_PATH.is_file()
)

print("=" * 70)


# =========================================================
# LOAD YOLO MODEL
# =========================================================

model = None

if not MODEL_PATH.is_file():

    print()

    print("WARNING: YOLO MODEL NOT FOUND!")

    print(
        "Expected model:",
        MODEL_PATH
    )

    print()

else:

    try:

        model = YOLO(
            str(MODEL_PATH)
        )

        print()

        print(
            "YOLO model loaded successfully!"
        )

        print(
            "YOLO model names:",
            model.names
        )

        print()

    except Exception as e:

        print()

        print(
            "ERROR loading YOLO model:"
        )

        print(e)

        print()

        model = None


# =========================================================
# CIVIC ISSUE CLASS MAPPING
# =========================================================

ISSUE_CLASSES = {

    0: "Pothole",

    1: "Garbage",

    2: "Open Drainage",

    3: "Cracks"

}


# =========================================================
# PYDANTIC COMPLAINT SCHEMA
# =========================================================

class RegisterRequest(BaseModel):

    full_name: str

    email: str

    phone: str | None = None

    password: str


class LoginRequest(BaseModel):

    email: str

    password: str


class ComplaintRequest(BaseModel):

    user_id: int | None = None

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
# HOME ROUTE
# =========================================================

@app.get("/")
def home():

    return {

        "message":
            "CivicFix AI backend is running!",

        "status":
            "success"

    }


# =========================================================
# HEALTH ROUTE
# =========================================================

@app.get("/health")
def health():

    return {

        "status":
            "healthy",

        "model_loaded":
            model is not None,

        "model_path":
            str(MODEL_PATH),

        "model_exists":
            MODEL_PATH.is_file(),

        "model_classes":
            model.names
            if model is not None
            else None

    }


# =========================================================
# USER REGISTRATION
# =========================================================

@app.post("/register")
def register_user(
    user: RegisterRequest,
    db: Session = Depends(get_db)
):

    try:

        full_name = user.full_name.strip()

        email = user.email.strip().lower()

        if not full_name:

            return {
                "success": False,
                "message": "Full name is required."
            }

        if not email:

            return {
                "success": False,
                "message": "Email is required."
            }

        if len(user.password) < 6:

            return {
                "success": False,
                "message": "Password must contain at least 6 characters."
            }

        existing_user = (
            db.query(User)
            .filter(User.email == email)
            .first()
        )

        if existing_user:

            return {
                "success": False,
                "message": "An account with this email already exists."
            }

        new_user = User(
            full_name=full_name,
            email=email,
            phone=user.phone.strip() if user.phone else None,
            password_hash=hash_password(user.password)
        )

        db.add(new_user)

        db.commit()

        db.refresh(new_user)

        return {

            "success": True,

            "message": "Registration successful.",

            "user": {

                "id": new_user.id,

                "full_name": new_user.full_name,

                "email": new_user.email,

                "phone": new_user.phone,

                "role": new_user.role

            }

        }

    except Exception as e:

        db.rollback()

        print(
            "Registration error:",
            str(e)
        )

        return {

            "success": False,

            "message":
                f"Registration failed: {str(e)}"

        }


# =========================================================
# USER LOGIN
# =========================================================

@app.post("/login")
def login_user(
    user: LoginRequest,
    db: Session = Depends(get_db)
):

    email = user.email.strip().lower()

    existing_user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if not existing_user:

        return {
            "success": False,
            "message": "No account found with this email."
        }

    if not verify_password(
        user.password,
        existing_user.password_hash
    ):

        return {
            "success": False,
            "message": "Incorrect password."
        }

    return {

        "success": True,

        "message": "Login successful.",

        "user": {

            "id": existing_user.id,

            "full_name": existing_user.full_name,

            "email": existing_user.email,

            "phone": existing_user.phone,

            "role": existing_user.role

        }

    }


# =========================================================
# SEVERITY CALCULATION
# =========================================================

def calculate_severity(
    confidence: float
):

    if confidence >= 0.85:

        return "High"

    elif confidence >= 0.60:

        return "Medium"

    else:

        return "Low"


# =========================================================
# DEPARTMENT ASSIGNMENT
# =========================================================

def get_department(
    issue: str
):

    issue = issue.lower()

    if (
        "pothole" in issue
        or "crack" in issue
        or "road" in issue
    ):

        return "Roads & Infrastructure"

    elif (
        "garbage" in issue
        or "waste" in issue
    ):

        return "Sanitation Department"

    elif (
        "water" in issue
        or "leakage" in issue
    ):

        return "Water Supply Department"

    elif (
        "streetlight" in issue
        or "light" in issue
    ):

        return "Electrical Department"

    elif (
        "drain" in issue
        or "sewer" in issue
        or "manhole" in issue
    ):

        return "Drainage & Sanitation Department"

    else:

        return "Municipal Corporation"


# =========================================================
# CLASS NAME FUNCTION
# =========================================================

def get_class_name(
    class_id: int
) -> str:

    return ISSUE_CLASSES.get(
        class_id,
        "Unknown Civic Issue"
    )
# =========================================================
# ANALYZE IMAGE
# =========================================================

@app.post("/analyze")
async def analyze_issue(
    file: UploadFile = File(...)
):

    try:

        # =================================================
        # CHECK MODEL
        # =================================================

        if model is None:

            return {

                "success": False,

                "message":
                    "YOLO model is not loaded. "
                    "Check civicfix_best.pt path."

            }


        # =================================================
        # CHECK FILE
        # =================================================

        if file is None:

            return {

                "success": False,

                "message":
                    "No image file received."

            }


        # =================================================
        # READ IMAGE
        # =================================================

        image_bytes = await file.read()

        if not image_bytes:

            return {

                "success": False,

                "message":
                    "Uploaded image is empty."

            }


        print()

        print("=" * 70)

        print("CIVICFIX AI - NEW IMAGE ANALYSIS")

        print("=" * 70)

        print(
            "Filename:",
            file.filename
        )

        print(
            "File size:",
            len(image_bytes),
            "bytes"
        )


        # =================================================
        # CONVERT BYTES TO NUMPY ARRAY
        # =================================================

        image_array = np.frombuffer(
            image_bytes,
            dtype=np.uint8
        )


        # =================================================
        # DECODE IMAGE USING OPENCV
        # =================================================

        image = cv2.imdecode(
            image_array,
            cv2.IMREAD_COLOR
        )

        if image is None:

            return {

                "success": False,

                "message":
                    "Unable to read uploaded image."

            }


        print(
            "Image shape:",
            image.shape
        )


        # =================================================
        # RUN YOLO
        # =================================================

        print(
            "Running YOLO prediction..."
        )

        results = model.predict(
            source=image,
            conf=0.25,
            verbose=False
        )


        # =================================================
        # CHECK YOLO RESULT
        # =================================================

        if (
            not results
            or len(results) == 0
        ):

            return {

                "success": False,

                "message":
                    "YOLO returned no results."

            }


        result = results[0]


        # =================================================
        # CHECK DETECTIONS
        # =================================================

        if (
            result.boxes is None
            or len(result.boxes) == 0
        ):

            print(
                "No civic issue detected."
            )

            return {

                "success": False,

                "message":
                    "No civic issue detected in the image."

            }


        # =================================================
        # FIND HIGHEST CONFIDENCE DETECTION
        # =================================================

        best_box = None

        highest_confidence = 0.0


        for box in result.boxes:

            current_confidence = float(
                box.conf[0]
            )

            current_class_id = int(
                box.cls[0]
            )


            print(
                "Detection:"
            )

            print(
                "  Class ID:",
                current_class_id
            )

            print(
                "  Confidence:",
                current_confidence
            )


            if (
                current_confidence
                > highest_confidence
            ):

                highest_confidence = (
                    current_confidence
                )

                best_box = box


        # =================================================
        # CHECK BEST DETECTION
        # =================================================

        if best_box is None:

            return {

                "success": False,

                "message":
                    "No valid detection found."

            }


        # =================================================
        # GET CLASS ID
        # =================================================

        class_id = int(
            best_box.cls[0]
        )

        print()

        print(
            "Best detection class ID:",
            class_id
        )


        # =================================================
        # GET ISSUE NAME
        # =================================================

        issue = get_class_name(
            class_id
        )

        print(
            "Detected issue:",
            issue
        )


        # =================================================
        # CONFIDENCE
        # =================================================

        confidence = round(
            highest_confidence,
            4
        )

        confidence_percentage = round(
            confidence * 100,
            2
        )

        print(
            "Raw confidence:",
            confidence
        )

        print(
            "Confidence percentage:",
            confidence_percentage,
            "%"
        )


        # =================================================
        # CALCULATE SEVERITY
        # =================================================

        severity = calculate_severity(
            confidence
        )

        print(
            "Severity:",
            severity
        )


        # =================================================
        # ASSIGN DEPARTMENT
        # =================================================

        department = get_department(
            issue
        )

        print(
            "Department:",
            department
        )


        print("=" * 70)

        print(
            "IMAGE ANALYSIS COMPLETED"
        )

        print("=" * 70)

        print()


        # =================================================
        # RETURN RESULT
        # =================================================

        return {

            "success": True,

            "issue":
                issue,

            "class_id":
                class_id,

            "confidence":
                confidence,

            "confidence_percentage":
                confidence_percentage,

            "severity":
                severity,

            "department":
                department,

            "message":
                "Civic issue detected successfully."

        }


    # =====================================================
    # ERROR HANDLING
    # =====================================================

    except Exception as e:

        print()

        print("=" * 70)

        print("ANALYSIS ERROR")

        print("=" * 70)

        print(
            str(e)
        )

        print("=" * 70)

        print()


        return {

            "success":
                False,

            "message":
                f"Error analyzing image: {str(e)}"

        }


# =========================================================
# SUBMIT COMPLAINT
# =========================================================

@app.post("/submit-complaint")
def submit_complaint(
    complaint: ComplaintRequest,
    db: Session = Depends(get_db)
):

    try:

        # =================================================
        # CREATE DATABASE RECORD
        # =================================================

        new_complaint = Complaint(

            user_id=complaint.user_id,

            issue=
                complaint.issue,

            confidence=
                complaint.confidence,

            severity=
                complaint.severity,

            department=
                complaint.department,

            status="Submitted",

            area=
                complaint.area,

            village=
                complaint.village,

            district=
                complaint.district,

            state=
                complaint.state,

            country=
                complaint.country,

            full_address=
                complaint.full_address,

            latitude=
                complaint.latitude,

            longitude=
                complaint.longitude

        )


        # =================================================
        # SAVE
        # =================================================

        db.add(
            new_complaint
        )

        db.commit()

        db.refresh(
            new_complaint
        )


        # =================================================
        # RESPONSE
        # =================================================

        return {

            "success":
                True,

            "message":
                "Complaint submitted successfully!",

            "complaint_id":
                f"CIVIC-{new_complaint.id:04d}",

            "submitted_at":
                new_complaint.created_at

        }


    except Exception as e:

        db.rollback()

        print(
            "Complaint submission error:",
            str(e)
        )

        return {

            "success":
                False,

            "message":
                f"Error submitting complaint: {str(e)}"

        }


# =========================================================
# GET COMPLAINTS
# =========================================================

@app.get("/complaints")
def get_complaints(
    user_id: int = None,
    db: Session = Depends(get_db)
):

    try:

        # =====================================================
        # START QUERY
        # =====================================================

        query = db.query(Complaint)


        # =====================================================
        # CITIZEN FILTER
        #
        # If user_id is provided:
        # return only that citizen's complaints.
        #
        # If user_id is NOT provided:
        # return all complaints.
        #
        # This keeps the Admin Dashboard working.
        # =====================================================

        if user_id is not None:

            query = query.filter(
                Complaint.user_id == user_id
            )


        # =====================================================
        # GET COMPLAINTS
        # NEWEST COMPLAINT FIRST
        # =====================================================

        complaints = (
            query
            .order_by(
                Complaint.created_at.desc()
            )
            .all()
        )


        # =====================================================
        # RETURN DATA
        # =====================================================

        return complaints


    except Exception as e:

        print(
            "Error fetching complaints:",
            str(e)
        )

        return {

            "success":
                False,

            "message":
                "Unable to fetch complaints."

        }


# =========================================================
# UPDATE COMPLAINT STATUS
# =========================================================

class ComplaintStatusRequest(BaseModel):

    status: str


ALLOWED_STATUSES = [

    "Submitted",

    "Under Review",

    "Assigned",

    "In Progress",

    "Resolved"

]


@app.put("/complaints/{complaint_id}/status")
def update_complaint_status(
    complaint_id: int,
    status_request: ComplaintStatusRequest,
    db: Session = Depends(get_db)
):

    try:

        # Check whether the status is valid

        if status_request.status not in ALLOWED_STATUSES:

            return {

                "success": False,

                "message":
                    "Invalid complaint status.",

                "allowed_statuses":
                    ALLOWED_STATUSES

            }


        # Find the complaint

        complaint = (
            db.query(Complaint)
            .filter(
                Complaint.id == complaint_id
            )
            .first()
        )


        # Complaint not found

        if complaint is None:

            return {

                "success": False,

                "message":
                    "Complaint not found."

            }


        # Store the new status

        complaint.status = (
            status_request.status
        )


        # =====================================================
        # CREATE NOTIFICATION FOR CITIZEN
        # =====================================================

        if complaint.user_id is not None:

            notification = Notification(

                user_id=
                    complaint.user_id,

                complaint_id=
                    complaint.id,

                title=
                    "Complaint Status Updated",

                message=(
                    f"Your complaint "
                    f"CIVIC-{complaint.id:04d} "
                    f"status has been updated to "
                    f"'{complaint.status}'."
                ),

                status=
                    complaint.status,

                is_read=0

            )

            db.add(
                notification
            )


        # Save complaint + notification

        db.commit()

        db.refresh(
            complaint
        )


        return {

            "success": True,

            "message":
                "Complaint status updated successfully.",

            "complaint_id":
                f"CIVIC-{complaint.id:04d}",

            "status":
                complaint.status

        }


    except Exception as e:

        db.rollback()

        print(
            "Complaint status update error:",
            str(e)
        )

        return {

            "success": False,

            "message":
                f"Error updating complaint status: {str(e)}"

        }
    # =========================================================
# GET USER NOTIFICATIONS
# =========================================================


@app.get("/notifications")
def get_notifications(

    user_id: int,

    db: Session = Depends(get_db)

):


    try:


        notifications = (

            db.query(Notification)

            .filter(Notification.user_id == user_id)

            .order_by(Notification.created_at.desc())

            .all()

        )


        return notifications



    except Exception as e:


        print(

            "Error fetching notifications:",

            str(e)

        )


        return {

            "success": False,

            "message": "Unable to fetch notifications."

        }