const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
  try {
    console.log("Register request received:", req.body);
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please provide name, email and password" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log("Registration failed: user exists:", email);
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Auto-assign admin role if email is listed in env ADMIN_EMAILS
    const admins = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const role = admins.includes(email.toLowerCase()) ? 'admin' : 'user';

    const user = new User({ name, email, password: hashedPassword, role });
    await user.save();

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET missing. Set it in .env to secure tokens.");
      // Provide a clear message in non-production environments
      return res.status(500).json({
        message: "Server config error: JWT secret missing",
        code: "CONFIG_JWT_SECRET_MISSING",
      });
    }

    const token = jwt.sign({ id: user._id }, secret, { expiresIn: "7d" });

    console.log("User registered:", user.email);
    return res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    // Handle duplicate key race (should be rare due to prior check)
    if (error && error.code === 11000) {
      console.warn("Duplicate registration race condition for:", req.body.email);
      return res.status(400).json({ message: "User already exists", code: "USER_EXISTS" });
    }
    // Mongoose validation mapping
    if (error && error.name === 'ValidationError' && error.errors) {
      const details = Object.fromEntries(
        Object.entries(error.errors).map(([k, v]) => [k, v.message])
      );
      console.warn('Validation failed for register:', details);
      return res.status(400).json({ message: 'Validation failed', code: 'VALIDATION_ERROR', details });
    }
    console.error("Registration error:", error);
    return res.status(500).json({ message: "Server error", code: "REGISTER_FAILED" });
  }
};

exports.login = async (req, res) => {
  try {
    console.log("Login request received:", req.body);
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ message: "Please provide email and password" });

    const user = await User.findOne({ email });
    if (!user) {
      console.log("Login failed: user not found:", email);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("Login failed: invalid password for:", email);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET missing. Login cannot generate token.");
      return res.status(500).json({
        message: "Server config error: JWT secret missing",
        code: "CONFIG_JWT_SECRET_MISSING",
      });
    }
    const token = jwt.sign({ id: user._id }, secret, { expiresIn: "7d" });

    console.log("User logged in:", email);
    // Include role, compute from stored role (and update if env changed)
    const admins = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const shouldBeAdmin = admins.includes(user.email.toLowerCase());
    if (shouldBeAdmin && user.role !== 'admin') {
      user.role = 'admin';
      await user.save();
    }
    return res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error", code: "LOGIN_FAILED" });
  }
};
