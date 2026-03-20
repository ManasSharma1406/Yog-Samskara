# Hostinger Migration Guide

Follow these steps to migrate your backend from Render to Hostinger.

## 1. Locate Node.js in Hostinger hPanel
If you are on a **Business Web Hosting** plan, Node.js support was recently added. If you can't see it immediately, follow these exact steps:

1. Log in to your **Hostinger hPanel**.
2. Go to **Websites** in the top menu.
3. Select your domain and click **Manage**.
4. In the **left sidebar**, look for the **Websites** category and click on **Node.js**.
5. **Alternative**: If you don't see it in the sidebar, use the **Search Bar** at the top of the hPanel and type **"Node.js"**.

> [!NOTE]
> If Node.js still doesn't appear, ensure your domain is pointed to Hostinger servers. If it is, contact Hostinger support via live chat to enable it for your Business plan (sometimes older sub-plans need a manual toggle).

## 2. Create the Node.js Application
1. Click **Create Application**.
2. Set the **Application Name**: `yogsamskara-backend`
3. Set the **Node.js Version**: `18.x` or `20.x`.
4. Set the **Application URL**: (Choose your domain or a subdomain like `api.yourdomain.com`).
5. Set the **Entry File**: `server.js`.
6. Click **Create**.

## 3. Configure Environment Variables
In the Hostinger Node.js dashboard, go to the **Environment Variables** tab and add these **Keys** and **Values**:

| Key | Value (Copy Exactly) | Note |
|-----|----------------------|------|
| `NODE_ENV` | `production` | Set to production |
| `PORT` | `3000` | Or leave default |
| `RAZORPAY_KEY_ID` | `rzp_live_SP7aooyeXdBQDV` | Live Key ID |
| `RAZORPAY_KEY_SECRET` | `DmUuxwqject1pEO3bfaYIHry` | Live Secret |
| `JWT_ACCESS_SECRET` | `your_super_secret_access_token_key_123!` | Access token Secret |
| `JWT_REFRESH_SECRET` | `your_super_secret_refresh_token_key_456!` | Refresh token Secret |
| `OPENROUTER_API_KEY` | `sk-or-v1-fec20767...` | Your OpenRouter key |
| `GOOGLE_APPLICATION_CREDENTIALS` | `./serviceAccountKey.json` | Path to Firebase file |
| `SMTP_HOST` | `smtp.gmail.com` | Gmail SMTP |
| `SMTP_PORT` | `587` | TLS Port |
| `SMTP_USER` | (Your Email Here) | e.g. `user@gmail.com` |
| `SMTP_PASS` | (Your App Password Here) | Get from Google Settings |
| `RAZORPAY_WEBHOOK_SECRET` | (Set in Razorpay Dashboard) | Secret for webhook |
### Method C: Use File Manager (Most Reliable)
If the hPanel environment variables are not working, follow these steps:
1.  Open the **File Manager** in Hostinger.
2.  Go to your backend folder (e.g., `public_html/api/`).
3.  Create a **new file** named `.env` (note the dot at the beginning).
4.  Paste **all** your environment variables into this file (copy from your local `backend/.env` and replace secrets with live values).
5.  Also, upload your `serviceAccountKey.json` directly into this same folder.
6.  **Restart** the Node.js application.

## 5. Install Dependencies & Start
1. In the Hostinger Node.js dashboard, click the **Install Dependencies** button (it runs `npm install`).
2. Once done, click the **Start Application** button.
3. Check the **Logs** tab to ensure the server started successfully.

## 6. How to Handle Frontend Environment Variables
For a React/Vite frontend, you **do not upload the `.env` file** to Hostinger. The variables are "baked" into your site during the build process.

### Step 1: Update your Local `.env.local`
In your `frontend/.env.local` file, change the backend URL to your live Hostinger URL:
```bash
VITE_API_URL=https://api.yogsamskara.com  # Use your actual LIVE URL here
```

### Step 2: Build the Frontend
On your local computer, open a terminal in the `frontend` folder and run:
```bash
npm install
npm run build
```
This creates a **`dist`** folder inside your `frontend` directory.

### Step 3: Upload to Hostinger
1. Log in to Hostinger hPanel and open the **File Manager**.
2. Go to the `public_html` folder of your main website domain.
3. **Upload the contents** of the `dist` folder into `public_html`.
   *   Do not upload the `dist` folder itself, just the files *inside* it (like `index.html`, `assets/`, etc.).

---

## 7. Razorpay Webhook (Important)
If you use Razorpay webhooks, update the Webhook URL in your Razorpay Dashboard to point to your new Hostinger URL:
`https://api.yogsamskara.com/api/payments/webhook`
