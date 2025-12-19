const express = require('express')
const router = express.Router()

// Generate mock audits data
function makeMockData(){
  const base = [
    ['Medication Chart Review Checklist','Clinical','23-Oct-2025 03:00 pm','Test Unit','msswapnatoka','29-Oct-2025','soumya',''],
    ['Transfusion Reaction Reporting Form','Clinical','03-Oct-2025 03:28 pm','Ankura Banjara Hills','soumya','06-Oct-2025','nagendra',''],
    ['Radiology Safety Audit Checklist','Clinical','03-Oct-2025 11:28 am','Ankura Banjara Hills','soumya','06-Oct-2025','soumya',''],
    ['Bronchiolitis Cases Audit Form','Clinical','23-Sep-2025 02:28 pm','Test Unit','soumya','29-Sep-2025','soumya',''],
    ['WHO Surgical Safety Check List Audit','Clinical','30-Sep-2025 11:46 am','Ankura Banjara Hills','soumya','03-Oct-2025','soumya','']
  ]

  const items = []
  for(let i=0;i<60;i++){
    const row = base[i % base.length]
    items.push({
      id: i+1,
      name: row[0] + (i>0 ? ` (${i})` : ''),
      type: row[1],
      date: row[2],
      unit: row[3],
      by: row[4],
      closed: row[5],
      incharge: row[6],
      admin: row[7],
      status: (i%5===0? 'AUDIT CLOSED' : (i%5===1? 'Draft' : (i%5===2? 'Under Review' : (i%5===3? 'Escalated' : 'Open'))))
    })
  }
  return items
}

const ALL = makeMockData()

// GET /api/audits?page=1&limit=10&sort=date&order=desc&filterName=xxx
router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page||'1',10))
  const limit = Math.max(1, parseInt(req.query.limit||'10',10))
  const sort = req.query.sort || 'id'
  const order = (req.query.order||'desc').toLowerCase()
  const filterName = (req.query.filterName||'').toLowerCase()

  let items = ALL.slice()
  if(filterName){
    items = items.filter(it => it.name.toLowerCase().includes(filterName) || it.unit.toLowerCase().includes(filterName))
  }

  items.sort((a,b)=>{
    const A = (a[sort]||'').toString().toLowerCase()
    const B = (b[sort]||'').toString().toLowerCase()
    if(A<B) return order === 'asc' ? -1 : 1
    if(A>B) return order === 'asc' ? 1 : -1
    return 0
  })

  const total = items.length
  const start = (page-1)*limit
  const pageItems = items.slice(start, start+limit)

  // small delay to emulate network
  setTimeout(()=>{
    res.json({ items: pageItems, total, page, limit })
  }, 300)
})

module.exports = router
