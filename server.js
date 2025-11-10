const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require('path');

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use(require('./middleware/logger'));

// Connect MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB atlas connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// Startup config checks (non-fatal)
(() => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    console.warn('[startup] ⚠️ Razorpay keys missing. Payment endpoints will return configured:false');
  } else {
    const shortKey = keyId.length > 6 ? keyId.substring(0, 6) + '***' : keyId;
    console.log(`[startup] ✅ Razorpay keys detected (key: ${shortKey})`);
  }
})();

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/user", require("./routes/userDataRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/sales", require("./routes/salesRoutes"));

// Simple health endpoint for mobile diagnostics
app.get('/api/health', (req, res) => {
  res.json({ ok: true, ts: Date.now(), env: process.env.NODE_ENV || 'development' });
});

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get("/sample", (req, res) => {
  res.send("🚀 Backend is running...");
  console.log("connected");
});

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
