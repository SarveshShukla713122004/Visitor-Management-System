# MECON Limited Ranchi — Visitor Management System (VMS)

An enterprise 4-role Visitor Management & Gate Access Control System built specifically for **MECON Limited (Ministry of Steel, Govt. of India), Ranchi Engineering Headquarters**.

---

## 🏛️ System Architecture & Workflow

The system enforces a strict 4-role sequential chain-of-approval:

```
[ Employee ] Submits Visitor Request (Name, Purpose, Phone, Aadhaar, Photo)
      │
      ▼
[ HOD ] Reviews Department Queue → Approves or Rejects (Mandatory Reason Required)
      │ (If Approved)
      ▼
[ Security ] Automatic Blacklist Check → Physical ID Verification → Gate Pass PDF Generated → Checked-In
      │
      ▼
[ Security Exit Desk ] Visitor Exit Check-Out → Record Closed (Midnight Auto-Expiry)
```

---

## 👥 4 Admin-Provisioned Roles

> ⚠️ **No Public Self-Registration**: Only Admin can provision user accounts. Self-registration is disabled for enterprise security integrity.

1. **Admin**
   - Provisions/deactivates Admin, HOD, Employee, and Security accounts.
   - Enforces **One HOD per Department** constraint.
   - Accesses full system audit trail, blacklist directory, and ML analytics dashboard.

2. **Employee**
   - Submits visitor requests with phone number validation (10-digit Indian pattern) and Aadhaar masking.
   - Features **Recurring Visitor Auto-Fill** on phone lookup.
   - Tracks live submission status (`Pending`, `HOD Approved`, `HOD Rejected`, `Checked-In`, `Checked-Out`).

3. **HOD (Head of Department)**
   - Views department-scoped request queue.
   - Approves or rejects with a mandatory rejection reason visible to the employee.
   - Sets **Leave Delegate HOD** to ensure workflow continuity during absence.

4. **Security Officer**
   - Accesses HOD-approved clearance queue with automatic blacklist screening.
   - Generates downloadable/printable **PDF Gate Passes** with unique QR codes.
   - Manages the live **Currently Checked-In** campus list and processes exit check-outs.

---

## 🚀 Tech Stack

- **Frontend**: React.js, TailwindCSS, Lucide-React, Recharts, Socket.io-client, jsPDF, QRCode
- **Backend**: Node.js, Express.js, MongoDB (Mongoose), Socket.io, Helmet, Rate-Limiter, Mongo-Sanitize, Morgan
- **Analytics & ML**: Pure JavaScript regression forecasting, Z-Score HOD anomaly detection, auto-generated weekly plain-English insights

---

## 🏎️ Running Locally

### Backend Setup
```bash
cd backend
npm install
npm run dev
```
*Note: If no `MONGO_URI` is supplied in `.env`, the server automatically starts an in-memory MongoDB database and seeds it with demo accounts.*

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🔑 Demo Credentials

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@mecon.co.in` | `Password123` |
| **HOD (Metallurgy)** | `hod.metallurgy@mecon.co.in` | `Password123` |
| **Employee** | `employee@mecon.co.in` | `Password123` |
| **Security** | `security@mecon.co.in` | `Password123` |
