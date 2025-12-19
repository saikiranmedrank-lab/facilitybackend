// Test DB connection helper
// Usage: set MONGO_URI=your_uri && node scripts/test-db-connection.js
require('dotenv').config()
const mongoose = require('mongoose')

const uri = "mongodb+srv://sai:f9u6fEk1N0XCBb0Q@cluster0.5hui06i.mongodb.net/?appName=Cluster0"

if(!uri){
  console.error('No MONGO_URI or DATABASE_URL environment variable found.')
  console.error('Set MONGO_URI and try again. Example:')
  console.error('  $env:MONGO_URI="mongodb://user:pass@localhost:27017/medirank"')
  process.exit(1)
}

console.log('Testing MongoDB connection to:', uri)

const opts = { useNewUrlParser: true, useUnifiedTopology: true, serverSelectionTimeoutMS: 5000 }

(async ()=>{
  try{
    await mongoose.connect(uri, opts)
    console.log('Connected to MongoDB successfully')
    await mongoose.connection.close()
    process.exit(0)
  }catch(err){
    console.error('Failed to connect to MongoDB:')
    console.error(err && err.message ? err.message : err)
    if(err && err.reason) console.error('Reason:', err.reason)
    process.exit(2)
  }
})()
