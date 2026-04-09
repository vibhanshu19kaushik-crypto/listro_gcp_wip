import os
from datetime import datetime
from flask import Blueprint, jsonify
from services.sku_service import sku_generator
from services.ai_service import SCRAPED_IMAGES_DIR

system_bp = Blueprint('system', __name__)

@system_bp.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    try:
        # Get SKU generator stats
        with sku_generator.lock:
            sku_stats = {
                'total_skus': len(sku_generator.generated_skus),
                'unique_codes': len(sku_generator.product_code_sequences),
                'cached_count': len(sku_generator.recent_skus)
            }
        
        # Check directories
        dirs = {
            'scraped_images': {
                'path': SCRAPED_IMAGES_DIR,
                'exists': os.path.exists(SCRAPED_IMAGES_DIR),
                'count': len(os.listdir(SCRAPED_IMAGES_DIR)) if os.path.exists(SCRAPED_IMAGES_DIR) else 0
            }
        }
        
        return jsonify({
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "sku_service": sku_stats,
            "directories": dirs,
            "version": "2.0.0-modular"
        })
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }), 500
