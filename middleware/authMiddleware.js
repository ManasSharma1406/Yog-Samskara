const { admin } = require('../config/firebaseAdmin');

/**
 * Middleware to verify Firebase ID Token from Authorization header.
 * Usage: router.get('/route', protect, handler)
 */
const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    try {
        if (!admin.apps.length || !admin.auth) {
            return res.status(503).json({ 
                success: false, 
                message: 'Authentication service unavailable. Firebase Admin is not configured.' 
            });
        }
        const decoded = await admin.auth().verifyIdToken(token);
        req.user = { uid: decoded.uid, email: decoded.email, displayName: decoded.name };
        next();
    } catch (err) {
        console.error('Auth verify error:', err.message);
        return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
};

module.exports = { protect };
