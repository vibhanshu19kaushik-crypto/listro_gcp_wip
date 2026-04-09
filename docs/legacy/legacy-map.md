# Listro Legacy-to-Modular Mapping Record

This document tracks the migration of logic from the legacy monolithic `server.js` (in `listro_gcp_old`) to the new modular architecture (in `listro_gcp_wip`).

## 🗺️ File Mapping Table

| Component / Feature | Legacy Location (old/server.js) | New Modular Location (wip/) | Status |
| :--- | :--- | :--- | :--- |
| **Core Configuration** | Hardcoded constants | `backend/config/index.js` | ✅ Completed |
| **GCP Clients (BQ, Sheets)** | Global initializers | `backend/utils/gcpClient.js` | ✅ Completed |
| **Error Handling** | Ad-hoc try/catch | `backend/middleware/errorHandler.js` | ✅ Completed |
| **Seller Allocation Logic** | Helper functions (lines 1900-2400) | `backend/services/allocationService.js` | ✅ Completed |
| **Allocation API** | `/api/claim-listings` etc. | `backend/routes/allocationRoutes.js` | ✅ Completed |
| **Audit Time Tracking** | `/api/update-start-time` etc. | `backend/services/auditService.js` | ✅ Completed |
| **BigQuery Export logic** | `mapUIToBQRow`, `insertRowsToBigQuery` | `backend/services/auditService.js` | ✅ Completed |
| **Product Data Exports** | `/api/gcp/combined-export` | `backend/routes/auditRoutes.js` | ✅ Completed |
| **Home & Kitchen Export** | `/api/append-to-hk-sheet` | `backend/services/homeKitchenService.js` | ✅ Completed |
| **HK Schema Management** | `ensureSheetHeaders` etc. | `backend/services/homeKitchenService.js` | ✅ Completed |

## 📐 Behavioral Parity Notes
- **Timestamps**: All IST timestamp generation (`toISTTimestamp`) matches the legacy 5.5h offset logic.
- **BigQuery Schema**: Maintained identical snake_case mapping for all streams.
- **Error Codes**: Refined modular routes to return 400 (Bad Request) instead of 500 when parameters are missing, matching legacy behavior.
- **CORS/Origins**: Centralized in `config/index.js` while maintaining support for all original allowed origins.
