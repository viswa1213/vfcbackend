const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'product', required: false },
    name: String,
    price: Number,
    quantity: { type: Number, default: 1 },
    lineTotal: Number,
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    items: { type: [saleItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    source: { type: String, enum: ['order', 'admin', 'other'], default: 'order' },
    orderRef: { type: mongoose.Schema.Types.ObjectId, ref: 'order' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    note: String,
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model('sale', saleSchema);
