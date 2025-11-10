const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');

const router = express.Router();

let _razorpayInstance = null;
function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    console.warn('[paymentRoutes] RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are not set');
    return null;
  }
  if (!_razorpayInstance) {
    _razorpayInstance = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const shortKey = keyId.length > 6 ? keyId.substring(0, 6) + '***' : keyId;
    console.log(`[paymentRoutes] ✅ Razorpay instance initialized (key: ${shortKey})`);
  }
  return _razorpayInstance;
}

// Create Razorpay Order (amount in paise)
router.post('/razorpay/create-order', async (req, res) => {
  try {
    const instance = getRazorpayInstance();
    if (!instance) {
      return res.status(500).json({ error: 'Razorpay is not configured on the server' });
    }
    const { amount, currency = 'INR', receipt } = req.body || {};
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    const order = await instance.orders.create({ amount, currency, receipt });
    return res.json(order);
  } catch (err) {
    console.error('Razorpay create-order error:', err);
    return res.status(500).json({ error: 'Failed to create order' });
  }
});

// Verify Razorpay signature
router.post('/razorpay/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification fields' });
    }
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return res.status(500).json({ error: 'Razorpay is not configured on the server' });
    }
    const hmac = crypto.createHmac('sha256', keySecret);
    hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
    const expected = hmac.digest('hex');
    const valid = expected === razorpay_signature;
    if (!valid) {
      return res.status(400).json({ valid: false, error: 'Invalid signature' });
    }
    return res.json({ valid: true });
  } catch (err) {
    console.error('Razorpay verify error:', err);
    return res.status(500).json({ error: 'Verification failed' });
  }
});

// Simple health/config status endpoint
router.get('/razorpay/health', (req, res) => {
  const inst = getRazorpayInstance();
  res.json({ configured: !!inst });
});

module.exports = router;
