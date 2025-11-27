const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('Please set MONGO_URI environment variable before running this script.');
    process.exit(2);
  }

  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    await client.connect();
    const db = client.db();
    const products = db.collection('products');

    // Get distinct image values and sort
    const images = await products.distinct('image');
    images.sort();

    console.log(JSON.stringify({ ok: true, count: images.length, images }, null, 2));
  } catch (err) {
    console.error('Error fetching product images:', err);
    process.exit(3);
  } finally {
    await client.close();
  }
}

main();
