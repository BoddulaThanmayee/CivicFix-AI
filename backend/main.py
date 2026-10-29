
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
# DATABASE MODELS
# =========================================================

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="citizen", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)
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
    status = Column(String, default="Submitted")
    assigned_officer = Column(String, nullable=True)
    officer_designation = Column(String, nullable=True)
    officer_phone = Column(String, nullable=True)
    assigned_at = Column(DateTime, nullable=True)
    assignment_method = Column(String, nullable=True)


class Officer(Base):
    __tablename__ = "officers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    department = Column(String, nullable=False, index=True)
    designation = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    areas_covered = Column(String, nullable=True)
    skills = Column(String, nullable=True)
    is_available = Column(Integer, default=1, nullable=False)
    max_active_complaints = Column(Integer, default=5, nullable=False)
    password_hash = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# Create tables for new databases.
Base.metadata.create_all(bind=engine)

# Migration: add officer password hashes to existing databases.
with engine.connect() as connection:
    officer_columns = connection.execute(
        text("PRAGMA table_info(officers)")
    ).fetchall()
    officer_column_names = {column[1] for column in officer_columns}
    if "password_hash" not in officer_column_names:
        connection.execute(
            text("ALTER TABLE officers ADD COLUMN password_hash VARCHAR")
        )
        connection.commit()

# =========================================================
# MIGRATION FOR OFFICER ASSIGNMENT FIELDS
# =========================================================

with engine.connect() as connection:
    columns = connection.execute(
        text("PRAGMA table_info(complaints)")
    ).fetchall()

    existing_columns = {column[1] for column in columns}

    if "assigned_officer" not in existing_columns:
        connection.execute(
            text("ALTER TABLE complaints ADD COLUMN assigned_officer VARCHAR")
        )

    if "officer_designation" not in existing_columns:
        connection.execute(
            text("ALTER TABLE complaints ADD COLUMN officer_designation VARCHAR")
        )

    if "officer_phone" not in existing_columns:
        connection.execute(
            text("ALTER TABLE complaints ADD COLUMN officer_phone VARCHAR")
        )

    if "assigned_at" not in existing_columns:
        connection.execute(
            text("ALTER TABLE complaints ADD COLUMN assigned_at DATETIME")
        )

    if "assignment_method" not in existing_columns:
        connection.execute(
            text("ALTER TABLE complaints ADD COLUMN assignment_method VARCHAR")
        )

    connection.commit()


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
# CITIZEN-OFFICER CHAT MESSAGE MODEL
# =========================================================
class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, nullable=False, index=True)
    sender_role = Column(String, nullable=False)  # citizen or officer
    sender_id = Column(Integer, nullable=False)
    sender_name = Column(String, nullable=False)
    message = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


ChatMessage.__table__.create(bind=engine, checkfirst=True)

# =========================================================
# COMPLAINT STATUS HISTORY
# =========================================================
class ComplaintStatusHistory(Base):
    __tablename__ = "complaint_status_history"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, nullable=False, index=True)
    status = Column(String, nullable=False)
    note = Column(String, nullable=True)
    updated_by_role = Column(String, default="system", nullable=False)
    updated_by_name = Column(String, default="CivicFix AI", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


ComplaintStatusHistory.__table__.create(bind=engine, checkfirst=True)



# =========================================================
# SAMPLE OFFICERS FOR PROTOTYPE TESTING
# These records are fictional, not real government officers.
# =========================================================

def seed_sample_officers():
    db = SessionLocal()

    try:
        if db.query(Officer).count() > 0:
            return

        sample_officers = [
            {
                "name": "Ravi Kumar",
                "department": "Roads & Infrastructure",
                "designation": "Junior Engineer",
                "phone": "9000000001",
                "areas_covered": "Visakhapatnam, Andhra Pradesh",
                "skills": "pothole, road, crack, damaged road",
                "is_available": 1,
                "max_active_complaints": 5
            },
            {
                "name": "Suresh Reddy",
                "department": "Roads & Infrastructure",
                "designation": "Assistant Engineer",
                "phone": "9000000002",
                "areas_covered": "Visakhapatnam, Andhra Pradesh",
                "skills": "pothole, road, crack, severe road damage",
                "is_available": 1,
                "max_active_complaints": 8
            },
            {
                "name": "Priya Sharma",
                "department": "Sanitation Department",
                "designation": "Sanitation Supervisor",
                "phone": "9000000003",
                "areas_covered": "Visakhapatnam, Andhra Pradesh",
                "skills": "garbage, waste, sanitation",
                "is_available": 1,
                "max_active_complaints": 6
            },
            {
                "name": "Kiran Rao",
                "department": "Water Supply Department",
                "designation": "Water Supply Engineer",
                "phone": "9000000004",
                "areas_covered": "Visakhapatnam, Andhra Pradesh",
                "skills": "water, leakage, pipe",
                "is_available": 1,
                "max_active_complaints": 5
            },
            {
                "name": "Anil Kumar",
                "department": "Drainage & Sanitation Department",
                "designation": "Drainage Engineer",
                "phone": "9000000005",
                "areas_covered": "Visakhapatnam, Andhra Pradesh",
                "skills": "drainage, open drain, sewer, manhole",
                "is_available": 1,
                "max_active_complaints": 5
            },
            {
                "name": "Meena Devi",
                "department": "Electrical Department",
                "designation": "Electrical Supervisor",
                "phone": "9000000006",
                "areas_covered": "Visakhapatnam, Andhra Pradesh",
                "skills": "streetlight, electrical, light",
                "is_available": 1,
                "max_active_complaints": 5
            }
        ]

        db.add_all([
            Officer(**officer)
            for officer in sample_officers
        ])

        db.commit()
        print("CivicFix AI sample officers added successfully.")

    except Exception as e:
        db.rollback()
        print("Error adding sample officers:", str(e))

    finally:
        db.close()


seed_sample_officers()

# DEMO ONLY: sample officer accounts use this shared password.
# Change these credentials and add proper authorization before deployment.
DEMO_OFFICER_PASSWORD = "Officer@123"

def initialize_officer_passwords():
    db = SessionLocal()
    try:
        for officer in db.query(Officer).all():
            if not officer.password_hash:
                officer.password_hash = hash_password(DEMO_OFFICER_PASSWORD)
        db.commit()
    except Exception as e:
        db.rollback()
        print("Officer credential initialization error:", str(e))
    finally:
        db.close()



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


# =========================================================
# PASSWORD HELPERS
# =========================================================

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


# Initialize demo credentials after password helper functions exist.
initialize_officer_passwords()

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
print("Backend directory:", BASE_DIR)
print("Model path:", MODEL_PATH)
print("Model exists:", MODEL_PATH.is_file())
print("=" * 70)


# =========================================================
# LOAD YOLO MODEL
# =========================================================

model = None

if not MODEL_PATH.is_file():
    print()
    print("WARNING: YOLO MODEL NOT FOUND!")
    print("Expected model:", MODEL_PATH)
    print()

else:
    try:
        model = YOLO(str(MODEL_PATH))

        print()
        print("YOLO model loaded successfully!")
        print("YOLO model names:", model.names)
        print()

    except Exception as e:
        print()
        print("ERROR loading YOLO model:")
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
# PYDANTIC COMPLAINT SCHEMAS
# =========================================================

class RegisterRequest(BaseModel):
    full_name: str
    email: str
    phone: str | None = None
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class OfficerLoginRequest(BaseModel):
    name: str
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


class ComplaintAssignmentRequest(BaseModel):
    department: str
    assigned_officer: str
    officer_designation: str
    officer_phone: str


class ChatMessageRequest(BaseModel):
    sender_role: str
    sender_id: int
    message: str


class ChatbotRequest(BaseModel):
    question: str
    user_id: int | None = None
    complaint_id: int | None = None


# =========================================================
# HOME ROUTE
# =========================================================

@app.get("/")
def home():
    return {
        "message": "CivicFix AI backend is running!",
        "status": "success"
    }


# =========================================================
# HEALTH ROUTE
# =========================================================

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "model_path": str(MODEL_PATH),
        "model_exists": MODEL_PATH.is_file(),
        "model_classes": model.names if model is not None else None
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
        print("Registration error:", str(e))

        return {
            "success": False,
            "message": f"Registration failed: {str(e)}"
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
# OFFICER LOGIN (DEMO ACCOUNT LOGIN)
# =========================================================

@app.post("/officer-login")
def officer_login(
    request: OfficerLoginRequest,
    db: Session = Depends(get_db)
):
    officer_name = request.name.strip()
    officer = db.query(Officer).filter(
        Officer.name.ilike(officer_name)
    ).first()

    if not officer or not officer.password_hash or not verify_password(
        request.password, officer.password_hash
    ):
        return {
            "success": False,
            "message": "Invalid officer name or password."
        }

    return {
        "success": True,
        "message": "Officer login successful.",
        "officer": {
            "id": officer.id,
            "name": officer.name,
            "department": officer.department,
            "designation": officer.designation,
            "phone": officer.phone,
            "role": "officer"
        }
    }


@app.get("/officer-complaints")
def get_officer_complaints(
    officer_id: int,
    db: Session = Depends(get_db)
):
    officer = db.query(Officer).filter(Officer.id == officer_id).first()
    if not officer:
        return {"success": False, "message": "Officer not found."}

    complaints = (
        db.query(Complaint)
        .filter(Complaint.assigned_officer == officer.name)
        .order_by(Complaint.created_at.desc())
        .all()
    )
    return complaints


# =========================================================
# SEVERITY CALCULATION
# =========================================================

def calculate_severity(confidence: float):
    if confidence >= 0.85:
        return "High"

    elif confidence >= 0.60:
        return "Medium"

    else:
        return "Low"


# =========================================================
# DEPARTMENT ASSIGNMENT
# =========================================================

def get_department(issue: str):
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
# AI-ASSISTED OFFICER RECOMMENDATION
# Transparent rules-based scoring algorithm
# =========================================================

def get_best_officer(
    db,
    department,
    issue,
    severity,
    area=None,
    village=None,
    district=None,
    state=None,
    full_address=None
):
    if not department or not issue:
        return None, 0, "Department or issue is missing."

    officers = (
        db.query(Officer)
        .filter(Officer.is_available == 1)
        .all()
    )

    location_text = " ".join(
        str(value)
        for value in [
            area,
            village,
            district,
            state,
            full_address
        ]
        if value
    ).lower()

    issue_text = issue.lower()
    severity_text = (severity or "Low").lower()

    ranked_officers = []

    for officer in officers:

        # Department must match.
        if (
            officer.department.strip().lower()
            != department.strip().lower()
        ):
            continue

        # Calculate the officer's active workload.
        active_workload = (
            db.query(Complaint)
            .filter(
                Complaint.assigned_officer == officer.name,
                Complaint.status != "Resolved"
            )
            .count()
        )

        # Skip officers who have reached capacity.
        if active_workload >= officer.max_active_complaints:
            continue

        score = 40
        reasons = ["Department matches the complaint"]

        # Match the complaint issue against officer skills.
        officer_skills = [
            skill.strip().lower()
            for skill in (officer.skills or "").split(",")
            if skill.strip()
        ]

        matching_skills = [
            skill
            for skill in officer_skills
            if skill in issue_text
        ]

        if matching_skills:
            score += 25
            reasons.append(
                "Relevant skills: " + ", ".join(matching_skills)
            )

        # Check whether the complaint falls within the
        # officer's listed location coverage.
        covered_areas = [
            place.strip().lower()
            for place in (officer.areas_covered or "").split(",")
            if place.strip()
        ]

        if any(place in location_text for place in covered_areas):
            score += 20
            reasons.append("Location matches the officer's coverage")

        # Give greater workload preference to high-severity cases.
        workload_penalty = (
            5 if severity_text == "high"
            else 3 if severity_text == "medium"
            else 1
        )

        score += max(
            0,
            15 - active_workload * workload_penalty
        )

        reasons.append(
            f"Current active workload: {active_workload}"
        )

        # Prefer a more senior engineering designation for
        # high-severity issues when applicable.
        designation = (officer.designation or "").lower()

        if severity_text == "high" and any(
            word in designation
            for word in [
                "senior",
                "assistant engineer",
                "executive engineer"
            ]
        ):
            score += 5
            reasons.append(
                "Designation is suitable for urgent review"
            )

        ranked_officers.append({
            "officer": officer,
            "score": score,
            "active_workload": active_workload,
            "reason": "; ".join(reasons)
        })

    if not ranked_officers:
        return (
            None,
            0,
            "No available officer matches this department and workload requirement."
        )

    ranked_officers.sort(
        key=lambda item: (
            item["score"],
            -item["active_workload"]
        ),
        reverse=True
    )

    best = ranked_officers[0]

    return best, best["score"], best["reason"]


# =========================================================
# CLASS NAME FUNCTION
# =========================================================

def get_class_name(class_id: int) -> str:
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
        # Check whether the YOLO model is loaded.
        if model is None:
            return {
                "success": False,
                "message": (
                    "YOLO model is not loaded. "
                    "Check civicfix_best.pt path."
                )
            }

        if file is None:
            return {
                "success": False,
                "message": "No image file received."
            }

        # Read the uploaded image.
        image_bytes = await file.read()

        if not image_bytes:
            return {
                "success": False,
                "message": "Uploaded image is empty."
            }

        print()
        print("=" * 70)
        print("CIVICFIX AI - NEW IMAGE ANALYSIS")
        print("=" * 70)
        print("Filename:", file.filename)
        print("File size:", len(image_bytes), "bytes")

        # Convert the image bytes to a NumPy array.
        image_array = np.frombuffer(
            image_bytes,
            dtype=np.uint8
        )

        # Decode the image using OpenCV.
        image = cv2.imdecode(
            image_array,
            cv2.IMREAD_COLOR
        )

        if image is None:
            return {
                "success": False,
                "message": "Unable to read uploaded image."
            }

        print("Image shape:", image.shape)
        print("Running YOLO prediction...")

        # Run YOLO detection.
        results = model.predict(
            source=image,
            conf=0.25,
            verbose=False
        )

        if not results or len(results) == 0:
            return {
                "success": False,
                "message": "YOLO returned no results."
            }

        result = results[0]

        if result.boxes is None or len(result.boxes) == 0:
            print("No civic issue detected.")

            return {
                "success": False,
                "message": "No civic issue detected in the image."
            }

        # Find the detection with the highest confidence.
        best_box = None
        highest_confidence = 0.0

        for box in result.boxes:
            current_confidence = float(box.conf[0])
            current_class_id = int(box.cls[0])

            print("Detection:")
            print("  Class ID:", current_class_id)
            print("  Confidence:", current_confidence)

            if current_confidence > highest_confidence:
                highest_confidence = current_confidence
                best_box = box

        if best_box is None:
            return {
                "success": False,
                "message": "No valid detection found."
            }

        # Get the detected issue.
        class_id = int(best_box.cls[0])

        print()
        print("Best detection class ID:", class_id)

        issue = get_class_name(class_id)
        print("Detected issue:", issue)

        # Confidence is stored as a value between 0 and 1.
        confidence = round(highest_confidence, 4)

        confidence_percentage = round(
            confidence * 100,
            2
        )

        print("Raw confidence:", confidence)
        print("Confidence percentage:", confidence_percentage, "%")

        # Calculate severity and identify the department.
        severity = calculate_severity(confidence)
        print("Severity:", severity)

        department = get_department(issue)
        print("Department:", department)

        print("=" * 70)
        print("IMAGE ANALYSIS COMPLETED")
        print("=" * 70)
        print()

        return {
            "success": True,
            "issue": issue,
            "class_id": class_id,
            "confidence": confidence,
            "confidence_percentage": confidence_percentage,
            "severity": severity,
            "department": department,
            "message": "Civic issue detected successfully."
        }

    except Exception as e:
        print()
        print("=" * 70)
        print("ANALYSIS ERROR")
        print("=" * 70)
        print(str(e))
        print("=" * 70)
        print()

        return {
            "success": False,
            "message": f"Error analyzing image: {str(e)}"
        }


# =========================================================
# SUBMIT COMPLAINT WITH AUTOMATIC OFFICER ASSIGNMENT
# =========================================================

@app.post("/submit-complaint")
def submit_complaint(
    complaint: ComplaintRequest,
    db: Session = Depends(get_db)
):
    try:
        new_complaint = Complaint(
            user_id=complaint.user_id,
            issue=complaint.issue,
            confidence=complaint.confidence,
            severity=complaint.severity,
            department=complaint.department,
            status="Submitted",
            area=complaint.area,
            village=complaint.village,
            district=complaint.district,
            state=complaint.state,
            country=complaint.country,
            full_address=complaint.full_address,
            latitude=complaint.latitude,
            longitude=complaint.longitude
        )

        # Find the best eligible officer.
        best, score, reason = get_best_officer(
            db=db,
            department=new_complaint.department,
            issue=new_complaint.issue,
            severity=new_complaint.severity,
            area=new_complaint.area,
            village=new_complaint.village,
            district=new_complaint.district,
            state=new_complaint.state,
            full_address=new_complaint.full_address
        )

        # Automatically assign when a suitable officer exists.
        if best is not None:
            officer = best["officer"]

            new_complaint.assigned_officer = officer.name
            new_complaint.officer_designation = officer.designation
            new_complaint.officer_phone = officer.phone
            new_complaint.assigned_at = datetime.utcnow()
            new_complaint.assignment_method = "AI"
            new_complaint.status = "Assigned"

        # Save the complaint.
        db.add(new_complaint)
        db.commit()
        db.refresh(new_complaint)
        db.add(ComplaintStatusHistory(
            complaint_id=new_complaint.id,
            status=new_complaint.status or "Submitted",
            note="Complaint submitted successfully.",
            updated_by_role="system",
            updated_by_name="CivicFix AI"
        ))
        db.commit()


        # Notify the citizen after successful AI assignment.
        if best is not None and new_complaint.user_id is not None:
            notification = Notification(
                user_id=new_complaint.user_id,
                complaint_id=new_complaint.id,
                title="AI Officer Assignment Completed",
                message=(
                    f"Your complaint CIVIC-{new_complaint.id:04d} "
                    f"has been assigned to "
                    f"{new_complaint.assigned_officer}, "
                    f"{new_complaint.officer_designation}, "
                    f"from {new_complaint.department}."
                ),
                status=new_complaint.status,
                is_read=0
            )

            db.add(notification)
            db.commit()

        return {
            "success": True,
            "message": (
                "Complaint submitted and officer assigned by AI."
                if best is not None
                else (
                    "Complaint submitted. No suitable officer was "
                    "available; manual assignment is required."
                )
            ),
            "complaint_id": f"CIVIC-{new_complaint.id:04d}",
            "submitted_at": (
                new_complaint.created_at.isoformat()
                if new_complaint.created_at
                else None
            ),
            "status": new_complaint.status,
            "department": new_complaint.department,
            "assignment_method": new_complaint.assignment_method,
            "assigned_officer": new_complaint.assigned_officer,
            "officer_designation": new_complaint.officer_designation,
            "officer_phone": new_complaint.officer_phone,
            "assigned_at": (
                new_complaint.assigned_at.isoformat()
                if new_complaint.assigned_at
                else None
            ),
            "ai_recommendation_score": (
                score if best is not None else None
            ),
            "ai_recommendation_reason": (
                reason if best is not None else None
            )
        }

    except Exception as e:
        db.rollback()
        print("Complaint submission error:", str(e))

        return {
            "success": False,
            "message": f"Error submitting complaint: {str(e)}"
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
        query = db.query(Complaint)

        # If user_id is provided, return only that citizen's complaints.
        # Otherwise, return all complaints for the Admin Dashboard.
        if user_id is not None:
            query = query.filter(
                Complaint.user_id == user_id
            )

        complaints = (
            query
            .order_by(Complaint.created_at.desc())
            .all()
        )

        return complaints

    except Exception as e:
        print("Error fetching complaints:", str(e))

        return {
            "success": False,
            "message": "Unable to fetch complaints."
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
        if status_request.status not in ALLOWED_STATUSES:
            return {
                "success": False,
                "message": "Invalid complaint status.",
                "allowed_statuses": ALLOWED_STATUSES
            }

        complaint = (
            db.query(Complaint)
            .filter(Complaint.id == complaint_id)
            .first()
        )

        if complaint is None:
            return {
                "success": False,
                "message": "Complaint not found."
            }

        previous_status = complaint.status or "Submitted"
        complaint.status = status_request.status

        db.add(ComplaintStatusHistory(
            complaint_id=complaint.id,
            status=complaint.status,
            note=f"Status changed from {previous_status} to {complaint.status}.",
            updated_by_role="system",
            updated_by_name="CivicFix AI"
        ))

        # Create a notification for the citizen.
        if complaint.user_id is not None:
            notification = Notification(
                user_id=complaint.user_id,
                complaint_id=complaint.id,
                title="Complaint Status Updated",
                message=(
                    f"Your complaint CIVIC-{complaint.id:04d} "
                    f"status has been updated to "
                    f"'{complaint.status}'."
                ),
                status=complaint.status,
                is_read=0
            )

            db.add(notification)

        db.commit()
        db.refresh(complaint)

        return {
            "success": True,
            "message": "Complaint status updated successfully.",
            "complaint_id": f"CIVIC-{complaint.id:04d}",
            "status": complaint.status
        }

    except Exception as e:
        db.rollback()
        print("Complaint status update error:", str(e))

        return {
            "success": False,
            "message": f"Error updating complaint status: {str(e)}"
        }


# =========================================================
# COMPLAINT CHAT (prototype; add authenticated sessions before deployment)
# =========================================================


# =========================================================
# COMPLAINT TRACKING TIMELINE
# =========================================================
@app.get("/complaints/{complaint_id}/timeline")
def get_complaint_timeline(
    complaint_id: int,
    user_id: int | None = None,
    officer_id: int | None = None,
    db: Session = Depends(get_db)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if complaint is None:
        return {"success": False, "message": "Complaint not found."}

    # Match the existing app's participant-ID access pattern. Production
    # deployments should enforce identity with server-side authentication.
    is_citizen = user_id is not None and complaint.user_id == user_id
    is_officer = (
        officer_id is not None
        and complaint.assigned_officer is not None
        and db.query(Officer).filter(
            Officer.id == officer_id,
            Officer.name == complaint.assigned_officer
        ).first() is not None
    )
    if not (is_citizen or is_officer):
        return {"success": False, "message": "You are not authorized to view this timeline."}

    rows = db.query(ComplaintStatusHistory).filter(
        ComplaintStatusHistory.complaint_id == complaint_id
    ).order_by(ComplaintStatusHistory.created_at.asc()).all()

    # Existing complaints created before timeline tracking get a useful baseline.
    if not rows:
        baseline = [{
            "id": 0,
            "status": complaint.status or "Submitted",
            "note": "Current complaint status",
            "updated_by_role": "system",
            "updated_by_name": "CivicFix AI",
            "created_at": complaint.created_at.isoformat() if complaint.created_at else None
        }]
        return baseline

    return [{
        "id": row.id,
        "status": row.status,
        "note": row.note,
        "updated_by_role": row.updated_by_role,
        "updated_by_name": row.updated_by_name,
        "created_at": row.created_at.isoformat() if row.created_at else None
    } for row in rows]


@app.get("/complaints/{complaint_id}/messages")
def get_complaint_messages(
    complaint_id: int,
    user_id: int | None = None,
    officer_id: int | None = None,
    db: Session = Depends(get_db)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        return {"success": False, "message": "Complaint not found."}

    # Verify the requested participant is connected to this complaint.
    allowed = False
    if user_id is not None and complaint.user_id == user_id:
        allowed = True
    if officer_id is not None:
        officer = db.query(Officer).filter(Officer.id == officer_id).first()
        if officer and complaint.assigned_officer == officer.name:
            allowed = True
    if not allowed:
        return {"success": False, "message": "You are not a participant in this complaint."}

    messages = db.query(ChatMessage).filter(
        ChatMessage.complaint_id == complaint_id
    ).order_by(ChatMessage.created_at.asc()).all()
    return [{
        "id": m.id, "complaint_id": m.complaint_id,
        "sender_role": m.sender_role, "sender_id": m.sender_id,
        "sender_name": m.sender_name, "message": m.message,
        "created_at": m.created_at.isoformat() if m.created_at else None
    } for m in messages]


@app.post("/complaints/{complaint_id}/messages")
def send_complaint_message(
    complaint_id: int,
    request: ChatMessageRequest,
    db: Session = Depends(get_db)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        return {"success": False, "message": "Complaint not found."}
    message_text = request.message.strip()
    if not message_text or len(message_text) > 2000:
        return {"success": False, "message": "Message must be between 1 and 2000 characters."}

    role = request.sender_role.strip().lower()
    if role == "citizen":
        user = db.query(User).filter(User.id == request.sender_id).first()
        if not user or complaint.user_id != user.id:
            return {"success": False, "message": "Citizen is not authorized for this complaint."}
        sender_name = user.full_name
    elif role == "officer":
        officer = db.query(Officer).filter(Officer.id == request.sender_id).first()
        if not officer or complaint.assigned_officer != officer.name:
            return {"success": False, "message": "Officer is not assigned to this complaint."}
        sender_name = officer.name
    else:
        return {"success": False, "message": "Invalid sender role."}

    item = ChatMessage(
        complaint_id=complaint_id, sender_role=role,
        sender_id=request.sender_id, sender_name=sender_name,
        message=message_text
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {
        "success": True, "id": item.id, "complaint_id": item.complaint_id,
        "sender_role": item.sender_role, "sender_id": item.sender_id,
        "sender_name": item.sender_name, "message": item.message,
        "created_at": item.created_at.isoformat() if item.created_at else None
    }


# =========================================================
# CIVICFIX HELP CHATBOT (rule-based; no external AI API)
# =========================================================
@app.post("/chatbot")
def civicfix_chatbot(request: ChatbotRequest, db: Session = Depends(get_db)):
    q = request.question.strip().lower()
    if not q:
        return {"success": False, "answer": "Please type a question."}

    if request.complaint_id is not None:
        complaint = db.query(Complaint).filter(Complaint.id == request.complaint_id).first()
        if complaint and request.user_id is not None and complaint.user_id == request.user_id:
            if any(word in q for word in ["status", "progress", "where", "update"]):
                officer = complaint.assigned_officer or "not assigned yet"
                return {"success": True, "answer": f"Complaint CIVIC-{complaint.id:04d} is currently '{complaint.status}'. Department: {complaint.department or 'not specified'}. Assigned officer: {officer}."}

    if any(word in q for word in ["status", "track", "progress"]):
        answer = "Open My Dashboard → My Complaints to see the latest status. Select a complaint to view its assigned officer and chat."
    elif any(word in q for word in ["officer", "contact", "phone", "call"]):
        answer = "Open My Dashboard and find the Officer Assignment section on your complaint. If an officer is assigned, use the displayed contact number or Call Officer button."
    elif any(word in q for word in ["report", "submit", "photo", "image"]):
        answer = "Go back to the reporting screen, capture or choose a photo, review the detected issue and location, then submit the complaint."
    elif any(word in q for word in ["pothole", "garbage", "drain", "crack", "streetlight", "water"]):
        answer = "Take a clear photo, include the correct location, and submit the issue. CivicFix AI will identify the likely issue and route it to the relevant department when possible."
    elif any(word in q for word in ["hello", "hi", "hey"]):
        answer = "Hello! I'm the CivicFix AI help assistant. Ask me about reporting an issue, tracking a complaint, or contacting your assigned officer."
    else:
        answer = "I can help with reporting civic issues, checking complaint status, and contacting an assigned officer. What would you like help with?"
    return {"success": True, "answer": answer}


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
        print("Error fetching notifications:", str(e))

        return {
            "success": False,
            "message": "Unable to fetch notifications."
        }


# =========================================================
# MANUAL OFFICER ASSIGNMENT
# =========================================================

@app.put("/complaints/{complaint_id}/assign")
def assign_complaint_officer(
    complaint_id: int,
    assignment: ComplaintAssignmentRequest,
    db: Session = Depends(get_db)
):
    try:
        if not all([
            assignment.department.strip(),
            assignment.assigned_officer.strip(),
            assignment.officer_designation.strip(),
            assignment.officer_phone.strip()
        ]):
            return {
                "success": False,
                "message": "All assignment fields are required."
            }

        complaint = (
            db.query(Complaint)
            .filter(Complaint.id == complaint_id)
            .first()
        )

        if complaint is None:
            return {
                "success": False,
                "message": "Complaint not found."
            }

        complaint.department = assignment.department.strip()
        complaint.assigned_officer = assignment.assigned_officer.strip()
        complaint.officer_designation = assignment.officer_designation.strip()
        complaint.officer_phone = assignment.officer_phone.strip()
        complaint.assigned_at = datetime.utcnow()
        complaint.assignment_method = "Manual"
        complaint.status = "Assigned"

        if complaint.user_id is not None:
            notification = Notification(
                user_id=complaint.user_id,
                complaint_id=complaint.id,
                title="Officer Assigned",
                message=(
                    f"An officer has been assigned to complaint "
                    f"CIVIC-{complaint.id:04d}. "
                    f"Department: {complaint.department}. "
                    f"Officer: {complaint.assigned_officer}."
                ),
                status=complaint.status,
                is_read=0
            )

            db.add(notification)

        db.commit()
        db.refresh(complaint)

        return {
            "success": True,
            "message": "Officer assigned successfully.",
            "complaint_id": f"CIVIC-{complaint.id:04d}",
            "department": complaint.department,
            "assigned_officer": complaint.assigned_officer,
            "officer_designation": complaint.officer_designation,
            "officer_phone": complaint.officer_phone,
            "assigned_at": complaint.assigned_at.isoformat(),
            "assignment_method": complaint.assignment_method,
            "status": complaint.status
        }

    except Exception as e:
        db.rollback()
        print("Officer assignment error:", str(e))

        return {
            "success": False,
            "message": "Unable to assign officer. Check the backend terminal."
        }


# =========================================================
# GET OFFICERS AND CURRENT WORKLOAD
# =========================================================

@app.get("/officers")
def get_officers(db: Session = Depends(get_db)):
    officers = (
        db.query(Officer)
        .order_by(Officer.name)
        .all()
    )

    result = []

    for officer in officers:
        active_workload = (
            db.query(Complaint)
            .filter(
                Complaint.assigned_officer == officer.name,
                Complaint.status != "Resolved"
            )
            .count()
        )

        result.append({
            "id": officer.id,
            "name": officer.name,
            "department": officer.department,
            "designation": officer.designation,
            "phone": officer.phone,
            "areas_covered": officer.areas_covered,
            "skills": officer.skills,
            "is_available": bool(officer.is_available),
            "active_workload": active_workload,
            "max_active_complaints": officer.max_active_complaints
        })

    return result


# =========================================================
# AI ASSIGN OR REASSIGN AN EXISTING COMPLAINT
# =========================================================

@app.post("/complaints/{complaint_id}/auto-assign")
def auto_assign_complaint_officer(
    complaint_id: int,
    db: Session = Depends(get_db)
):
    try:
        complaint = (
            db.query(Complaint)
            .filter(Complaint.id == complaint_id)
            .first()
        )

        if complaint is None:
            return {
                "success": False,
                "message": "Complaint not found."
            }

        best, score, reason = get_best_officer(
            db=db,
            department=complaint.department,
            issue=complaint.issue,
            severity=complaint.severity,
            area=complaint.area,
            village=complaint.village,
            district=complaint.district,
            state=complaint.state,
            full_address=complaint.full_address
        )

        if best is None:
            return {
                "success": False,
                "message": reason
            }

        officer = best["officer"]

        complaint.assigned_officer = officer.name
        complaint.officer_designation = officer.designation
        complaint.officer_phone = officer.phone
        complaint.assigned_at = datetime.utcnow()
        complaint.assignment_method = "AI"
        complaint.status = "Assigned"

        if complaint.user_id is not None:
            notification = Notification(
                user_id=complaint.user_id,
                complaint_id=complaint.id,
                title="AI Officer Assignment Updated",
                message=(
                    f"Complaint CIVIC-{complaint.id:04d} "
                    f"has been assigned to {officer.name} "
                    f"by AI recommendation."
                ),
                status="Assigned",
                is_read=0
            )

            db.add(notification)

        db.commit()
        db.refresh(complaint)

        return {
            "success": True,
            "message": "Officer assigned using AI recommendation.",
            "complaint_id": f"CIVIC-{complaint.id:04d}",
            "department": complaint.department,
            "assigned_officer": officer.name,
            "officer_designation": officer.designation,
            "officer_phone": officer.phone,
            "assigned_at": complaint.assigned_at.isoformat(),
            "assignment_method": complaint.assignment_method,
            "status": complaint.status,
            "recommendation_score": score,
            "recommendation_reason": reason
        }

    except Exception as e:
        db.rollback()
        print("AI officer assignment error:", str(e))

        return {
            "success": False,
            "message": "Unable to assign officer using AI."
        }
