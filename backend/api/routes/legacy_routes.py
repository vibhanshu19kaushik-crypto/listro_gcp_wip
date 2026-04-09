from flask import Blueprint, request, jsonify
import requests
from services.auth_service import connect_to_lead_sheet

legacy_bp = Blueprint('legacy', __name__)

@legacy_bp.route("/creative-login", methods=["POST"])
def creative_login():
    """
    Proxy endpoint used by the browser when the Creative (Listro Imagen)
    backend is configured with authentication.
    """
    try:
        data = request.get_json() or {}
        email = (data.get("email") or "").strip()
        password = (data.get("password") or "").strip()
        
        if not email or not password:
            return jsonify(success=False, error="email/password required"), 400

        # Target audience for ID token (The Node.js backend URL)
        target_audience = "https://listro-imagen-nodebackend-648176215467.asia-south1.run.app"
        
        try:
            from google.oauth2 import id_token
            from google.auth.transport import requests as ga_requests
            auth_req = ga_requests.Request()
            idt = id_token.fetch_id_token(auth_req, target_audience)
        except Exception as exc:
            print(f"❌ Legacy Route: ID token fetch error: {exc}")
            return jsonify(success=False, error=f"couldn't fetch ID token: {exc}"), 500

        # Forward the request to the creative backend
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
        
    except Exception as e:
        print(f"❌ Legacy Route: Creative login proxy error: {e}")
        return jsonify(success=False, error=f"proxy request failed: {e}"), 502

@legacy_bp.route("/lead-login", methods=["POST"])
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
        print(f"❌ Legacy Route: Lead login error: {e}")
        return jsonify(success=False, error="Server error during lead login"), 500
