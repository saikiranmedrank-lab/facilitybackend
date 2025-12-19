require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGO_URI || process.env.DATABASE_URL;
if (!uri) {
  console.error('MONGO_URI is not set in .env');
  process.exit(1);
}

console.log('Attempting to connect to MongoDB...');

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
})
  .then(() => {
    console.log('Connected to MongoDB successfully');
    return mongoose.connection.close();
  })
  .catch((err) => {
    console.error('MongoDB connection failed:');
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
