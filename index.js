require('dotenv').config()
const express = require('express')
const cors = require('cors')
const authRouter = require('./routes/auth')
const auditsRouter = require('./routes/audits')
const inspectionsRouter = require('./routes/inspections')
// ensure DB connects
require('./db')

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/auth', authRouter)
app.use('/api/audits', auditsRouter)
app.use('/api/inspections', inspectionsRouter)

app.get('/', (req, res) => res.json({ ok: true, msg: 'Medirank backend' }))

const port = process.env.PORT || 4000
app.listen(port, () => console.log(`Server listening on ${port}`))
