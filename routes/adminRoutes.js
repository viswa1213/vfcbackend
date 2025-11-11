const express = require('express');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/admin');
const Product = require('../models/product');
const Order = require('../models/order');
const User = require('../models/user');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// Optional S3 support; require lazily below so server can start without the SDK installed

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `prod_${Date.now()}${ext}`);
  }
});
// S3 support if configured (will require SDK lazily)
const useS3 = Boolean(process.env.AWS_S3_BUCKET && process.env.AWS_REGION);
const upload = multer({ storage: useS3 ? multer.memoryStorage() : storage });

let s3Client = null;
let S3ClientClass, PutObjectCommandClass, DeleteObjectCommandClass;
if (useS3) {
  try {
    ({ S3Client: S3ClientClass, PutObjectCommand: PutObjectCommandClass, DeleteObjectCommand: DeleteObjectCommandClass } = require('@aws-sdk/client-s3'));
    s3Client = new S3ClientClass({ region: process.env.AWS_REGION });
  } catch (err) {
    console.warn('AWS S3 SDK not installed or failed to load; falling back to disk uploads.');
    s3Client = null;
  }
}

const router = express.Router();

// Admin health
router.get('/ping', auth, isAdmin, (req, res) => res.json({ ok: true }));

// Dashboard summary counts
router.get('/summary', auth, isAdmin, async (req, res) => {
  const [productCount, orderCount, activeUserCount] = await Promise.all([
    Product.countDocuments({}),
    Order.countDocuments({}),
    User.countDocuments({ active: true }),
  ]);
  res.json({
    products: productCount,
    orders: orderCount,
    activeUsers: activeUserCount,
  });
});

// PRODUCTS CRUD
router.get('/products', auth, isAdmin, async (req, res) => {
  const { category } = req.query;
  const filter = {};
  if (category) filter.category = category;
  const products = await Product.find(filter).sort({ createdAt: -1 });
  res.json({ products });
});

router.post('/products', auth, isAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const p = new Product(body);
    await p.save();
    res.status(201).json({ id: p._id.toString(), product: p });
  } catch (e) {
    res.status(400).json({ message: 'Invalid product payload', error: e?.message });
  }
});

// Upload/replace product image
router.post('/products/:id/image', auth, isAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
    const id = req.params.id;
    const p = await Product.findById(id);
    if (!p) return res.status(404).json({ message: 'Product not found' });

    const previous = p.image;

    if (useS3 && req.file.buffer) {
      const ext = path.extname(req.file.originalname) || '';
      const key = `products/prod_${Date.now()}${ext}`;
      const bucket = process.env.AWS_S3_BUCKET;
      const put = new PutObjectCommandClass({
        Bucket: bucket,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype || 'application/octet-stream',
        ACL: process.env.AWS_S3_ACL || 'public-read',
      });
      await s3Client.send(put);

      let publicUrl = process.env.S3_BASE_URL;
      if (!publicUrl) publicUrl = `https://${bucket}.s3.${process.env.AWS_S3_REGION || process.env.AWS_REGION}.amazonaws.com`;
      p.image = `${publicUrl}/${key}`;
      await p.save();

      // delete previous from S3 if applicable
      if (previous && typeof previous === 'string') {
        try {
          if (previous.includes(bucket) || (process.env.S3_BASE_URL && previous.startsWith(process.env.S3_BASE_URL))) {
            const parsed = new URL(previous);
            const prevKey = parsed.pathname.replace(/^\//, '');
            const del = new DeleteObjectCommandClass({ Bucket: bucket, Key: prevKey });
            await s3Client.send(del);
          }
        } catch (err) {}
      }

      return res.json({ product: p });
    }

    // fallback to disk storage
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    p.image = `${baseUrl}/uploads/${req.file.filename}`;
    await p.save();

    // remove previous local file if present
    if (previous && typeof previous === 'string' && previous.startsWith('/uploads')) {
      const previousPath = path.join(__dirname, '..', previous.replace(/^\//, ''));
      fs.unlink(previousPath, () => {});
    }

    return res.json({ product: p });
  } catch (e) {
    res.status(400).json({ message: 'Image upload failed', error: e?.message });
  }
});

router.put('/products/:id', auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const p = await Product.findByIdAndUpdate(id, body, { new: true });
    if (!p) return res.status(404).json({ message: 'Product not found' });
    res.json({ product: p });
  } catch (e) {
    res.status(400).json({ message: 'Update failed', error: e?.message });
  }
});

router.delete('/products/:id', auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await Product.findByIdAndDelete(id);
    if (!r) return res.status(404).json({ message: 'Product not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ message: 'Delete failed', error: e?.message });
  }
});

// ORDERS: list all
router.get('/orders', auth, isAdmin, async (req, res) => {
  const orders = await Order.find({}).populate('user', 'name email').sort({ createdAt: -1 });
  const data = orders.map((o) => ({
    id: o._id.toString(),
    user: { id: o.user?._id?.toString(), name: o.user?.name, email: o.user?.email },
    createdAt: o.createdAt,
    items: o.items,
    pricing: o.pricing,
    deliverySlot: o.deliverySlot,
    payment: o.payment,
    address: o.address,
    status: o.status,
  }));
  res.json({ orders: data });
});

// Update order status
router.patch('/orders/:id/status', auth, isAdmin, async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!['processing', 'shipped', 'delivered'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('user', 'name email');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json({ id: order._id.toString(), status: order.status });
  } catch (e) {
    res.status(400).json({ message: 'Failed to update status', error: e?.message });
  }
});

// USERS: list + details
router.get('/users', auth, isAdmin, async (req, res) => {
  const users = await User.find({}).select('-password').sort({ createdAt: -1 });
  res.json({ users });
});

router.get('/users/:id', auth, isAdmin, async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  const orders = await Order.find({ user: user._id }).sort({ createdAt: -1 });
  res.json({ user, orders });
});

// Update user role
router.patch('/users/:id/role', auth, isAdmin, async (req, res) => {
  try {
    const { role } = req.body || {};
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, projection: '-password' }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (e) {
    res.status(400).json({ message: 'Failed to update role', error: e?.message });
  }
});

module.exports = router;
