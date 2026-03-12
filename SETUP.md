# Backend Setup - YOG SAMSKARA

## Quick Start

1. Copy `.env.example` to `.env` and fill in your values
2. Install: `npm install`
3. Run: `npm run dev` (or `npm start`)

## Required Configuration

### Firebase Admin (Critical for User Auth & Instructor Portal)

**If you see "Failed to determine project ID: getaddrinfo ENOTFOUND metadata.google.internal"** – Firebase Admin needs explicit credentials on local machines. Add one of the options below.

**Option A** – Service account JSON in env (recommended for Vercel/Heroku):
```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-project",...}
```
Get this from Firebase Console → Project Settings → Service Accounts → Generate new private key.

**Option B** – Service account file:
```env
GOOGLE_APPLICATION_CREDENTIALS=./path/to/serviceAccountKey.json
```

### Database

- **Production**: Set `DATABASE_URL` (PostgreSQL)
- **Local dev**: If unset, falls back to SQLite (`database.sqlite`)

### Admin (Instructor) Login

Set in `.env`:
```env
JWT_SECRET=your_secret_key
ADMIN_EMAIL=teacher@yogsamskara.com
ADMIN_PASSWORD=secure_password
```
Default fallback: `teacher@flownest.com` / `teacher123` (change in production!)

### Razorpay

Required for payments. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.

### Email (Optional)

For booking confirmations and meeting link emails. Set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`.

## Instructor Portal Flow

1. **Admin login** – `/api/admin/login` (email/password, returns JWT)
2. **List customers** – `/api/admin/customers` – merges:
   - Profiles (users who completed questionnaire)
   - Bookings (users with any booking)
   - Firebase Auth users (when Firebase Admin is configured)
3. **Customer detail** – `/api/admin/customer/:email` – profile, subscription, bookings
4. **Update meeting link** – `PUT /api/admin/booking/:id/meet-link` – saves link and emails customer

## Real-time Behavior

- Instructor portal polls customers every 25 seconds
- Customer detail view polls every 30 seconds when open
- New signups appear via profile-ensure flow (Dashboard) or Firebase list when configured
