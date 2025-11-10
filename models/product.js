const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  price: { type: Number, required: true, min: 0 },
  unit: { type: String, default: 'kg', trim: true },
  stock: { type: Number, default: 0, min: 0 },
  image: { type: String }, // could be URL or asset key
  description: { type: String },
  active: { type: Boolean, default: true },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  discount: { type: Number, default: 0, min: 0, max: 100 },
  sold: { type: Number, default: 0, min: 0 },
  addedAt: { type: Date, default: Date.now },
  isFeatured: { type: Boolean, default: false },
  defaultMeasure: { type: Number, default: 1, min: 0 },
}, { timestamps: true });

module.exports = mongoose.model('product', productSchema);
