const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
// Optional S3 support for durable uploads. We will require the SDK lazily
// below so the server can still start if the package isn't installed.
const auth = require('../middleware/auth');
const User = require('../models/user');

const router = express.Router();

const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const userId = req.user?._id?.toString() ?? 'user';
    cb(null, `avatar_${userId}_${Date.now()}${ext}`);
  },
});

// Use S3 memory storage when S3 is configured, otherwise disk storage
const useS3 = Boolean(process.env.AWS_S3_BUCKET && process.env.AWS_REGION);
const avatarUpload = multer({
  storage: useS3 ? multer.memoryStorage() : uploadStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max avatar size
});

let s3Client = null;
if (useS3) {
  s3Client = new S3Client({ region: process.env.AWS_REGION });
}

// Get profile + cart + favorites
router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  res.json({ user });
});

// Update profile basics
router.put('/profile', auth, async (req, res) => {
  const { name, phone } = req.body;
  if (name) req.user.name = name;
  if (phone) req.user.phone = phone;
  try {
    await req.user.save();
    res.json({ ok: true, user: req.user });
  } catch (e) {
    let details;
    if (e && e.errors) {
      details = Object.entries(e.errors).map(([field, err]) => ({
        field,
        kind: err.kind,
        message: err.message,
        value: err.value,
      }));
    }
    return res.status(400).json({
      message: 'Invalid profile payload',
      error: e?.message,
      validation: details,
    });
  }
});

router.post('/avatar', auth, avatarUpload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No avatar uploaded' });

  const previous = req.user.avatarUrl;

  try {
    if (useS3 && req.file.buffer) {
      // Upload to S3
      const ext = path.extname(req.file.originalname) || '';
      const userId = req.user?._id?.toString() ?? 'user';
      const key = `avatars/avatar_${userId}_${Date.now()}${ext}`;
      const bucket = process.env.AWS_S3_BUCKET;
      const contentType = req.file.mimetype || 'application/octet-stream';

      const put = new PutObjectCommandClass({
        Bucket: bucket,
        Key: key,
        Body: req.file.buffer,
        ContentType: contentType,
        ACL: process.env.AWS_S3_ACL || 'public-read',
      });
      await s3Client.send(put);

      // Build public URL
      let publicUrl = process.env.S3_BASE_URL;
      if (!publicUrl) {
        // Default S3 URL pattern
        publicUrl = `https://${bucket}.s3.${process.env.AWS_S3_REGION || process.env.AWS_REGION}.amazonaws.com`;
      }
      const newAvatarUrl = `${publicUrl}/${key}`;
      req.user.avatarUrl = newAvatarUrl;
      await req.user.save();

      // Delete previous S3 object if it belongs to same bucket
      if (previous && typeof previous === 'string') {
        try {
          if (previous.includes(bucket) || (process.env.S3_BASE_URL && previous.startsWith(process.env.S3_BASE_URL))) {
            const parsed = new URL(previous);
            const prevKey = parsed.pathname.replace(/^\//, '');
            const del = new DeleteObjectCommandClass({ Bucket: bucket, Key: prevKey });
            await s3Client.send(del);
          }
        } catch (err) {
          // ignore
        }
      }

      return res.json({ ok: true, avatarUrl: req.user.avatarUrl, user: req.user });
    }

    // Fallback: save to disk (existing behavior)
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const filename = req.file.filename || (req.file.path ? path.basename(req.file.path) : `avatar_${Date.now()}`);
    const newAvatarPath = `${baseUrl}/uploads/${filename}`;

    // If using disk storage multer will already have saved the file
    req.user.avatarUrl = newAvatarPath;
    await req.user.save();

    // remove previous local file if present
    if (previous && typeof previous === 'string') {
      try {
        let prevPathname = null;
        if (previous.startsWith('/uploads/')) {
          prevPathname = previous;
        } else if (previous.startsWith(baseUrl)) {
          const parsed = new URL(previous);
          if (parsed.pathname && parsed.pathname.startsWith('/uploads/')) prevPathname = parsed.pathname;
        }
        if (prevPathname) {
          const previousPath = path.join(__dirname, '..', prevPathname.replace(/^\//, ''));
          fs.unlink(previousPath, () => {});
        }
      } catch (err) {}
    }

    return res.json({ ok: true, avatarUrl: req.user.avatarUrl, user: req.user });
  } catch (e) {
    // If disk path exists, attempt cleanup
    if (req.file && req.file.path) fs.unlink(req.file.path, () => {});
    return res.status(500).json({ message: 'Failed to store avatar', error: e?.message });
  }
});

// Replace cart
router.put('/cart', auth, async (req, res) => {
  const { cart } = req.body;
  if (!Array.isArray(cart)) return res.status(400).json({ message: 'cart must be array' });
  req.user.cart = cart;
  await req.user.save();
  res.json({ ok: true, cart: req.user.cart });
});

// Replace favorites
router.put('/favorites', auth, async (req, res) => {
  const { favorites } = req.body;
  if (!Array.isArray(favorites)) return res.status(400).json({ message: 'favorites must be array' });
  req.user.favorites = favorites;
  await req.user.save();
  res.json({ ok: true, favorites: req.user.favorites });
});

// Update address
router.put('/address', auth, async (req, res) => {
  try {
    req.user.address = req.body.address || {};
    await req.user.save();
    return res.json({ ok: true, address: req.user.address });
  } catch (e) {
    let details;
    if (e && e.errors) {
      details = Object.entries(e.errors).map(([field, err]) => ({
        field,
        kind: err.kind,
        message: err.message,
        value: err.value,
      }));
    }
    return res.status(400).json({
      message: 'Invalid address payload',
      error: e?.message,
      validation: details,
    });
  }
});

// Update settings
router.put('/settings', auth, async (req, res) => {
  req.user.settings = { ...req.user.settings, ...(req.body.settings || {}) };
  await req.user.save();
  res.json({ ok: true, settings: req.user.settings });
});

module.exports = router;
