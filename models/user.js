const mongoose = require("mongoose");
const addressSchema = require("./schemas/address");

const cartItemSchema = new mongoose.Schema(
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

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    // Top-level phone added so profile can store primary mobile separate from address.phone
  phone: { type: String, match: [/^\d{10,15}$/u, 'Phone must be 10-15 digits'] },
  avatarUrl: { type: String },
    // Simple role-based access control: 'user' | 'admin'
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    cart: { type: [cartItemSchema], default: [] },
    favorites: { type: [String], default: [] },
  // Don't create an empty address object by default; this can trigger required validations.
  // Instead, set when the user saves their address.
  address: { type: addressSchema, default: undefined },
    settings: {
      themeMode: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
      accentColor: { type: String },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("user", userSchema);
