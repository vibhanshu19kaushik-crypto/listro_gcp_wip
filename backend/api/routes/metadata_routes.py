from flask import Blueprint, request, jsonify

metadata_bp = Blueprint('metadata', __name__)

@metadata_bp.route('/scrape-metadata-from-asin', methods=['POST'])
def scrape_metadata_from_asin():
    """
    Scrape product metadata (Category, Gender, Age Group, Subcategory) from ASIN.
    Version 2 (Modular)
    """
    try:
        data = request.get_json()
        asin = data.get('asin')
        
        if not asin:
            return jsonify({"success": False, "error": "ASIN is required"}), 400
        
        print(f"🔄 Scraping metadata for ASIN: {asin}")
        
        # Import scraper function directly (it should be in the same directory or PYTHONPATH)
        try:
            from amz_metadata_scraper import scrape_amazon_metadata
            result = scrape_amazon_metadata(asin)
            
            # Achieving parity: Legacy server returned 200 even on scraping failure
            # as long as the exception was handled by the scraper itself.
            return jsonify(result)
                
        except ImportError:
            return jsonify({
                "success": False, 
                "error": "Scraper module 'amz_metadata_scraper' not found"
            }), 500

    except Exception as e:
        print(f"❌ Error in metadata scraping route: {str(e)}")
        return jsonify({
            "success": False, 
            "error": f"Internal server error: {str(e)}"
        }), 500
