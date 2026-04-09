# backend/app.py
import os
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def create_app():
    app = Flask(__name__)
    
    # Configure CORS - Allowing the same origins as the original server
    CORS(app, resources={r"/*": {"origins": "*"}})
    
    app.config['JSON_SORT_KEYS'] = False

    @app.route('/health', methods=['GET'])
    def health_check():
        return jsonify({
            "status": "healthy",
            "version": "2.0.0-modular",
            "message": "Modular Flask Backend is running"
        }), 200

    # ==================================================
    # 📌 BLUEPRINT REGISTRATION (Phase 2 & 3)
    # ==================================================
    from routes.product_routes import product_bp
    from routes.metadata_routes import metadata_bp
    from routes.sku_routes import sku_bp
    from routes.image_routes import image_bp
    from routes.system_routes import system_bp
    from routes.auth_routes import auth_bp
    from routes.legacy_routes import legacy_bp
    
    app.register_blueprint(product_bp)
    app.register_blueprint(metadata_bp)
    app.register_blueprint(sku_bp)
    app.register_blueprint(image_bp)
    app.register_blueprint(system_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(legacy_bp)

    return app

if __name__ == '__main__':
    app = create_app()
    port = int(os.environ.get('FLASK_PORT', os.environ.get('PORT', 5001))) 
    print(f"🚀 Modular Server (V2) starting on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
