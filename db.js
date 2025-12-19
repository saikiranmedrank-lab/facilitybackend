const mongoose = require('mongoose')

// Read connection string from environment. Do NOT hardcode credentials in files.
// Set `MONGO_URI` (or `DATABASE_URL`) in your environment or .env file.
const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL || null

if (!MONGO_URI) {
  console.error('No MongoDB connection string found. Please set MONGO_URI in your .env file (do not place credentials in source files).')
  process.exit(1)
}

mongoose.set('strictQuery', true)
// disable default command buffering so failures surface quickly
mongoose.set('bufferCommands', false)

const connectOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  // fail fast if server selection (no reachable mongod) exceeds this (ms)
  serverSelectionTimeoutMS: 5000,
}

mongoose.connect(MONGO_URI, connectOptions)
  .then(()=> console.log('MongoDB connected'))
  .catch(err => {
    console.error('\nMongoDB connection error:')
    console.error(err && err.message ? err.message : err)
    console.error('\nCommon causes:')
    console.error('- invalid MONGO_URI in .env (check username/password, host, replica set)')
    console.error('- using MongoDB Atlas: ensure your IP address is whitelisted or set to 0.0.0.0/0 for testing')
    console.error('- network/VPC rules blocking access')
    process.exit(1)
  })

mongoose.connection.on('connected', ()=> console.log('Mongoose: connected'))
mongoose.connection.on('error', (err)=> console.error('Mongoose connection error', err && err.message))
mongoose.connection.on('disconnected', ()=> console.warn('Mongoose: disconnected'))

module.exports = mongoose
