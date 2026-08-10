# Product Requirement Document (PRD): MileTriage

## **1. Product Overview**
* **Product Name:** MileTriage
* **Tagline:** Effortless, telematics-driven mileage classification for Tesla owners.
* **Target Audience:** Business owners, freelancers, and independent contractors driving a Tesla who need to track business vs. personal miles for tax write-offs or expense reimbursements.
* **Core Value Proposition:** Eliminates mobile app battery drain, manual GPS tracking, and forgotten drives by pulling telematics directly from the Tesla Fleet API. Users perform a quick, visual 30-second weekly "triage" on a web dashboard to categorize drives using interactive maps.

---

## **2. Goals & Objectives**
* **Zero-Touch Drive Logging:** Log 100% of vehicle drives automatically via server-to-server Tesla Telemetry without requiring phone background apps.
* **Sub-Minute Weekly Review:** Enable users to review and classify an entire week's worth of drives in under 60 seconds using side-by-side map previews.
* **Audit-Proof Accuracy:** Rely on internal vehicle odometer data rather than estimated smartphone GPS distances for 100% tax compliance accuracy.

---

## **3. System Architecture & Scope (MVP / V1)**

```
┌─────────────────┐       Tesla Fleet API       ┌──────────────────────┐
│  Tesla Vehicle  │ ──────────────────────────► │  MileTriage Backend  │ (apps/api)
└─────────────────┘      (Telemetry Event)      └──────────┬───────────┘
                                                           │
                                                           ▼
                                                ┌──────────────────────┐
                                                │ PostgreSQL Database  │
                                                └──────────┬───────────┘
                                                           │
                                                           ▼
┌─────────────────┐      REST API / JSON        ┌──────────────────────┐
│ User / Browser  │ ◄────────────────────────── │  MileTriage Web App  │ (apps/web)
└─────────────────┘                             └──────────────────────┘
```

---

## **4. Functional Requirements**

### **Module 1: Vehicle Onboarding & Auth**
* **FR-1.1 (Tesla OAuth):** The web app **shall** authenticate users via Tesla OAuth 2.0 to obtain read access for vehicle telemetry without storing Tesla account passwords.
* **FR-1.2 (Virtual Key Pairing):** The web app **shall** present a deep link or QR code instructing the user to pair MileTriage’s virtual key inside the official Tesla app.
* **FR-1.3 (Vehicle Registration):** The system **shall** fetch registered vehicles associated with the Tesla account and allow the user to select which vehicle(s) to track.

### **Module 2: Automated Telemetry Ingestion**
* **FR-2.1 (Drive Start/End Detection):** The backend **shall** maintain HTTPS webhook listeners to catch Tesla Fleet Telemetry events (`drive_start`, `drive_end`).
* **FR-2.2 (Odometer & Route Capture):** Upon `drive_end`, the backend **shall** record:
  * Exact starting and ending odometer readings.
  * Start and end GPS coordinates (latitude, longitude).
  * Timestamp and total drive duration.
  * Intermediate GPS breadcrumbs for route plotting.
* **FR-2.3 (Draft State):** Every newly recorded drive **shall** default to a status of `Unclassified`.

### **Module 3: Weekly Review Dashboard (Web UI)**
* **FR-3.1 (Split-Screen Layout):** The web dashboard **shall** feature a split-screen view:
  * **Left Column:** Chronological list of `Unclassified` trips grouped by week.
  * **Right Column:** Interactive map rendering the route of the selected trip.
* **FR-3.2 (Map Route Preview):** Selecting any trip in the list **shall** instantly update the map to display:
  * Start Marker (Green Pin) where the car shifted out of `Park`.
  * End Marker (Red Pin) where the car shifted back into `Park`.
  * Trace of the path driven.
* **FR-3.3 (Single-Click Triage):** Each trip row **shall** provide prominent `[ Business ]` and `[ Personal ]` toggle buttons.
* **FR-3.4 (Batch Classification):** The UI **shall** support multi-select checkboxes to classify multiple trips as Business or Personal simultaneously.

### **Module 4: Reporting & Data Export**
* **FR-4.1 (Tax Calculation):** The app **shall** calculate deduction totals by multiplying classified Business miles by a configurable rate (e.g., standard IRS mileage rate).
* **FR-4.2 (Export Formats):** The web app **shall** export classified logs to **CSV** and **PDF** formats containing:
  * Date, Start/End addresses/coordinates, Start/End Odometer, Total Miles, Purpose (Business/Personal), and Calculated Deduction ($).

---

## **5. Non-Functional Requirements**

* **Performance:** Selecting a trip in the web inbox must render the map trace within **< 300ms**.
* **Reliability:** Webhook endpoints must maintain **99.9% uptime** to ensure zero missed telemetry signals.
* **Security & Privacy:** 
  * All Tesla API access tokens must be encrypted at rest using AES-256.
  * Location data must be private to the account holder and never sold or shared.
* **Vehicle Battery Safeguards:** The API integration must rely on event-driven streaming webhooks rather than aggressive polling to allow the vehicle to enter deep sleep when stationary.

---

## **6. Out of Scope for V1 (Future Roadmap)**

* **Automatic Geofence Rules Engine (V2):** Auto-flagging frequent destinations (e.g., Home, Office) without user intervention.
* **Native Mobile Apps (V2):** iOS/Android wrappers (V1 is exclusively web-focused).
* **Multi-Driver Assignment (V2):** Attributing drives to specific secondary drivers sharing the vehicle.
