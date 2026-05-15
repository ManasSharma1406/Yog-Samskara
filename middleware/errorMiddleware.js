const logger = require('../utils/logger');
const { sendCriticalAlert } = require('../utils/mailer');

const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log to Winston
    logger.error(`${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`, { stack: err.stack });

    // Handle specific errors
    if (err.name === 'CastError') {
        return res.status(404).json({ success: false, message: 'Resource not found' });
    }

    if (err.code === 11000) {
        return res.status(400).json({ success: false, message: 'Duplicate field value entered' });
    }

    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message);
        return res.status(400).json({ success: false, message });
    }

    const statusCode = error.statusCode || 500;

    // Send email alert for critical 500 errors in production
    if (statusCode === 500) {
        sendCriticalAlert({
            message: err.message,
            stack: err.stack
        }).catch(e => logger.error('Failed to send critical alert email', e));
    }

    res.status(statusCode).json({
        success: false,
        message: error.message || 'Server Error',
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
};

module.exports = errorHandler;
