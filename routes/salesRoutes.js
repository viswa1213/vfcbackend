const express = require('express');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/admin');
const Sale = require('../models/sale');

const router = express.Router();

// Create a sale record (any authenticated user can record a sale)
router.post('/', auth, async (req, res) => {
  try {
    const body = req.body || {};
    const sale = new Sale({
      items: Array.isArray(body.items) ? body.items : [],
      subtotal: body.subtotal || 0,
      tax: body.tax || 0,
      taxRate: body.taxRate || 0,
      total: body.total || 0,
      source: body.source || 'admin',
      orderRef: body.orderRef,
      createdBy: req.user?._id,
      note: body.note,
      meta: body.meta || {},
    });
    await sale.save();
    return res.status(201).json({ id: sale._id.toString() });
  } catch (e) {
    console.error('[POST /api/sales] error:', e?.message || e);
    return res.status(400).json({ message: 'Failed to save sale', error: e?.message });
  }
});

// Admin: list sales (newest first)
router.get('/', auth, isAdmin, async (req, res) => {
  try {
    const sales = await Sale.find({}).sort({ createdAt: -1 });
    const data = sales.map((s) => ({ id: s._id.toString(), items: s.items, subtotal: s.subtotal, tax: s.tax, total: s.total, createdAt: s.createdAt }));
    return res.json({ sales: data });
  } catch (e) {
    console.error('[GET /api/sales] error:', e?.message || e);
    return res.status(500).json({ message: 'Failed to fetch sales' });
  }
});

module.exports = router;
