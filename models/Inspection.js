const mongoose = require('mongoose')

const ItemSchema = new mongoose.Schema({
  item_number: Number,
  item_text: String,
  response: { type: String, default: 'na' },
  location_action: String,
  action_date: String,
  // allow attachments per item: can be a URL string or an object with { url, key, type, name }
  photo: mongoose.Schema.Types.Mixed,
  doc: mongoose.Schema.Types.Mixed,
}, { _id: false })

const InspectionSchema = new mongoose.Schema({
  inspection_date: { type: String },
  inspector_name: { type: String, required: true },
  inspector_email: String,
  comments: String,
  status: { type: String, default: 'draft' },
  items: [ItemSchema],
  images: [{ url: String, key: String }], // array of S3 objects
  inspector_selfie: {
    // allow either a string URL or an object with { url, key, type }
    type: mongoose.Schema.Types.Mixed,
  },
  inspector_signature: mongoose.Schema.Types.Mixed,
  geo_location: {
    lat: Number,
    lng: Number,
    accuracy: Number,
    timestamp: String,
  },
  hospital: {
    name: String,
    address: String,
    logo: mongoose.Schema.Types.Mixed,
    // Allow hospital images to be either simple URL strings or richer objects
    // (e.g. { name, url, type, size, storage, savedAt }). Use Mixed to be flexible.
    images: [mongoose.Schema.Types.Mixed],
  },
  created_at: { type: Date, default: Date.now }
})

module.exports = mongoose.model('Inspection', InspectionSchema)
