# MenzaOrder: Comprehensive Application Audit & Incident Investigation Report

**Date**: September 14, 2026  
**Application**: MenzaOrder (React Native Web / Vite / Azure SignalR / Cashfree POS)  
**Target Investigation URL**: `https://lemon-mud-097d55a00.7.azurestaticapps.net/?encRestId=fPo9f2iv1IjJcp77OZWtgA`

---

## 1. The Incident: Why Did a Table ID Appear on the Website?

### 1.1 The Reported Query
> **Backend Developer Statement**:  
> *"I only provided you `RestId` (`encRestId=fPo9f2iv1IjJcp77OZWtgA`). It doesn't have a `tableId` in the URL, but you can see a table ID displayed on the website. Why did that happen?"*

---

### 1.2 Live Backend API Audit
To verify if the backend was secretly injecting a table ID, we queried the production Azure API endpoint directly:

```bash
GET /api/public/store/profile?r=fPo9f2iv1IjJcp77OZWtgA&restaurantId=52
```

**Backend Response Payload**:
```json
{
  "restaurantId": 52,
  "encryptedRestaurantId": "fPo9f2iv1IjJcp77OZWtgA",
  "restaurantName": "Menza kitchen",
  "address": "Katara hills",
  "city": "Bhopal",
  "state": "MP",
  "isOpen": true,
  "isAcceptingOrders": true,
  "isTableOrderingEnabled": true,
  "tableId": null,
  "tableName": null,
  "tableStatus": "Available",
  "isTableOccupied": false,
  "activeOrderId": null
}
```

**Finding**: The backend API was **100% correct**. It returned `"tableId": null` and `"tableName": null`. The table ID was being injected and displayed entirely on the **frontend client**.

---

### 1.3 Root Cause Analysis (Client-Side Trace)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 1. User/Tester visits:                                                          │
│    https://lemon-mud-097d55a00.7.azurestaticapps.net/?encRestId=fPo9f2iv1IjJcp...  │
│    (No table parameter in query string -> urlTableId is null)                   │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 2. App.tsx (Line 546-551):                                                      │
│    targetTableNum = urlTableId ||                                               │
│                     localStorage.getItem('menza_last_table_id')  <── RESURRECTED│
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 3. loadMenuViaEncryptedEndpoint:                                                │
│    Target Table is found or synthesized as a phantom "Table #X"                 │
│    -> setActiveTable(resolvedTable)                                             │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 4. Header.tsx & CustomerView.tsx:                                               │
│    - Renders "Table #..." Dine-In Banner at top of menu                         │
│    - Renders "Call Waiter" button in navigation bar                             │
│    - Converts order type from Takeaway to Dine-In                               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Cause 1: Stale Session Fallback in `App.tsx`
In `src/App.tsx` (Lines 546–551):
```javascript
// PREVIOUS CODE
const targetTableNum =
  urlTableId
    ? isNaN(Number(urlTableId)) ? urlTableId : Number(urlTableId)
    : (typeof localStorage !== 'undefined' && localStorage.getItem('menza_last_table_id')
        ? localStorage.getItem('menza_last_table_id')
        : null);
```
* If a developer or customer previously tested table ordering, scanned a table QR code, or created an order on that device, the browser stored `menza_last_table_id` in `localStorage`.
* When opening the clean store-level URL (`?encRestId=...`), `urlTableId` evaluated to `null`.
* Instead of staying in **Takeaway / General Store** mode, the frontend pulled the old table number out of `localStorage` and attached it to the session.

#### Cause 2: Hardcoded `tableId = 1` Default in `QrScannerModal.tsx`
In `src/components/QrScannerModal.tsx` (Lines 24–27):
```javascript
// PREVIOUS CODE
const parseQrText = (decodedText) => {
  let encId = activeEncryptedId || 'uqQTzsGyDJy4_TBVeYXCfg';
  let tableId = 1; // <--- HARDCODED DEFAULT
  ...
  const tableMatch = decodedText.match(/tableId=(\d+)/i);
  if (tableMatch) tableId = Number(tableMatch[1]);
  return { encId, tableId };
};
```
* If the backend URL was pasted or scanned through the in-app QR scanner modal, `tableMatch` failed (since no `tableId` existed in the URL).
* The parser defaulted `tableId` to `1`, pushed `&tableId=1` to the URL, and permanently cached Table 1 in `localStorage`.

#### Cause 3: Cross-Restaurant & Settled Order Table Bleed
In `src/components/CustomerView.tsx` (Lines 706–715):
```javascript
// PREVIOUS CODE
const currentTable = activeTable || (
  activeOrder?.tableId || activeOrder?.tableName
    ? { id: activeOrder.tableId, tableName: activeOrder.tableName }
    : null
);
```
* If `activeOrder` was cached in storage from another restaurant or an earlier session, `CustomerView` displayed that order's table banner even when `activeTable` was null.

#### Cause 4: Phantom Table Generation
In `src/App.tsx` (Lines 1006–1018):
* Restaurant 52 ("Menza kitchen") has 10 tables: **A1, A2, R1, R2, T1, T2, TE1, TE2, V1, V2**.
* When the resurrected table ID (such as `1`) was not found among Restaurant 52's tables, the client synthesized a synthetic placeholder: `{ id: 1, tableName: "Table #1" }`, showing a non-existent table to the user.

---

### 1.4 How It Was Resolved
1. **URL Priority & LocalStorage Cleanup**: In `src/App.tsx`, if the URL does not explicitly specify a table ID (`urlTableId === null`), `targetTableNum` is set to `null` and any lingering `menza_last_table_id` is purged from `localStorage`.
2. **Nullable QR Scanner Resolution**: In `src/components/QrScannerModal.tsx`, `tableId` now defaults to `null`. If a store QR URL is scanned, it no longer appends a fake table ID.
3. **Restaurant-Scoped Active Order Check**: In `src/components/CustomerView.tsx`, an active order only provides a table fallback if it belongs to the currently viewed restaurant and is not in `Cancelled` or `Settled` status.

---

## 2. Complete Application Functionality Map

`MenzaOrder` provides two synchronized operational views: the **Customer Ordering Portal** and the **Staff POS / Kitchen Display System (KDS)**.

### 2.1 Customer Portal Features

| Feature | Operational Scope |
| :--- | :--- |
| **Encrypted Routing Engine** | Resolves obfuscated restaurant tokens (`encRestId`, `r`, `eid`) and table IDs. Normalizes the address bar to clean encrypted parameters (`?r=...`). |
| **Store vs Dine-In Dynamic Modes** | Automatically switches between **Takeaway / Counter Mode** (no table selected) and **Dine-In Mode** (table selected, waiter services enabled). |
| **Real-Time Menu & Filter System** | Categorized menu layout, veg/non-veg dietary toggles, spicy badges, portion size indicators, preparation time metrics, and live instant search. |
| **Operating Status & Auto-Lock** | Continuously evaluates store operating status (Open, Paused with countdown timer, Closed, Manual Mode). Disables ordering when the kitchen is closed or paused. |
| **Table Sanitization Protection** | Detects if a table is marked `Cleaning`, `Reserved`, or `Occupied` by another party. Displays informative alert banners and locks checkout to prevent double-seating. |
| **Cart & Multi-Tax Pricing** | In-memory and persisted cart management. Computes Item Total, CGST (2.5%), SGST (2.5%), discounts, platform fees, and packaging charges. |
| **Customer OTP Authentication** | Phone number login with 6-digit SMS OTP verification and auth token persistence. |
| **Cashfree Payment Gateway** | Native Cashfree SDK v3 integration. Creates payment orders, initiates seamless redirection, handles return URL callbacks, and performs server verification. |
| **Real-Time Order Tracking** | Live order status progression: `Placed` → `Confirmed` → `In Kitchen / Preparing` → `Ready / Plated` → `Served to Table` → `Settled`. |
| **Digital Waiter Call System** | Customers can send targeted table requests: **Call Waiter**, **Drinking Water**, **Request Bill**, or **Clean Table**. |
| **Sliding-Window Rate Limiting** | Client-side rate limiting prevents spamming service requests (60-second cooldown for bill requests, 45 seconds for waiter calls). |
| **In-App Camera QR Scanner** | HTML5 camera scanner that parses physical table QR stickers and switches dining context seamlessly. |
| **Branded QR Generator** | Generates exportable, high-resolution SVG and printable PNG QR codes with restaurant branding and table numbers. |

---

### 2.2 Staff POS & Kitchen Display (KDS) Features

| Feature | Operational Scope |
| :--- | :--- |
| **Staff Authentication** | PIN/OTP staff login with role-based access and multi-restaurant management. |
| **Visual Table Floor Plan** | Color-coded live table grid displaying capacities, current states (`Available`, `Occupied`, `Cleaning`, `Reserved`, `KOT_Active`, `Billed`), and linked orders. |
| **Kitchen Display System (KDS)** | Dedicated kitchen dashboard to transition tickets from `Pending` → `Confirmed` → `Preparing` → `Ready` → `Served`. |
| **Table Billing & Settlement** | Allows staff to generate pre-bills, accept cash/card/UPI payments, settle table balances, and reset tables back to `Available`. |
| **Direct Order Manipulation** | Staff can inject custom off-menu items or add extra dishes directly to an existing table ticket. |
| **SignalR Real-Time WebSocket Hub** | Connects to `/hubs/order` for bi-directional live sync. Includes synthesized Web Audio bell chimes (587Hz → 880Hz) and native desktop push notifications. |

---

## 3. Detailed Audit of Errors & Fixed Deficiencies

During our codebase inspection, 5 key bugs were discovered and patched:

### Defect 1: Stale Table Resurrection on Store URLs
* **File**: `src/App.tsx` (Lines 546–555)
* **Impact**: Scanning or clicking a general restaurant link caused previous table IDs to linger indefinitely.
* **Resolution**: If `urlTableId` is not present in the URL query string, `targetTableNum` is explicitly assigned `null` and `menza_last_table_id` is removed from `localStorage`.

### Defect 2: QR Scanner Modal Hardcoded Table ID 1
* **File**: `src/components/QrScannerModal.tsx` (Lines 24–38)
* **Impact**: Pasting or scanning any restaurant link without a table ID automatically converted the URL to Table 1.
* **Resolution**: Initialized `tableId` as `number | null = null`. If no table parameter is detected, the scan result passes `tableId: null`, cleanly stripping `tableId` from the destination URL.

### Defect 3: Cross-Restaurant Table Bleed from `activeOrder`
* **File**: `src/components/CustomerView.tsx` (Lines 706–715)
* **Impact**: If a user had an unsettled order from Restaurant A, opening Restaurant B showed Restaurant A's table banner.
* **Resolution**: Added restaurant ID matching and verified the order status is not `Cancelled` or `Settled`.

### Defect 4: Hardcoded `restaurantId = 1` in Table Status & Settlement API
* **File**: `src/services/api.js` (Lines 3876–3906, 4023–4046), `src/App.tsx` (Lines 1886–1925)
* **Impact**: Updating table status or settling a table from the staff dashboard always modified tables for Restaurant 1 instead of the staff's currently selected restaurant (e.g. Restaurant 52).
* **Resolution**: Passed `restaurantId` through `updateTableStatus` and `settleTable` functions.

### Defect 5: Backend Database Notice for Restaurant 52 ("Menza kitchen")
* **Observation**: Direct query to `/api/public/store/menu?r=fPo9f2iv1IjJcp77OZWtgA` revealed that all 10 tables in Restaurant 52 are currently configured with non-available statuses:
  * **Cleaning**: Tables 29 (T1), 30 (T2), 33 (TE1), 34 (TE2), 35 (R1), 37 (V1), 38 (V2)
  * **Occupied**: Tables 31 (A1), 32 (A2), 36 (R2)
* **Impact**: Whenever any table was previously assigned to Restaurant 52, the frontend locked ordering because every table was marked `Cleaning` or `Occupied`.
* **Action Item for Backend / Admin**: Log in to the restaurant admin panel or database and update table statuses to `"Available"` when they are open for seating.

---

## 4. Verification & Build Integrity

* **Type & Syntax Check**: Verified using TypeScript compiler (`tsc --noEmit`). Zero type errors found.
* **Production Build**: Verified using `vite build`:
  ```
  vite v6.4.3 building for production...
  ✓ 1998 modules transformed.
  dist/index.html                     1.82 kB │ gzip:   0.84 kB
  dist/assets/index-FGc1wPLm.css     12.67 kB │ gzip:   3.43 kB
  dist/assets/index-BopYkNoQ.js   1,061.24 kB │ gzip: 310.22 kB
  ✓ built in 9.60s (0 errors)
  ```
* **Git Commit Diff**:
  * `src/App.tsx`: Resolved table resurrection, effective restaurant ID resolution, and staff table management.
  * `src/components/CustomerView.tsx`: Restricted active order table fallbacks to current restaurant.
  * `src/components/QrScannerModal.tsx`: Nullable table ID support on URL parsing.
  * `src/services/api.js`: Multi-restaurant parameterization for table statuses and settlements.
