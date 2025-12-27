"""
Google Cloud Secret Manager integration for Gemini API credentials.
Handles secure credential retrieval and Gemini configuration.
"""

import os
import sys
from google.cloud import secretmanager
from google.oauth2.service_account import Credentials
import google.generativeai as genai
import json

# Secret Manager configuration
PROJECT_NUMBER = "648176215467"  # GCP project number for secret path
SECRET_NAME = "listro-secret-key"
SECRET_VERSION = "latest"

# Scopes for Gemini API
SCOPES = [
    "https://www.googleapis.com/auth/generative-language",
    "https://www.googleapis.com/auth/cloud-platform"
]


def get_secret_from_manager(project_id: str, secret_id: str, version_id: str = "latest") -> dict:
    """
    Retrieve service account JSON from Google Cloud Secret Manager.
    
    Args:
        project_id: GCP project ID
        secret_id: Secret name in Secret Manager
        version_id: Secret version (default: latest)
    
    Returns:
        Dictionary containing service account credentials
    
    Raises:
        Exception: If secret retrieval fails
    """
    try:
        print(f"🔐 Retrieving secret '{secret_id}' from Secret Manager...", file=sys.stderr)
        
        client = secretmanager.SecretManagerServiceClient()
        
        name = f"projects/{project_id}/secrets/{secret_id}/versions/{version_id}"
        response = client.access_secret_version(request={"name": name})
        
        # Decode the secret payload
        secret_data = response.payload.data.decode("UTF-8")
        
        # Parse as JSON
        credentials_dict = json.loads(secret_data)
        
        print(f"✅ Secret retrieved successfully from Secret Manager", file=sys.stderr)
        return credentials_dict
    
    except Exception as e:
        print(f"❌ Failed to retrieve secret from Secret Manager: {e}", file=sys.stderr)
        raise


def configure_gemini_with_service_account(project_number: str = PROJECT_NUMBER, 
                                         secret_id: str = SECRET_NAME) -> tuple:
    """
    Configure Gemini API using service account credentials from Secret Manager.
    
    Args:
        project_number: GCP project number (not project ID)
        secret_id: Secret name in Secret Manager
    
    Returns:
        Tuple of (credentials, text_model, image_model)
    
    Raises:
        Exception: If configuration fails
    """
    try:
        # Step 1: Retrieve service account from Secret Manager
        sa_credentials_dict = get_secret_from_manager(project_number, secret_id)
        
        # Step 2: Create credentials from service account info
        print("🔑 Creating credentials from service account...", file=sys.stderr)
        credentials = Credentials.from_service_account_info(
            sa_credentials_dict,
            scopes=SCOPES
        )
        print("✅ Credentials created successfully", file=sys.stderr)
        
        # Step 3: Configure Gemini with credentials
        print("🤖 Configuring Gemini API...", file=sys.stderr)
        genai.configure(credentials=credentials)
        print("✅ Gemini API configured successfully", file=sys.stderr)
        
        # Step 4: Initialize models
        text_model = genai.GenerativeModel("gemini-2.5-flash")
        image_model = genai.GenerativeModel("gemini-2.5-flash-image-preview")
        
        print("✅ Gemini text and image models initialized", file=sys.stderr)
        
        return credentials, text_model, image_model
    
    except Exception as e:
        print(f"❌ Gemini configuration failed: {e}", file=sys.stderr)
        raise


def verify_gemini_access(credentials) -> bool:
    """
    Verify that Gemini API is accessible with the configured credentials.
    
    Args:
        credentials: Service account credentials object
    
    Returns:
        True if access verified, False otherwise
    """
    try:
        print("🧪 Verifying Gemini API access...", file=sys.stderr)
        
        # Simple test prompt
        test_model = genai.GenerativeModel("gemini-2.5-flash")
        response = test_model.generate_content("Test: respond with 'OK'")
        
        if response and hasattr(response, 'text'):
            print("✅ Gemini API access verified", file=sys.stderr)
            return True
        else:
            print("⚠️ Gemini API response invalid", file=sys.stderr)
            return False
    
    except Exception as e:
        print(f"❌ Gemini API access verification failed: {e}", file=sys.stderr)
        return False


# Module-level initialization
_credentials = None
_text_model = None
_image_model = None


def get_gemini_models() -> tuple:
    """
    Get initialized Gemini models (lazy loading).
    
    Returns:
        Tuple of (credentials, text_model, image_model)
    """
    global _credentials, _text_model, _image_model
    
    if _text_model is None or _image_model is None:
        _credentials, _text_model, _image_model = configure_gemini_with_service_account()
    
    return _credentials, _text_model, _image_model


def get_credentials():
    """Get service account credentials."""
    global _credentials
    if _credentials is None:
        _credentials, _, _ = get_gemini_models()
    return _credentials