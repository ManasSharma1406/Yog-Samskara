/**
 * Firebase Admin SDK initialization for server-side auth verification.
 * REQUIRED for local dev: FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS
 * Without these, "default credentials" try metadata.google.internal (GCP-only) and fail locally.
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let isInitialized = false;

const initFirebaseAdmin = () => {
    if (isInitialized) return admin;

    try {
        if (admin.apps.length > 0) {
            isInitialized = true;
            return admin;
        }

        let credential = null;

        // Option 1: Service account JSON string (for Vercel/Heroku - store in env)
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (serviceAccountJson) {
            const serviceAccount = typeof serviceAccountJson === 'string'
                ? JSON.parse(serviceAccountJson)
                : serviceAccountJson;
            credential = admin.credential.cert(serviceAccount);
            console.log('Firebase Admin initialized (FIREBASE_SERVICE_ACCOUNT)');
        }
        // Option 2: Path to service account JSON file
        else {
            const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
            if (credPath) {
                const resolved = path.isAbsolute(credPath) ? credPath : path.resolve(process.cwd(), credPath);
                if (fs.existsSync(resolved)) {
                    const serviceAccount = JSON.parse(fs.readFileSync(resolved, 'utf8'));
                    credential = admin.credential.cert(serviceAccount);
                    console.log('Firebase Admin initialized (GOOGLE_APPLICATION_CREDENTIALS)');
                }
            }
        }

        if (credential) {
            admin.initializeApp({ credential });
        } else {
            console.warn('Firebase Admin: No FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS set.');
            console.warn('User auth (verifyIdToken) and listUsers will NOT work until you add one of these to .env');
            console.warn('Get service account: Firebase Console → Project Settings → Service Accounts → Generate new key');
        }
        isInitialized = true;
    } catch (err) {
        console.warn('Firebase Admin init failed:', err.message);
    }
    return admin;
};

module.exports = { initFirebaseAdmin, admin };
