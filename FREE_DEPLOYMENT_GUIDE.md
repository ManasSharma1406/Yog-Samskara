# Free Deployment Guide: Supabase + Koyeb

To run your backend and database for free with high performance, follow these steps. 

> [!TIP]
> Since you are on a **Hostinger Business Plan**, you can also host your Node.js backend there directly for "free" (included in your plan). See [HOSTINGER_GUIDE.md](file:///c:/Users/Manas%20Sharma/Downloads/flownest-studio%20%281%29/backend/HOSTINGER_GUIDE.md) for steps.

## 1. Database: Setup Supabase (Always Free PostgreSQL)
Supabase provides a persistent database that won't be wiped like SQLite on free servers.

1. Go to [Supabase.com](https://supabase.com) and create a free account.
2. Create a new Project (e.g., `yogsamskara-db`).
3. Once the project is ready, go to **Project Settings** > **Database**.
4. Find the **Connection string** section, select **URI**, and copy the Postgres URL. It looks like:
   `postgres://postgres.[YOUR-ID]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
5. **Important**: Remember the password you set during project creation!

## 2. Backend: Setup Koyeb (Free Node.js Hosting)
Koyeb is a faster alternative to Render for running Express apps.

1. Go to [Koyeb.com](https://koyeb.com) and create a free account.
2. Click **Create Service**.
3. Connect your GitHub repository (`ManasSharma1406/Yog-Samskara`).
4. In the **App Configuration**:
   - **Instance Type**: Select **Nano** (Free tier).
   - **Environment Variables**: Add all variables from your `.env`:
     - `RAZORPAY_KEY_ID`: `rzp_live_SP7aooyeXdBQDV`
     - `RAZORPAY_KEY_SECRET`: (Your Secret)
     - `DATABASE_URL`: (The Supabase URI you copied in Step 1)
     - `NODE_ENV`: `production`
     - `JWT_ACCESS_SECRET`: (Your Secret)
     - `PORT`: `8080` (Koyeb default)
5. **Firebase Credentials**: Since your app needs `serviceAccountKey.json`, ensure it is included in your GitHub repo OR use the `FIREBASE_SERVICE_ACCOUNT` environment variable strategy if you prefer not to commit the file (though the file is already in your `backend` folder).

## 3. Update Frontend
Once Koyeb gives you a public URL (e.g., `https://yogsamskara-backend.koyeb.app`), update your frontend `.env.local`:

```bash
VITE_API_URL=https://yogsamskara-backend.koyeb.app
```

## 4. Why this is better than Render?
- **Faster Startup**: Koyeb has less "cold start" delay than Render's free tier.
- **Persistent Data**: Supabase is a real database, so your user data and bookings will **never** be deleted when the server restarts.
