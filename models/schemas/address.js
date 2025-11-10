const mongoose = require('mongoose');

// Shared embedded address schema used by User and Order models.
// Keep minimal validation (all optional) to avoid rejects from partial forms; enhance later if needed.
const addressSchema = new mongoose.Schema(
  {
    // Make formerly required fields optional so user can register before providing address details.
    name: { type: String },
    phone: {
      type: String,
      match: [/^\d{10,15}$/u, 'Phone must be 10-15 digits'],
    },
    address: { type: String },
    landmark: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: {
      type: String,
      match: [/^\d{6}$/u, 'Pincode must be 6 digits'],
    },
    type: { type: String },
    default: { type: Boolean, default: false }, // only meaningful for User
  },
  { _id: false }
);

module.exports = addressSchema;
