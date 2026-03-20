/**
 * Firebase Admin SDK initialization for server-side auth verification.
 * Priority: FIREBASE_SERVICE_ACCOUNT env > GOOGLE_APPLICATION_CREDENTIALS file > inline fallback
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Inline fallback credentials (used when .env is not available on the server)
const INLINE_SERVICE_ACCOUNT = {
    type: "service_account",
    project_id: "yogsamskara-82f4c",
    private_key_id: "5cbdbb188c593c1f288b772e03cd08ff2d7cb790",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDKf8oYqi4uDDD5\nOS1MAP9vMzkrDkEiWbzxiAtAITPpe4sF8hBg3biMTCEb/rvYfzrJz5IGR9t/mP7V\nHUaBX6jVms7rPN3rVjyJxc8mi9uTsO/EHUN2kAeQPqCB/zhmFWRciFYkveZvNInV\nuhJb6aDDuBJWDnP+/6NpAiyoJdlsRnDFJdPIwthd9DL6V3P+vvmynqQvVAZWPO3U\nfq/BKbfIJaQ/iE6mWvv9+3eNr3fpEgULzL0d1FfHZkE4t2+2CUx7oxGypY8LtskX\ntbqWOMLYpDNgxULR1DQHZVVdqwrpBPr3MjwsD4WSkorVsk/ZT/yCpG0O17Rl1x5b\n1LbEgO0jAgMBAAECggEAFWFTrbH+KTd5Tj8GtNEgJxYB8bVSFDXkWJ4UDgPTbtHv\n9kM+DnQqgYmiL0oAfFXGl7s2QDqDBuBY+5hZMtyuP0tWkIi/J5NV1fgQLJI0r03N\nqueqEVEYs1ahbMhNJJ4amBh+++ce9tvVt76rJJAwvKlpKjPhdGl6T+J+Y4yHfcJs\nFsJGQzWoBCeRj1Ksj2jGWc5TsxZvWpRoJhBWi9JrWNJQO5JEQXLMgkjRaBpPy2QL\nBccnzIctIjI8CZEGokTQ6rrO38VhAYhRH6JdcJMpQu8dQY7vNNsBzH8vNBZYa2Cu\n9k/glZS93GKJMX4l3AC+dIpkAfCUhYDH5rS/ynVj+QKBgQDr3IsD8Fic1oMvLe4j\nmiHA3JnQE9SUrREoTmqSMg8FO9/byA1YrgXKOJqtPQ2cPSoulYS5RKjQOU8pqr+w\nJyd/EjzZry6POZwT49uLAS+p/sVUzIJjiUigy3bcvjolNCIw5PbB2CSiMCAvqBub\n2fSM3yZYuWzgK/1BPe9RvdIWaQKBgQDbygNreTAe3QyULtCAsHt9XqkJ/x3Bf+Qs\nlGWY2GC+rIvj4rv9QB+M7aMZo6UsUTa35AaoPLrGh0mjvj8SJI4I2HSkzMrl46EA\nMnJjasNKPQbf4tqkZGCicI9rM45m7bDZdkvfDaq4IWj0wEmIdw6KIupeF96mMuJp\n3ze/9O+tqwKBgBNl6hEC3WbYxaVFs8Y90PTZr9TLLLqlmTmlaWJot4+IoxqiU2at\nuVAuY5pH4SyuYx+9sFLEcNXfQMF+h5FnRvpOd663l66z4EBKhy3hhRgIGhalUzv4\neH6w/S+efY29weofiqPasPid2KfSvaKNxG0plS/K4Ed3lrac72fbosGxAoGAPBS1\n6JwhLl6owJ0ne/ZCW5wTw1rMzIdkXVdXinejwpuyReJGF01/EmwniKu2TC4LMiuQ\nMk8fk4OJ+svXu+LoPLzG7gHZeQxHh6FCqbCWn+Wcynjd4dBapiz0144pYDObg2aW\nCOxYfasMYNNrhnVdMR+oR35o66+/Ose9GqkfF68CgYBzfGtrngX7/aQrQg8MOs0e\nU5iKsODwWFyVtFXmpN28xKLUlCyxp7xYoMyluROxERchxJzcDiwZ95178xoRSNUb\nwwXvpvrocbNhxxkMFpDGovMAs8hxLyNm3t4qfZypqNMQJkTrDe3ilnBfw4YB2cyf\ns/vnShK94+HhVQYtGXHRUQ==\n-----END PRIVATE KEY-----\n",
    client_email: "firebase-adminsdk-fbsvc@yogsamskara-82f4c.iam.gserviceaccount.com",
    client_id: "101536568503077231245",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40yogsamskara-82f4c.iam.gserviceaccount.com",
    universe_domain: "googleapis.com"
};

let isInitialized = false;

const initFirebaseAdmin = () => {
    if (isInitialized) return admin;

    try {
        if (admin.apps.length > 0) {
            isInitialized = true;
            return admin;
        }

        let credential = null;

        // Option 1: FIREBASE_SERVICE_ACCOUNT env var (JSON string)
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (serviceAccountJson) {
            try {
                const serviceAccount = typeof serviceAccountJson === 'string'
                    ? JSON.parse(serviceAccountJson)
                    : serviceAccountJson;
                credential = admin.credential.cert(serviceAccount);
                console.log('Firebase Admin: Initialized via FIREBASE_SERVICE_ACCOUNT env var');
            } catch (parseErr) {
                console.error('Firebase Admin: JSON.parse failed for FIREBASE_SERVICE_ACCOUNT:', parseErr.message);
            }
        }

        // Option 2: GOOGLE_APPLICATION_CREDENTIALS file path
        if (!credential) {
            const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
            if (credPath) {
                const resolved = path.isAbsolute(credPath) ? credPath : path.resolve(process.cwd(), credPath);
                if (fs.existsSync(resolved)) {
                    try {
                        const serviceAccount = JSON.parse(fs.readFileSync(resolved, 'utf8'));
                        credential = admin.credential.cert(serviceAccount);
                        console.log('Firebase Admin: Initialized from file at', resolved);
                    } catch (fileErr) {
                        console.error('Firebase Admin: Failed to read/parse file:', fileErr.message);
                    }
                } else {
                    console.warn('Firebase Admin: File not found at', resolved);
                }
            }
        }

        // Option 3: Inline hardcoded fallback (always works)
        if (!credential) {
            credential = admin.credential.cert(INLINE_SERVICE_ACCOUNT);
            console.log('Firebase Admin: Initialized via inline fallback credentials');
        }

        admin.initializeApp({ credential });
        console.log('Firebase Admin: App initialized successfully');
        isInitialized = true;
    } catch (err) {
        console.error('Firebase Admin: Unexpected error during init:', err.message);
    }
    return admin;
};

module.exports = { initFirebaseAdmin, admin };
