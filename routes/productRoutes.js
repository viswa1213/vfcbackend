const express = require('express');
const Product = require('../models/product');

const router = express.Router();

// Public products catalogue
router.get('/', async (req, res) => {
  try {
    const { category, search, limit, sort } = req.query;
    const filter = { active: true };
    if (category) {
      filter.category = category;
    }
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    let query = Product.find(filter);

    switch (sort) {
      case 'price_asc':
        query = query.sort({ price: 1 });
        break;
      case 'price_desc':
        query = query.sort({ price: -1 });
        break;
      case 'newest':
        query = query.sort({ createdAt: -1 });
        break;
      case 'oldest':
        query = query.sort({ createdAt: 1 });
        break;
      default:
        query = query.sort({ createdAt: -1 });
    }

    const capped = Math.min(parseInt(limit, 10) || 0, 200);
    if (capped > 0) {
      query = query.limit(capped);
    }

    const products = await query.exec();
    res.json({ products });
  } catch (e) {
    res.status(500).json({
      message: 'Failed to fetch products',
      error: e?.message,
    });
  }
});

// Get trending products (based on sold count and rating)
router.get('/trending', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 20);
    const products = await Product.find({ active: true })
      .sort({ sold: -1, rating: -1 })
      .limit(limit)
      .exec();
    res.json({ products });
  } catch (e) {
    res.status(500).json({
      message: 'Failed to fetch trending products',
      error: e?.message,
    });
  }
});

// Get special offers (products with discount > 0)
router.get('/offers', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 20);
    const products = await Product.find({ 
      active: true, 
      discount: { $gt: 0 } 
    })
      .sort({ discount: -1, createdAt: -1 })
      .limit(limit)
      .exec();
    res.json({ products });
  } catch (e) {
    res.status(500).json({
      message: 'Failed to fetch offers',
      error: e?.message,
    });
  }
});

// Get featured products
router.get('/featured', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 20);
    const products = await Product.find({ 
      active: true, 
      isFeatured: true 
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
    res.json({ products });
  } catch (e) {
    res.status(500).json({
      message: 'Failed to fetch featured products',
      error: e?.message,
    });
  }
});

// Get product statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const [
      totalProducts,
      featuredCount,
      onSaleCount,
      avgRating,
      totalSold,
    ] = await Promise.all([
      Product.countDocuments({ active: true }),
      Product.countDocuments({ active: true, isFeatured: true }),
      Product.countDocuments({ active: true, discount: { $gt: 0 } }),
      Product.aggregate([
        { $match: { active: true } },
        { $group: { _id: null, avgRating: { $avg: '$rating' } } },
      ]),
      Product.aggregate([
        { $match: { active: true } },
        { $group: { _id: null, totalSold: { $sum: '$sold' } } },
      ]),
    ]);

    res.json({
      totalProducts,
      featuredCount,
      onSaleCount,
      avgRating: avgRating[0]?.avgRating || 0,
      totalSold: totalSold[0]?.totalSold || 0,
    });
  } catch (e) {
    res.status(500).json({
      message: 'Failed to fetch statistics',
      error: e?.message,
    });
  }
});

// Individual product lookup
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || product.active === false) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ product });
  } catch (e) {
    res.status(400).json({
      message: 'Invalid product id',
      error: e?.message,
    });
  }
});

module.exports = router;
