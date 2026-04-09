# Legacy Mapping Document

This document maps the old monolithic files to their new refactored locations in the `wip` branch. It ensures we never lose track of where logic was moved.

## Backend Mappings
| Old File (`listro_gcp_old`) | New Location (`listro_gcp_wip`) | Status | Notes |
|:---|:---|:---|:---|
| `backend/python-server.py` | `backend/app.py`, `backend/routes/*`, `backend/services/*` | 🟡 Partial | 113KB monolith partially broken down. Large portions still missing or untested. |
| `backend/scraper.py` | `backend/scraper.py` | 🟡 Needs Diff | Size mismatch detected (66KB old vs 76KB new). Must investigate changes. |
| `backend/amz_scraper.py` | `backend/amz_scraper.py` | 🟡 Needs Diff | Size mismatch. |
| `backend/amz_metadata_scraper.py` | `backend/amz_metadata_scraper.py` | 🟡 Needs Diff | Size mismatch. |
| `server.js` | `backend/routes/*`, `backend/services/*`, `backend/utils/*` | 🟡 Refactoring | 180 KB monolith being decomposed. Sheet and GCP routes extracted. |

## Frontend Mappings
| Old File (`listro_gcp_old/src`) | New Location (`listro_gcp_wip/src`) | Status | Notes |
|:---|:---|:---|:---|
| `api/api.js` + `api/frontendApi.js` | `api/apiService.js` | 🟢 RESTORED | Parity restored with all legacy transformations and fallback logic. |
| `pages/ProductComparatorPage.jsx` | `pages/ProductComparatorPage.jsx` + `components/ProductComparator/*` + hooks | 🟡 Partial | Logic extracted, but needs verification against old behavior. |
| `pages/FinalPage.jsx` | `pages/FinalPage.jsx` + `components/FinalPage/*` + hooks | 🟡 Partial | Extracted. |
| `pages/ComparisonSetupPage.jsx`| `pages/ComparisonSetupPage.jsx` + `components/ComparisonSetup/*` | 🟡 Partial | Extracted. |
| `pages/DataSelectionPage.jsx` | `pages/DataSelectionPage.jsx` + `components/DataSelection/*` | 🟡 Partial | Extracted. |
| `pages/NewProductCreationPage.jsx` | `pages/NewProductCreationPage.jsx` + `components/NewProduct/*` | 🟡 Partial | Extracted. |
| `pages/SellerAllocationPage.jsx` | `pages/SellerAllocationPage.jsx` + `components/SellerAllocation/*` | 🟡 Partial | Extracted. |
| `pages/ImageComparisonPage.jsx` | `pages/ImageComparisonPage.jsx` + `components/ImageComparison/*` | 🟡 Partial | Extracted. |
| `pages/LoginPage.jsx` | `pages/LoginPage.jsx` + `components/Login/*` + `LoginPage.css` | 🟡 Partial | Extracted. |

## Utility Mappings
| Old File | New Location | Status | Notes |
|:---|:---|:---|:---|
| *N/A (Monolithic)* | `wip/backend/utils/` | 🟢 gcpClient.js | Centralized BigQuery, Storage, and Sheets initializations. |
