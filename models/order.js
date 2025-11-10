const mongoose = require('mongoose');
const addressSchema = require('./schemas/address');

const orderItemSchema = new mongoose.Schema(
  {
    name: String,
    price: Number,
    quantity: { type: Number, default: 1 },
    measure: { type: Number, default: 1 },
    unit: { type: String, default: 'kg' },
    image: String,
    lineTotal: Number,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    items: { type: [orderItemSchema], default: [] },
    pricing: {
      subtotal: Number,
      discount: Number,
      deliveryFee: Number,
      total: Number,
      coupon: String,
    },
    deliverySlot: String,
    payment: {
      method: String,
      paymentId: String,
      status: String,
      upiId: String,
      cardLast4: String,
    },
    address: { type: addressSchema, default: {} },
    status: { type: String, enum: ['processing', 'shipped', 'delivered'], default: 'processing' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('order', orderSchema);
