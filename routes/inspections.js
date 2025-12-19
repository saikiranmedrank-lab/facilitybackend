const express = require('express')
const router = express.Router()
const multer = require('multer')
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const Inspection = require('../models/Inspection')

// multer memory storage
const storage = multer.memoryStorage()
const upload = multer({ storage })

function normalizeHospitalImages(hospital) {
  if (!hospital) return hospital;
  try {
    // if images is a JSON string, parse it
    if (typeof hospital.images === 'string') {
      try {
        hospital.images = JSON.parse(hospital.images);
      } catch (e) {
        // maybe it's a single URL string
        hospital.images = [hospital.images];
      }
    }

    if (Array.isArray(hospital.images)) {
      hospital.images = hospital.images.map((it) => {
        if (typeof it === 'string') return it;
        if (typeof it === 'object' && it !== null) return it;
        try {
          return JSON.parse(String(it));
        } catch (e) {
          return String(it);
        }
      });
    }
  } catch (e) {
    // no-op, keep original
  }
  return hospital;
}

// S3 configuration: read entirely from environment variables.
// Do NOT store AWS credentials or bucket names inline in code.
const S3_BUCKET = process.env.S3_BUCKET || null
const S3_REGION = process.env.AWS_REGION || process.env.S3_REGION || 'ap-south-1'
const S3_KEY_PREFIX = process.env.S3_KEY_PREFIX || ''

const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || null
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || null

let s3Client = null
try {
  const clientConfig = { region: S3_REGION }
  // only attach explicit credentials if both values are provided in env
  if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
    clientConfig.credentials = {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    }
  }
  s3Client = new S3Client(clientConfig)
} catch (err) {
  console.warn('Failed to create S3 client:', err && err.message)
  s3Client = null
}

async function uploadToS3(buffer, filename, contentType) {
  if (!s3Client || !S3_BUCKET) throw new Error('S3 not configured')
  const key = `${S3_KEY_PREFIX}${Date.now()}_${filename}`
  const cmd = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType
  })
  await s3Client.send(cmd)
  // return object with url and key
  const url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`
  return { url, key }
}

function parseDataUrl(dataUrl) {
  // data:[<mediatype>][;base64],<data>
  const match = /^data:(.+?)(;base64)?,(.*)$/.exec(dataUrl)
  if (!match) return null
  const mime = match[1]
  const isBase64 = !!match[2]
  const dataPart = match[3]
  const buffer = isBase64 ? Buffer.from(dataPart, 'base64') : Buffer.from(decodeURIComponent(dataPart), 'utf8')
  return { mime, buffer }
}

// POST /api/inspections (multipart form)
// fields: inspection (JSON string), files: images
router.post('/', upload.array('images', 12), async (req, res) => {
  try {
    const inspectionJson = req.body.inspection
    if (!inspectionJson) return res.status(400).json({ error: 'Missing inspection field' })

    const inspectionData = JSON.parse(inspectionJson)
    // normalize hospital images if they were serialized or in unexpected shape
    if (inspectionData && inspectionData.hospital) inspectionData.hospital = normalizeHospitalImages(inspectionData.hospital)

    const fileUrls = []
    if (req.files && req.files.length) {
        for (const f of req.files) {
          const obj = await uploadToS3(f.buffer, f.originalname, f.mimetype)
          fileUrls.push(obj)
        }
    }

    const doc = new Inspection({
      inspection_date: inspectionData.inspection_date,
      inspector_name: inspectionData.inspector_name,
      inspector_email: inspectionData.inspector_email,
      comments: inspectionData.comments,
      status: inspectionData.status || 'draft',
      items: inspectionData.items || [],
        images: fileUrls,
      geo_location: inspectionData.geo_location || null,
      inspector_selfie: inspectionData.inspector_selfie || null,
      inspector_signature: inspectionData.inspector_signature || null,
      hospital: inspectionData.hospital || null,
    })

    await doc.save()
    res.json({ ok: true, inspection: doc })
  } catch (err) {
    console.error('Error in /api/inspections:', err)
    res.status(500).json({ error: err.message || 'Failed to save inspection' })
  }
})

// POST /api/inspections/json -> accept JSON body (no files)
router.post('/json', async (req, res) => {
  try {
    const inspectionData = req.body;
    if (inspectionData && inspectionData.hospital) inspectionData.hospital = normalizeHospitalImages(inspectionData.hospital)
    if (!inspectionData) return res.status(400).json({ error: 'Missing inspection data' });

    // If inspector_signature is a data URL (client fallback), upload it server-side to S3
    if (inspectionData.inspector_signature && typeof inspectionData.inspector_signature === 'string' && inspectionData.inspector_signature.startsWith('data:')) {
      try {
        const parsed = parseDataUrl(inspectionData.inspector_signature)
        if (parsed) {
          const filename = `signature_${Date.now()}.jpg`
          const fileObj = await uploadToS3(parsed.buffer, filename, parsed.mime)
          inspectionData.inspector_signature = { url: fileObj.url, key: fileObj.key, type: parsed.mime }
        }
      } catch (e) {
        console.error('Failed to upload signature server-side:', e)
        // leave the data URL in place as a fallback
      }
    }

    const doc = new Inspection({
      inspection_date: inspectionData.inspection_date,
      inspector_name: inspectionData.inspector_name,
      inspector_email: inspectionData.inspector_email,
      comments: inspectionData.comments,
      status: inspectionData.status || 'draft',
      items: inspectionData.items || [],
      images: inspectionData.images || [],
      geo_location: inspectionData.geo_location || null,
      inspector_selfie: inspectionData.inspector_selfie || null,
      inspector_signature: inspectionData.inspector_signature || null,
      hospital: inspectionData.hospital || null,
    })

    await doc.save()
    res.json({ ok: true, inspection: doc })
  } catch (err) {
    console.error('Error saving JSON inspection', err)
    res.status(500).json({ error: err.message || 'Failed to save inspection' })
  }
})

// POST /api/upload-url -> get presigned PUT url
router.post('/upload-url', async (req, res) => {
  try {
    const { filename, contentType } = req.body || {};
    if (!filename || !contentType) return res.status(400).json({ error: 'filename and contentType required' });
    if (!s3Client || !S3_BUCKET) return res.status(500).json({ error: 'S3 not configured on server' });

    const key = `${S3_KEY_PREFIX}${Date.now()}_${filename}`;
    const cmd = new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: contentType });
    const uploadUrl = await getSignedUrl(s3Client, cmd, { expiresIn: 900 });
    const fileUrl = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
    res.json({ uploadUrl, fileUrl });
  } catch (err) {
    console.error('Error generating presigned url', err);
    res.status(500).json({ error: 'Failed to generate upload url' });
  }
})

// POST /api/inspections/upload-server -> server-side upload (multipart form)
router.post('/upload-server', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const f = req.file;
    const obj = await uploadToS3(f.buffer, f.originalname || `upload_${Date.now()}`, f.mimetype || 'application/octet-stream');
    res.json({ url: obj.url, key: obj.key });
  } catch (err) {
    console.error('Error in upload-server:', err);
    res.status(500).json({ error: 'Failed to upload file on server' });
  }
});

// PUT /api/inspections/:id -> update existing inspection (partial)
router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const inspectionData = req.body;
    if (!inspectionData) return res.status(400).json({ error: 'Missing inspection data' });

    // If inspector_signature is a data URL (client fallback), upload it server-side to S3
    if (inspectionData.inspector_signature && typeof inspectionData.inspector_signature === 'string' && inspectionData.inspector_signature.startsWith('data:')) {
      try {
        const parsed = parseDataUrl(inspectionData.inspector_signature)
        if (parsed) {
          const filename = `signature_${Date.now()}.jpg`
          const fileObj = await uploadToS3(parsed.buffer, filename, parsed.mime)
          inspectionData.inspector_signature = { url: fileObj.url, key: fileObj.key, type: parsed.mime }
        }
      } catch (e) {
        console.error('Failed to upload signature server-side during update:', e)
      }
    }

    // normalize hospital images if needed
    if (inspectionData && inspectionData.hospital) inspectionData.hospital = normalizeHospitalImages(inspectionData.hospital)

    const update = {
      inspection_date: inspectionData.inspection_date,
      inspector_name: inspectionData.inspector_name,
      inspector_email: inspectionData.inspector_email,
      comments: inspectionData.comments,
      status: inspectionData.status || 'draft',
      items: inspectionData.items || [],
      images: inspectionData.images || [],
      geo_location: inspectionData.geo_location || null,
      inspector_selfie: inspectionData.inspector_selfie || null,
      inspector_signature: inspectionData.inspector_signature || null,
      hospital: inspectionData.hospital || null,
    }

    const doc = await Inspection.findByIdAndUpdate(id, update, { new: true })
    if (!doc) return res.status(404).json({ error: 'Inspection not found' })

    res.json({ ok: true, inspection: doc })
  } catch (err) {
    console.error('Error updating inspection', err)
    res.status(500).json({ error: err.message || 'Failed to update inspection' })
  }
})

// POST /api/presign-get -> get presigned GET url for stored object
router.post('/presign-get', async (req, res) => {
  try {
    const { key, url } = req.body || {};
    if (!s3Client || !S3_BUCKET) return res.status(500).json({ error: 'S3 not configured on server' });

    let objectKey = key;
    if (!objectKey && url) {
      try {
        const parsed = new URL(url);
        // pathname starts with '/', remove leading '/'
        objectKey = parsed.pathname.replace(/^\//, '')
      } catch (e) {
        return res.status(400).json({ error: 'Invalid url' });
      }
    }

    if (!objectKey) return res.status(400).json({ error: 'key or url required' });

    const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: objectKey });
    const signed = await getSignedUrl(s3Client, cmd, { expiresIn: 3600 });
    res.json({ url: signed, key: objectKey });
  } catch (err) {
    console.error('Error generating presigned GET url', err);
    res.status(500).json({ error: 'Failed to generate presigned GET url' });
  }
})

// GET list
router.get('/', async (req, res) => {
  try {
    const items = await Inspection.find().sort({ created_at: -1 }).limit(200)
    res.json({ items })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inspections' })
  }
})

// GET /api/inspections/summary -> return counts by status
router.get('/summary', async (req, res) => {
  try {
    const agg = await Inspection.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])

    const counts = {}
    agg.forEach((g) => {
      counts[g._id || 'unknown'] = g.count
    })

    const total = await Inspection.countDocuments()

    // normalize common keys
    const response = {
      total: total || 0,
      draft: counts['draft'] || 0,
      completed: counts['completed'] || 0,
      reviewed: counts['reviewed'] || 0,
      unknown: counts['unknown'] || 0,
      raw: counts
    }

    res.json(response)
  } catch (err) {
    console.error('Error in /api/inspections/summary:', err)
    res.status(500).json({ error: 'Failed to compute inspection summary' })
  }
})

// DELETE /api/inspections/:id -> remove inspection
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    console.log('DELETE /api/inspections/:id called for id=', id, 'from', req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress);
    // find document first so we can remove any uploaded files from S3
    const doc = await Inspection.findById(id);
    if (!doc) return res.status(404).json({ error: 'Inspection not found' });

    // collect S3 keys to delete
    const keysToDelete = [];

    try {
      // images may be array of strings or objects with { url, key }
      if (Array.isArray(doc.images)) {
        for (const img of doc.images) {
          if (!img) continue;
          if (typeof img === 'string') {
            try {
              const u = new URL(img);
              // strip leading /\n+              const possibleKey = u.pathname.replace(/^\//, '');
              if (possibleKey) keysToDelete.push(possibleKey);
            } catch (e) {
              // not a url, skip
            }
          } else if (typeof img === 'object' && img.key) {
            keysToDelete.push(img.key);
          }
        }
      }

      // inspector signature may have key
      if (doc.inspector_signature && typeof doc.inspector_signature === 'object' && doc.inspector_signature.key) {
        keysToDelete.push(doc.inspector_signature.key);
      }

      // inspector_selfie may be object with key or url
      if (doc.inspector_selfie) {
        if (typeof doc.inspector_selfie === 'string') {
          try {
            const u = new URL(doc.inspector_selfie);
            const possibleKey = u.pathname.replace(/^\//, '');
            if (possibleKey) keysToDelete.push(possibleKey);
          } catch (e) {}
        } else if (typeof doc.inspector_selfie === 'object' && doc.inspector_selfie.key) {
          keysToDelete.push(doc.inspector_selfie.key);
        }
      }

      // hospital images
      if (doc.hospital && doc.hospital.images) {
        const himgs = doc.hospital.images;
        if (Array.isArray(himgs)) {
          for (const h of himgs) {
            if (!h) continue;
            if (typeof h === 'string') {
              try {
                const u = new URL(h);
                const possibleKey = u.pathname.replace(/^\//, '');
                if (possibleKey) keysToDelete.push(possibleKey);
              } catch (e) {}
            } else if (typeof h === 'object' && h.key) {
              keysToDelete.push(h.key);
            }
          }
        }
      }

      // attempt to delete collected keys from S3 (best-effort)
      if (s3Client && keysToDelete.length) {
        const deletePromises = keysToDelete.map((k) => {
          const cmd = new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: k });
          return s3Client.send(cmd).catch((err) => {
            console.warn('Failed to delete S3 object', k, err && err.message);
          });
        });
        await Promise.allSettled(deletePromises);
      }
    } catch (e) {
      console.warn('Error while attempting to delete associated S3 objects:', e && e.message);
    }

    // finally remove the document
    await Inspection.findByIdAndDelete(id);
    console.log('Deleted inspection', id, 'and attempted to remove', keysToDelete.length, 'S3 objects');
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting inspection', err);
    res.status(500).json({ error: err.message || 'Failed to delete inspection' });
  }
});

module.exports = router
