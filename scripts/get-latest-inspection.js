require('dotenv').config();
const mongoose = require('mongoose');
const Inspection = require('../models/Inspection');

const uri = process.env.MONGO_URI || process.env.DATABASE_URL || '';
if (!uri) {
  console.error('MONGO_URI not set. Set it in .env or export env var.');
  process.exit(1);
}

async function run() {
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  const doc = await Inspection.findOne().sort({ created_at: -1 }).lean();
  if (!doc) {
    console.log('No inspection documents found');
  } else {
    console.log('Latest inspection:');
    console.log(JSON.stringify(doc, null, 2));
  }
  await mongoose.connection.close();
}

run().catch((err) => {
  console.error('Error fetching latest inspection:', err && err.message ? err.message : err);
  process.exit(1);
});
