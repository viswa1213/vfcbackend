/*
  One-off migration script: upload existing /uploads files to S3 and update DB records.
  Usage: set AWS env vars and MONGO_URI, then run:
    node scripts/migrate_uploads_to_s3.js
*/
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const Product = require('../models/product');
const User = require('../models/user');

async function main() {
  if (!process.env.AWS_S3_BUCKET) {
    console.error('AWS_S3_BUCKET not set. Aborting.');
    process.exit(1);
  }
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not set. Aborting.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const s3 = new S3Client({ region: process.env.AWS_REGION });
  const bucket = process.env.AWS_S3_BUCKET;
  const publicBase = process.env.S3_BASE_URL || `https://${bucket}.s3.${process.env.AWS_S3_REGION || process.env.AWS_REGION}.amazonaws.com`;

  // Helper to upload a file path to S3 and return public URL
  async function uploadFile(filePath, key) {
    const body = fs.readFileSync(filePath);
    const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ACL: process.env.AWS_S3_ACL || 'public-read' });
    await s3.send(cmd);
    return `${publicBase}/${key}`;
  }

  // Migrate products
  const products = await Product.find({}).exec();
  for (const p of products) {
    if (p.image && typeof p.image === 'string') {
      const img = p.image.trim();
      if (img.startsWith('/uploads') || img.includes('/uploads/')) {
        // compute local path
        const localPath = path.join(__dirname, '..', img.replace(/^\//, ''));
        if (fs.existsSync(localPath)) {
          try {
            const ext = path.extname(localPath) || '.jpg';
            const key = `products/migrated_prod_${p._id.toString()}_${Date.now()}${ext}`;
            const url = await uploadFile(localPath, key);
            p.image = url;
            await p.save();
            console.log('Migrated product image', p._id.toString());
          } catch (e) {
            console.error('Failed product upload', p._id.toString(), e.message);
          }
        }
      }
    }
  }

  // Migrate user avatars
  const users = await User.find({}).exec();
  for (const u of users) {
    if (u.avatarUrl && typeof u.avatarUrl === 'string') {
      const img = u.avatarUrl.trim();
      if (img.startsWith('/uploads') || img.includes('/uploads/')) {
        const localPath = path.join(__dirname, '..', img.replace(/^\//, ''));
        if (fs.existsSync(localPath)) {
          try {
            const ext = path.extname(localPath) || '.jpg';
            const key = `avatars/migrated_avatar_${u._id.toString()}_${Date.now()}${ext}`;
            const url = await uploadFile(localPath, key);
            u.avatarUrl = url;
            await u.save();
            console.log('Migrated user avatar', u._id.toString());
          } catch (e) {
            console.error('Failed avatar upload', u._id.toString(), e.message);
          }
        }
      }
    }
  }

  console.log('Migration complete');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
