from flask import Blueprint, request, jsonify
from datetime import datetime
from services.auth_service import connect_to_sheet, connect_to_lead_sheet
import requests

auth_bp = Blueprint('auth', __name__)

@auth_bp.route("/login", methods=["POST"])
def login():
    """Handle user login using Google Sheets."""
    try:
        data = request.get_json()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "").strip()

        if not email or not password:
            return jsonify({"success": False, "error": "Email and password are required"}), 400

        sheet = connect_to_sheet()
        if sheet is None:
            return jsonify({"success": False, "error": "User authentication not configured"}), 500

        records = sheet.get_all_records()
        user_record = None
        for record in records:
            record_email = (record.get("email") or record.get("Email") or "").strip().lower()
            if record_email == email:
                user_record = record
                break

        if not user_record:
            return jsonify({"success": False, "error": "Invalid email or password"}), 401

        stored_password = str(user_record.get("password") or user_record.get("Password") or "").strip()
        if password != stored_password:
            return jsonify({"success": False, "error": "Invalid email or password"}), 401

        is_temp_password = stored_password == "Temp@123"
        first_login_flag = (user_record.get("FirstLogin") or user_record.get("firstLogin") or "").strip().lower()
        first_time = first_login_flag == "yes" or is_temp_password

        return jsonify({
            "success": True,
            "message": "Login successful",
            "first_time": first_time,
            "is_temp_password": is_temp_password,
            "email": email
        })
    except Exception as e:
        print(f"❌ Auth Route: Login error: {e}")
        return jsonify({"success": False, "error": "Server error during login"}), 500

@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    """Submit a password reset request to the admin."""
    try:
        data = request.get_json()
        email = data.get("email", "").strip().lower()
        if not email:
            return jsonify({"success": False, "error": "Email is required"}), 400

        sheet = connect_to_sheet()
        if sheet is None:
            return jsonify({"success": False, "error": "System configuration error"}), 500

        records = sheet.get_all_records()
        header_row = sheet.row_values(1)
        
        user_found = False
        row_index = None
        for i, record in enumerate(records):
            record_email = str(record.get("email") or record.get("Email") or "").strip().lower()
            if record_email == email:
                user_found = True
                row_index = i + 2
                break

        if not user_found:
            return jsonify({"success": False, "error": "Email not found"}), 404

        requested_col = None
        last_emailed_col = None
        
        for col_idx, header in enumerate(header_row):
            h = str(header).lower()
            if "requested" in h and "password" in h:
                requested_col = col_idx + 1
            elif "emailed" in h and "last" in h:
                last_emailed_col = col_idx + 1

        if not requested_col:  # Fallback to exact match
            for col_idx, header in enumerate(header_row):
                if str(header).strip() == "Password Requested by User":
                    requested_col = col_idx + 1
                    break

        if requested_col:
            sheet.update_cell(row_index, requested_col, "Yes")
            if last_emailed_col:
                sheet.update_cell(row_index, last_emailed_col, datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            return jsonify({"success": True, "message": "Reset request submitted", "pending_approval": True})
        else:
            return jsonify({"success": False, "error": "System configuration error"}), 500

    except Exception as e:
        print(f"❌ Auth Route: Reset password error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@auth_bp.route("/update-password", methods=["POST"])
def update_password():
    """Update user password directly."""
    try:
        data = request.get_json()
        email = data.get("email", "").strip().lower()
        new_password = data.get("password", "").strip()

        if not email or not new_password:
            return jsonify({"success": False, "error": "Email and password are required"}), 400

        sheet = connect_to_sheet()
        if sheet is None:
            return jsonify({"success": False, "error": "Database connection failed"}), 500

        records = sheet.get_all_records()
        user_found = False
        row_index = None
        for i, record in enumerate(records):
            record_email = record.get("email", record.get("Email", "")).strip().lower()
            if record_email == email:
                user_found = True
                row_index = i + 2
                break

        if not user_found:
            return jsonify({"success": False, "error": "User not found"}), 404

        header_row = sheet.row_values(1)
        password_col = None
        first_login_col = None
        for col_idx, header in enumerate(header_row):
            h = header.lower()
            if h == 'password':
                password_col = col_idx + 1
            elif h == 'firstlogin':
                first_login_col = col_idx + 1

        if password_col:
            sheet.update_cell(row_index, password_col, new_password)
            if first_login_col:
                sheet.update_cell(row_index, first_login_col, 'No')
            return jsonify({"success": True, "message": "Password updated successfully"})
        else:
            return jsonify({"success": False, "error": "Password column not found"}), 500

    except Exception as e:
        print(f"❌ Auth Route: Update password error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@auth_bp.route("/creative-login", methods=["POST"])
def creative_login():
    """
    Proxy endpoint used by the browser when the Creative (Listro Imagen)
    backend is configured with authentication.
    """
    data = request.get_json() or {}
    email = (data.get("email") or "").strip()
    password = (data.get("password") or "").strip()
    
    if not email or not password:
        return jsonify(success=False, error="email/password required"), 400

    # Target audience for ID token
    target_audience = "https://listro-imagen-nodebackend-648176215467.asia-south1.run.app"
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as ga_requests
        auth_req = ga_requests.Request()
        idt = id_token.fetch_id_token(auth_req, target_audience)
    except Exception as exc:
        print(f"❌ Creative Auth: Token fetch error: {exc}")
        return jsonify(success=False, error=f"couldn't fetch ID token: {exc}"), 500

    try:
        resp = requests.post(
            f"{target_audience}/auth/login",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {idt}",
            },
            json={"email": email, "password": password},
            timeout=10,
        )
        return (resp.content, resp.status_code, resp.headers.items())
    except Exception as exc:
        print(f"❌ Creative Auth: Proxy error: {exc}")
        return jsonify(success=False, error=f"proxy request failed: {exc}"), 502


@auth_bp.route("/lead-login", methods=["POST"])
def lead_login():
    """
    Handle lead login using a separate Google Sheet.
    """
    try:
        data = request.get_json() or {}
        email = (data.get("email") or "").strip().lower()
        password = (data.get("password") or "").strip()

        if not email or not password:
            return jsonify(success=False, error="Email and password required"), 400

        ws = connect_to_lead_sheet()
        if ws is None:
            return jsonify(success=False, error="Lead authentication not configured"), 500

        records = ws.get_all_records()
        for row in records:
            row_email = str(row.get("email", "")).strip().lower()
            if row_email == email:
                row_password = str(row.get("password", "")).strip()
                if row_password != password:
                    return jsonify(success=False, error="Invalid credentials"), 401

                active_val = str(row.get("active", "")).strip().lower()
                if active_val in ("1", "true", "yes", "y", "active"):
                    return jsonify(success=True, role="lead")
                else:
                    return jsonify(success=False, error="Account not active"), 403

        return jsonify(success=False, error="User not found"), 404
    except Exception as e:
        print(f"❌ Auth Route: Lead login error: {e}")
        return jsonify(success=False, error="Server error during lead login"), 500
