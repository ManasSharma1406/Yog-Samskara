const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const Subscription = require('../models/Subscription');
const { protect } = require('../middleware/authMiddleware');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Helper function to activate subscription
const activateSubscription = async (userId, planName, orderId, paymentId) => {
    let sessions = 0;
    let months = 1;

    // Logic for different plans
    if (planName.includes('Personal')) {
        sessions = 12;
    } else if (planName.includes('Family')) {
        sessions = 24;
    } else if (planName.includes('Immersive')) {
        sessions = 32;
        months = 12;
    }

    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + months);

    await Subscription.findOneAndUpdate(
        { userId },
        {
            planName,
            status: 'active',
            totalSessions: sessions,
            sessionsUsed: 0,
            startDate,
            expiryDate,
            lastPaymentId: paymentId,
            lastOrderId: orderId
        },
        { upsert: true, new: true }
    );
};

// @desc    Create Razorpay Order
// @route   POST /api/payments/create-order
// @access  Private
router.post('/create-order', protect, async (req, res) => {
    try {
        const { amount, planName, currency = 'INR' } = req.body;
        const userId = req.user.uid;

        const options = {
            amount: amount * 100, // amount in the smallest currency unit (paise for INR)
            currency,
            receipt: `receipt_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);

        // Save pending transaction
        await Transaction.create({
            userId,
            orderId: order.id,
            planName,
            amount,
            currency,
            status: 'pending'
        });

        res.status(200).json(order);
    } catch (error) {
        console.error('Razorpay Order Error:', error);
        res.status(500).json({ message: 'Failed to create order' });
    }
});

// @desc    Verify Razorpay Payment Signature
// @route   POST /api/payments/verify
// @access  Private
router.post('/verify', protect, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            // Update transaction
            const transaction = await Transaction.findOneAndUpdate(
                { orderId: razorpay_order_id },
                {
                    paymentId: razorpay_payment_id,
                    signature: razorpay_signature,
                    status: 'captured'
                },
                { new: true }
            );

            if (transaction) {
                await activateSubscription(transaction.userId, transaction.planName, razorpay_order_id, razorpay_payment_id);
            }

            return res.status(200).json({ message: "Payment verified and subscription activated" });
        } else {
            // Update transaction to failed
            await Transaction.findOneAndUpdate(
                { orderId: razorpay_order_id },
                { status: 'failed' }
            );
            return res.status(400).json({ message: "Invalid signature" });
        }
    } catch (error) {
        console.error('Verification Error:', error);
        res.status(500).json({ message: 'Verification failed' });
    }
});

// @desc    Razorpay Webhook for async updates
// @route   POST /api/payments/webhook
// @access  Public
router.post('/webhook', async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(req.body))
        .digest('hex');

    if (signature === expectedSignature) {
        const event = req.body.event;
        const payload = req.body.payload.payment.entity;

        if (event === 'payment.captured') {
            const transaction = await Transaction.findOneAndUpdate(
                { orderId: payload.order_id },
                {
                    paymentId: payload.id,
                    status: 'captured'
                },
                { new: true }
            );

            if (transaction) {
                await activateSubscription(transaction.userId, transaction.planName, payload.order_id, payload.id);
            }
        } else if (event === 'payment.failed') {
            await Transaction.findOneAndUpdate(
                { orderId: payload.order_id },
                { status: 'failed' }
            );
        }

        res.status(200).json({ status: 'ok' });
    } else {
        res.status(400).json({ status: 'invalid signature' });
    }
});

// @desc    Get current user's payment history
// @route   GET /api/payments/history
// @access  Private
router.get('/history', protect, async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user.uid })
            .sort({ createdAt: -1 })
            .limit(20);

        res.status(200).json({
            success: true,
            data: transactions
        });
    } catch (error) {
        console.error('Fetch payment history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment history'
        });
    }
});

module.exports = router;
