# Smart Mess Management System (College Hostel)

A complete, production-grade, consumption-based Mess Management System for college hostels with real device camera face verification, atomic duplicate prevention, dynamic pricing, and downloadable itemized PDF statements.

---

## 1. Core Business Rules

- **Strict Pay-Per-Meal Model**: Students pay **ONLY** for meals they actually consume and check into.
- **No Fixed Monthly Fees**: Traditional flat semester or monthly fees are strictly prevented.
- **4 Meal Categories**:
  - `BREAKFAST` (07:30 – 09:30, Default ₹30.00)
  - `LUNCH` (12:30 – 14:30, Default ₹50.00)
  - `SNACKS` (17:00 – 18:30, Default ₹20.00)
  - `DINNER` (19:30 – 21:30, Default ₹50.00)
- **Atomic Attendance & Charges**: Exactly 1 attendance record and 1 snapshot meal charge are created in a single database transaction.
- **Skipped Meals**: Zero attendance and zero charges.
- **Historical Price Immutability**: Modifying today's price updates future check-ins; past charges remain unaltered.

---

## 2. Portal URLs & Deployment Architecture

The application provides two isolated portals:

- **Admin Portal**: `https://YOUR-DOMAIN/admin`
  - Dashboard analytics (Recharts)
  - Student registration & directory
  - Face biometric enrollment & revocation
  - Live Mess Entry terminal
  - Dynamic menus, timings & pricing
  - Attendance history & audited voiding
  - Payments, adjustments & PDF reports
  - Tamper-evident system audit logs
- **Student Portal**: `https://YOUR-DOMAIN/student`
  - Personal meal status for today
  - Consumption breakdown (today, weekly, monthly, semester, yearly)
  - Itemized check-in calendar & bill history
  - One-click official PDF statement download
  - Dietary preferences & permitted remarks

Both routes support direct URL entry, browser refresh, and mobile viewports.

---

## 3. Technology Stack & Verification Status

| Layer | Technology | Status |
|---|---|---|
| **Frontend** | React 18, TypeScript, Vite 4, Tailwind CSS, Lucide Icons, Recharts | Built & Verified |
| **Backend** | Node.js, Express, TypeScript, Zod, Prisma ORM 4.16.2 | Built & Tested |
| **Database** | SQLite (`dev.db` locally), PostgreSQL (Production schema & migrations) | Verified & Seeded |
| **Biometrics** | Physical camera `getUserMedia()`, `@vladmandic/face-api`, AES-256-GCM encryption | Tested & Verified |
| **PDF Engine** | PDFKit server-side vectorized PDF generation | Tested & Verified |
| **Tests** | Vitest + Supertest comprehensive integration suite | **37 / 37 Tests Passed** |

---

## 4. Local Development Setup

### Prerequisites
- Node.js `v16.20.2` (or Node 18+ on platforms with glibc 2.28+)
- npm `8.19+`

### 1. Install Dependencies
```bash
# Root & workspaces installation
npm install
cd server && npm install
cd ../client && npm install
cd ..
```

### 2. Configure Environment Variables
Copy `.env.example` to `server/.env`:
```bash
cp .env.example server/.env
```

### 3. Initialize Database
```bash
cd server
npx prisma db push
cd ..
```

### 4. Bootstrap Initial Admin Account
No public admin registration route exists. Create the first admin via the secure bootstrap CLI command:
```bash
npm run bootstrap-admin -- --username messadmin --password YourStrongPassword123!
```

### 5. Start the Application
Run server and client concurrently or in separate terminals:
```bash
# Terminal 1: Backend API (Port 5000)
npm run dev:server

# Terminal 2: Frontend Vite App (Port 3000)
npm run dev:client
```
- Open `http://localhost:3000/admin` for the Admin Portal.
- Open `http://localhost:3000/student` for the Student Portal.

---

## 5. Running Automated Integration Tests

Run the full suite of 37 integration tests covering authentication, RBAC, IDOR security, biometrics, atomic attendance, duplicate scan rejection, pricing snapshots, and PDF statements:

```bash
npm test
```

Test Results Summary:
- **Authentication & RBAC**: 9/9 passed
- **Manual Student Registration & Uniqueness**: 3/3 passed
- **Biometric AES-256-GCM Protection**: 4/4 passed
- **Dynamic Meals & Atomic Attendance**: 6/6 passed
- **Consumption Billing & Adjustments**: 3/3 passed
- **PDF Generation & IDOR Security**: 3/3 passed
- **Account Deactivation & Auditing**: 2/2 passed
- **SPA Route Fallbacks (/admin & /student)**: 7/7 passed

---

## 6. Real Camera & Face Verification Details

- **Device Camera Access**: Real browser camera stream captured via `navigator.mediaDevices.getUserMedia()`.
- **Neural Network Architecture**: Pre-trained weights for TinyFaceDetector (416x416), 68 facial landmark detection, and FaceNet 128-dimensional recognition.
- **Model Storage**: Hosted statically at `client/public/models/`.
- **License**: MIT License (`@vladmandic/face-api`).
- **Security Invariants**:
  - The browser extracts the probe descriptor and sends it to `/api/attendance/verify-entry`.
  - The client **never** submits a student ID or similarity score.
  - The server **authoritatively** decrypts stored templates (AES-256-GCM) and computes exact Euclidean distance:
    $$d(u, v) = \sqrt{\sum_{i=1}^{128} (u_i - v_i)^2}$$
  - Match is confirmed only if $d(u, v) \le 0.50$ and there is no runner-up ambiguity.
  - Biometric templates can be permanently revoked/deleted via the admin console with audit records.

---

## 7. Production Deployment (Vercel & PostgreSQL)

### Option A: Separate Persistent Backend + Vercel Frontend
1. **Database**: Spin up a PostgreSQL instance on Supabase, Neon, Railway, or AWS RDS.
2. **Backend**:
   - Host `server` on Render, Railway, Fly.io, or VPS.
   - Set environment variables (`DATABASE_URL`, `SESSION_SECRET`, `BIOMETRIC_ENCRYPTION_KEY`, `FRONTEND_URL`).
   - Run `npx prisma db push --schema=prisma/schema.postgresql.prisma`.
3. **Frontend (Vercel)**:
   - Connect repository to Vercel.
   - Root Directory: repository root.
   - Build Command: `cd client && npm install && npm run build`.
   - Output Directory: `client/dist`.
   - Update `vercel.json` rewrite destination from `https://YOUR-BACKEND-API-DOMAIN` to your live backend domain.
   - Vercel handles direct navigation and refresh to `/admin` and `/student` via `vercel.json`.

### Option B: Monolithic Node.js Container (Docker / VPS)
The Express server already serves `client/dist` statically with SPA fallback for `/admin*` and `/student*`.
```bash
npm run build
npm start
```
The server listens on `PORT` (default 5000) and serves both the API and client at:
- `http://your-host:5000/admin`
- `http://your-host:5000/student`
