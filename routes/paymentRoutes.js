const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const Subscription = require('../models/Subscription');
const PromoCode = require('../models/PromoCode');
const { protect } = require('../middleware/authMiddleware');

// Fallback to hardcoded keys if .env is not loaded (Hostinger workaround)
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_live_SP7aooyeXdBQDV';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'DmUuxwqject1pEO3bfaYIHry';

const razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET
});

// Helper function to activate subscription
const activateSubscription = async (userId, planName, orderId, paymentId, amountPaid = 0, currency = 'INR') => {
    let sessions = 1; // Default to 1
    let months = 2; // User requested 2 months expiry for all packages

    // Logic for different plans based on frontend copy
    if (planName.includes('Drop-In')) {
        sessions = 1;
    } else if (planName.includes('Family of 2')) {
        sessions = 24;
    } else if (planName.includes('Family of 3')) {
        sessions = 32;
    } else if (planName.includes('Family of 4')) {
        sessions = 40;
    } else if (planName.includes('4-Week Journey')) {
        sessions = 8;
    } else if (planName.includes('Deep Foundation')) {
        sessions = 12;
    } else if (planName.includes('Transformation')) {
        sessions = 16;
    } else if (planName.includes('Total Immersion')) {
        sessions = 20;
    } else {
        // Extract number from packs like "10 Class Pack (Group)" or "Premium 12-Session Pack"
        const match = planName.match(/(\d+)\s*[- ]*(Class|Session)/i);
        if (match) {
            sessions = parseInt(match[1], 10);
        } else {
            // Fallback for older plan names
            if (planName.includes('Personal')) sessions = 12;
            else if (planName.includes('Family')) sessions = 24;
            else if (planName.includes('Immersive')) { sessions = 32; }
        }
    }

    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + months);

    await Subscription.upsert({
        userId,
        planName,
        status: 'active',
        totalSessions: sessions,
        sessionsUsed: 0,
        amountPaid: amountPaid,
        currency: currency,
        startDate,
        expiryDate,
        lastPaymentId: paymentId,
        lastOrderId: orderId
    });
};

// @desc    Apply Promo Code
// @route   POST /api/payments/apply-promo
// @access  Private
router.post('/apply-promo', protect, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ success: false, message: 'Promo code is required' });
        }

        const upperCode = code.toUpperCase();

        // EASY WAY: Hardcoded Promo Code Bypass
        if (upperCode === 'YOSA100') {
            return res.status(200).json({
                success: true,
                discountPercentage: 100,
                code: 'YOSA100'
            });
        }

        const promo = await PromoCode.findOne({ where: { code: upperCode } });

        if (!promo || !promo.isActive) {
            return res.status(404).json({ success: false, message: 'Invalid or inactive promo code' });
        }

        if (promo.currentUses >= promo.maxUses) {
            return res.status(400).json({ success: false, message: 'Promo code usage limit reached' });
        }

        res.status(200).json({
            success: true,
            discountPercentage: promo.discountPercentage,
            code: promo.code
        });

    } catch (error) {
        console.error('Apply Promo Error:', error);
        res.status(500).json({ success: false, message: 'Failed to apply promo code' });
    }
});

// @desc    Create Razorpay Order
// @route   POST /api/payments/create-order
// @access  Private
router.post('/create-order', protect, async (req, res) => {
    try {
        const { amount, planName, currency = 'INR', promoCode } = req.body;
        const userId = req.user.uid;

        // If amount is 0, it means a 100% discount promo was applied
        if (amount === 0 && promoCode) {
            const upperCode = promoCode.toUpperCase();
            
            // EASY WAY: Hardcoded Promo Code Bypass for checkout
            if (upperCode === 'YOSA100') {
                // Generate fake order and payment IDs for free order
                const fakeOrderId = `order_free_${Date.now()}`;
                const fakePaymentId = `pay_free_${Date.now()}`;

                // Save completed transaction
                await Transaction.create({
                    userId,
                    orderId: fakeOrderId,
                    paymentId: fakePaymentId,
                    planName,
                    amount: 0,
                    currency,
                    status: 'captured'
                });

                // Activate subscription
                await activateSubscription(userId, planName, fakeOrderId, fakePaymentId, 0, currency);

                return res.status(200).json({
                    success: true,
                    isFreeCheckout: true,
                    message: 'Subscription activated directly via promo code'
                });
            }

            const promo = await PromoCode.findOne({ where: { code: upperCode, isActive: true } });
            
            if (!promo || promo.currentUses >= promo.maxUses) {
                return res.status(400).json({ success: false, message: 'Invalid or expired promo code' });
            }

            // Increment promo usage
            await promo.increment('currentUses');

            // Generate fake order and payment IDs for free order
            const fakeOrderId = `order_free_${Date.now()}`;
            const fakePaymentId = `pay_free_${Date.now()}`;

            // Save completed transaction
            await Transaction.create({
                userId,
                orderId: fakeOrderId,
                paymentId: fakePaymentId,
                planName,
                amount: 0,
                currency,
                status: 'captured'
            });

            // Activate subscription
            await activateSubscription(userId, planName, fakeOrderId, fakePaymentId, 0, currency);

            return res.status(200).json({
                success: true,
                isFreeCheckout: true,
                message: 'Subscription activated directly via promo code'
            });
        }

        const options = {
            amount: amount * 100,
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
        res.status(500).json({
            message: 'Failed to create order',
            detail: error.message,
            code: error.statusCode || error.code || 'UNKNOWN'
        });
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
            .createHmac("sha256", RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            // Update transaction
            const [updatedRows, [transaction]] = await Transaction.update(
                {
                    paymentId: razorpay_payment_id,
                    signature: razorpay_signature,
                    status: 'captured'
                },
                {
                    where: { orderId: razorpay_order_id },
                    returning: true
                }
            );

            if (transaction) {
                await activateSubscription(transaction.userId, transaction.planName, razorpay_order_id, razorpay_payment_id, transaction.amount, transaction.currency);
            }

            return res.status(200).json({ message: "Payment verified and subscription activated" });
        } else {
            // Update transaction to failed
            await Transaction.update(
                { status: 'failed' },
                { where: { orderId: razorpay_order_id } }
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

    // req.body is a Buffer when using express.raw()
    const rawBody = req.body;

    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

    if (signature === expectedSignature) {
        const payload = JSON.parse(rawBody.toString());
        const event = payload.event;
        const entity = payload.payload.payment.entity;

        if (event === 'payment.captured') {
            const [updatedRows, [transaction]] = await Transaction.update(
                {
                    paymentId: entity.id,
                    status: 'captured'
                },
                {
                    where: { orderId: entity.order_id },
                    returning: true
                }
            );

            if (transaction) {
                await activateSubscription(transaction.userId, transaction.planName, entity.order_id, entity.id, transaction.amount, transaction.currency);
            }
        } else if (event === 'payment.failed') {
            await Transaction.update(
                { status: 'failed' },
                { where: { orderId: entity.order_id } }
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
        const transactions = await Transaction.findAll({
            where: { userId: req.user.uid },
            order: [['createdAt', 'DESC']],
            limit: 20
        });

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
