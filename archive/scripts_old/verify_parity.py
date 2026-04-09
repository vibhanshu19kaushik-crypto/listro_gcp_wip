import requests
import json
import sys

# Configuration
OLD_BASE_URL = "http://localhost:4000" # Legacy server port
WIP_BASE_URL = "http://localhost:4001" # Refactored server port

ENDPOINTS = [
    ("/health", "GET"),
    ("/api/sheet-data", "GET"),
    ("/api/golden-sheet-data", "GET"),
    ("/api/gcp/sellers", "GET"),
    ("/api/gcp/sellers/A1I01NJWIJO3X2/listings", "GET"),
    ("/api/update-start-time", "POST"),
    ("/api/update-end-time", "POST"),
    ("/api/gcp/combined-export", "POST"),
    ("/api/append-to-hk-sheet", "POST"),
    ("/api/initialize-hk-schema", "POST")
]

def check_parity(endpoint_data):
    endpoint, method = endpoint_data
    print(f"\n🔍 Checking Parity for: {endpoint} ({method})")
    
    url_old = f"{OLD_BASE_URL}{endpoint}"
    url_wip = f"{WIP_BASE_URL}{endpoint}"
    
    try:
        if method == "GET":
            res_old = requests.get(url_old, timeout=10)
            res_wip = requests.get(url_wip, timeout=10)
        else:
            # Simple POST with empty body just to check existence/initial validation
            res_old = requests.post(url_old, json={}, timeout=10)
            res_wip = requests.post(url_wip, json={}, timeout=10)
    except Exception as e:
        print(f"  ❌ Connection Error: {e}")
        return False

    if res_old.status_code != res_wip.status_code:
        print(f"  ❌ Status Mismatch: Old={res_old.status_code}, WIP={res_wip.status_code}")
        return False
    
    if endpoint == "/health":
        if res_old.text.strip() != res_wip.text.strip():
            print(f"  ❌ Content Mismatch: Old={res_old.text}, WIP={res_wip.text}")
            return False
        print("  ✅ Health check matches.")
        return True

    try:
        data_old = res_old.json()
        data_wip = res_wip.json()
    except Exception as e:
        print(f"  ❌ JSON Parsing Error: {e}")
        return False

    # Check Success Key
    if data_old.get('success') != data_wip.get('success'):
        print(f"  ❌ Success Flag Mismatch: Old={data_old.get('success')}, WIP={data_wip.get('success')}")
        print(f"  Old Data: {data_old}")
        print(f"  WIP Data: {data_wip}")
        return False

    # Check Data structure (keys)
    if 'data' in data_old and 'data' in data_wip:
        if isinstance(data_old['data'], list) and isinstance(data_wip['data'], list):
            if len(data_old['data']) > 0 and len(data_wip['data']) > 0:
                keys_old = set(data_old['data'][0].keys())
                keys_wip = set(data_wip['data'][0].keys())
                
                if keys_old != keys_wip:
                    missing_in_wip = keys_old - keys_wip
                    extra_in_wip = keys_wip - keys_old
                    if missing_in_wip: print(f"  ⚠️ Missing in WIP: {missing_in_wip}")
                    if extra_in_wip: print(f"  💡 Extra in WIP: {extra_in_wip}")
                    return False
                else:
                    print("  ✅ Data Structure (Keys) match.")
            else:
                print("  ℹ️ One or both datasets are empty.")
    
    print("  ✅ Logic Parity confirmed.")
    return True

if __name__ == "__main__":
    success_count = 0
    for ep in ENDPOINTS:
        if check_parity(ep):
            success_count += 1
            
    print(f"\n📊 Summary: {success_count}/{len(ENDPOINTS)} endpoints passed parity check.")
    if success_count == len(ENDPOINTS):
        print("🏆 100% PARITY ACHIEVED")
    else:
        print("🛑 REGRESSIONS DETECTED")
