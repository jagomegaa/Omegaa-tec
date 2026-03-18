// backend/routes/payment.js
const Razorpay = require('razorpay');
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const crypto = require('crypto');
const Order = require('../models/Order');

// Keys must come from environment variables (never hard-code secrets).
const RAZORPAY_KEY_ID = (process.env.RAZORPAY_KEY_ID || '').trim();
const RAZORPAY_KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || '').trim();

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.warn('Razorpay keys are not set in environment. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
}

function getRazorpayClient() {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    // Fail fast with a clear error instead of making a confusing API call.
    const e = new Error('Razorpay is not configured (missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET)');
    e.statusCode = 500;
    throw e;
  }

  return new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
}

// Create payment order - requires authentication
router.post('/create-order', auth, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const options = {
      amount: Math.round(Number(amount) * 100), // convert INR to paise
      currency: 'INR',
      payment_capture: 1
    };

    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create(options);
    // return the raw Razorpay order object (id, amount, currency etc.)
    res.json(order);
  } catch (err) {
    // Razorpay SDK errors often contain useful fields like:
    // err.statusCode, err.error (object), err.message
    const status = err?.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const razorpayError = err?.error;

    console.error('Create Razorpay order error:', {
      statusCode: err?.statusCode,
      message: err?.message,
      error: razorpayError,
    });

    // Don't leak sensitive details, but return enough to diagnose misconfig.
    res.status(status).json({
      error: 'Failed to create order',
      details: razorpayError?.description || err?.message || 'Unknown error',
    });
  }
});

// Verify payment signature - requires authentication
router.post('/verify-signature', auth, async (req, res) => {
  try {
    // Ensure keys are present (secret required for HMAC)
    getRazorpayClient();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing required signature fields' });
    }

    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest('hex');

    if (razorpay_signature === expectedSign) {
      // Payment verified. Note: frontend currently saves the order after verification,
      // so there may not be an existing Order document to update. If you create the
      // Order on server before payment, you can update it here by matching razorpay_order_id.
      try {
        const order = await Order.findOne({ 'payment.razorpay_order_id': razorpay_order_id });
        if (order) {
          order.paymentStatus = 'paid';
          order.payment = order.payment || {};
          order.payment.razorpay_payment_id = razorpay_payment_id;
          order.payment.razorpay_signature = razorpay_signature;
          await order.save();
        }
      } catch (updateErr) {
        console.warn('Payment verified but failed to update existing order:', updateErr);
      }

      return res.json({ success: true, message: 'Payment verified successfully' });
    }

    return res.status(400).json({ success: false, message: 'Payment verification failed' });
  } catch (err) {
    console.error('Verify signature error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
