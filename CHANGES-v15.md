# v15 Offline-first Phase 1

## Implemented

- Redux Toolkit + React Redux
- Dexie IndexedDB local database
- FlexSearch instant local POS search
- Decimal.js POS calculations
- Local-first POS checkout
- Atomic local invoice/items/stock/sync-queue transaction
- Offline cached admin login with PBKDF2 password verifier
- Hourly sync scheduler while app is open
- Retry queue and sync status UI
- Server bootstrap endpoint
- Idempotent sale sync using client UUID
- Atomic server invoice sequence
- Local sales list and 80mm print view

## Verification

- Frontend `npm run build`: passed
- Backend `npm run build`: passed

## Scope note

This phase migrates login caching, POS product data, stock used by POS, checkout, local invoices and sync queue. Other ERP CRUD modules still use the online API and will be migrated to local-first storage in subsequent phases.

## v15.2 Authentication stability patch
- Default admin auto-created on first backend startup.
- Development startup refreshes configured default credentials if the stored password differs.
- Added `npm run reset-admin`.
- `npm run seed` refreshes default credentials and master data.
- Invalid/expired JWT returns 401 instead of dashboard/bootstrap 500.
- Stale browser tokens are cleared automatically.
- Login email normalized.
- Duplicate `clientUuid` index warning removed.
