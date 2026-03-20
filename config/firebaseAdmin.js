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
            try {
                const serviceAccount = typeof serviceAccountJson === 'string'
                    ? JSON.parse(serviceAccountJson)
                    : serviceAccountJson;
                credential = admin.credential.cert(serviceAccount);
                console.log('Firebase Admin: Successfully parsed FIREBASE_SERVICE_ACCOUNT');
            } catch (parseErr) {
                console.error('Firebase Admin: JSON.parse failed for FIREBASE_SERVICE_ACCOUNT:', parseErr.message);
                console.error('Check if the JSON string is valid and not escaped incorrectly.');
            }
        }
        // Option 2: Path to service account JSON file
        else {
            const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
            if (credPath) {
                const resolved = path.isAbsolute(credPath) ? credPath : path.resolve(process.cwd(), credPath);
                if (fs.existsSync(resolved)) {
                    try {
                        const serviceAccount = JSON.parse(fs.readFileSync(resolved, 'utf8'));
                        credential = admin.credential.cert(serviceAccount);
                        console.log('Firebase Admin: Initialized from file at', resolved);
                    } catch (fileErr) {
                        console.error('Firebase Admin: Failed to read/parse file at', resolved, ':', fileErr.message);
                    }
                } else {
                    console.warn('Firebase Admin: GOOGLE_APPLICATION_CREDENTIALS file not found at', resolved);
                }
            }
        }

        if (credential) {
            admin.initializeApp({ credential });
            console.log('Firebase Admin: app initialized successfully');
        } else {
            console.error('Firebase Admin: Initialization FAILED - No valid credential source found.');
        }
        isInitialized = true;
    } catch (err) {
        console.error('Firebase Admin: Unexpected error during init:', err.message);
    }
    return admin;
};

module.exports = { initFirebaseAdmin, admin };
