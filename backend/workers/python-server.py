# ===========================================================================
# 🚨 DECOMMISSIONED: Legacy Monolithic Backend
# ===========================================================================
# This file (python-server.py) has been successfully migrated to a modular
# architecture in the V2 backend. All functionality is now handled by:
#
# - app.py (Entry point)
# - routes/ (API Blueprints: Metadata, SKU, Auth, Image, AI, etc.)
# - services/ (Core business logic)
#
# DO NOT ADD NEW LOGIC HERE. Use the modular structure instead.
# ===========================================================================

import os
from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def decommissioned(path):
    return jsonify({
        "status": "DECOMMISSIONED",
        "message": f"Endpoint '/{path}' has been migrated to the modular V2 architecture.",
        "version": "1.0.0-legacy-stub",
        "action": "Please point your requests to the V2 API (usually port 5001 or prefixed with /api/v2/)"
    }), 410  # 410 Gone

if __name__ == "__main__":
    # Port 5000 was the original port. 
    # We use 5002 here to avoid conflict with the new V2 server (5001) 
    # if both are started.
    port = int(os.environ.get("PORT", 5002))
    print(f"⚠️  Legacy Server (Stub) running on port {port} (DECOMMISSIONED)")
    app.run(host="0.0.0.0", port=port, debug=False)
