/*
  One-off script to replace emulator host (10.0.2.2) URLs in DB records
  with your Render BASE_URL.

  Usage:
    # Ensure .env has MONGO_URI, or pass env vars inline:
    MONGO_URI="<your-mongo-uri>" BASE_URL="https://vfcbackend.onrender.com" node scripts/replace_emulator_urls.js

  Steps to run safely:
    1) Backup DB (mongodump or atlas snapshot)
    2) Run this script
    3) Verify a few documents
*/

const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('../models/product');
const User = require('../models/user');
const Order = require('../models/order');

const FROM = process.env.FROM_URL || 'http://10.0.2.2:5001';
const TO = process.env.BASE_URL || 'https://vfcbackend.onrender.com';

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not set. Set it in .env or pass as env var.');
    process.exit(1);
  }

  console.log('Connecting to', uri);
  await mongoose.connect(uri, { connectTimeoutMS: 10000 });
  console.log('Connected to MongoDB');

  // Products
  const products = await Product.find({ image: new RegExp(FROM) }).exec();
  console.log('Products to update:', products.length);
  for (const p of products) {
    const old = p.image;
    p.image = p.image.replace(FROM, TO);
    await p.save();
    console.log(`Updated product ${p._id}: ${old} -> ${p.image}`);
  }

  // Users (avatar)
  const users = await User.find({ avatarUrl: new RegExp(FROM) }).exec();
  console.log('Users to update:', users.length);
  for (const u of users) {
    const old = u.avatarUrl;
    u.avatarUrl = u.avatarUrl.replace(FROM, TO);
    await u.save();
    console.log(`Updated user ${u._id}: ${old} -> ${u.avatarUrl}`);
  }

  // Orders: update any item image fields that contain FROM
  const orders = await Order.find({ 'items.image': new RegExp(FROM) }).exec();
  console.log('Orders to update:', orders.length);
  for (const o of orders) {
    let changed = false;
    for (const item of o.items) {
      if (item.image && typeof item.image === 'string' && item.image.includes(FROM)) {
        const old = item.image;
        item.image = item.image.replace(FROM, TO);
        console.log(`Order ${o._id} item image: ${old} -> ${item.image}`);
        changed = true;
      }
    }
    if (changed) {
      await o.save();
    }
  }

  console.log('Done. Disconnecting...');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
