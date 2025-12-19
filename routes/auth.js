const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const User = require('../models/User')

const JWT_SECRET = process.env.JWT_SECRET || 'please_change_this'

// Helper: ensure DB connected
function ensureDb(req, res){
  const mongoose = require('../db')
  if(!mongoose.connection || mongoose.connection.readyState !== 1){
    return res.status(503).json({ error: 'database unavailable' })
  }
  return null
}

// Register - creates a new user
router.post('/register', async (req, res) => {
  const dbErr = ensureDb(req, res); if(dbErr) return
  try {
    const { email, password, name } = req.body
    if (!email || !password) return res.status(400).json({ error: 'email and password required' })

    const exists = await User.findOne({ email }).lean()
    if (exists) return res.status(400).json({ error: 'email already registered' })

    const hashed = await bcrypt.hash(password, 10)
    const user = new User({ email, password: hashed, name: name || null })
    await user.save()
    return res.json({ user: { id: user._id, email: user.email, name: user.name } })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'registration failed' })
  }
})

// Login
router.post('/login', async (req, res) => {
  const dbErr = ensureDb(req, res); if(dbErr) return
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'email and password required' })

    const user = await User.findOne({ email }).lean()
    if (!user) return res.status(401).json({ error: 'invalid credentials' })

    const match = await bcrypt.compare(password, user.password)
    if (!match) return res.status(401).json({ error: 'invalid credentials' })

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '8h' })
    return res.json({ token, user: { id: user._id, email: user.email, name: user.name } })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'login failed' })
  }
})

module.exports = router
