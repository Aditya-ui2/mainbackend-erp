const express = require('express')
const router = express.Router()
const { Attendance } = require('../models/sequelizeModels')
const verifyToken = require('../middleware/authMiddleware')
const { Op } = require('sequelize')

// GET /api/attendance/:employeeId?month=&year=
router.get('/:employeeId', verifyToken, async (req, res) => {
  try {
    const { employeeId } = req.params
    const { month, year } = req.query // month is 0-indexed (0 = Jan, 11 = Dec)

    if (!employeeId) {
      return res.status(400).json({ success: false, error: 'employeeId required' })
    }

    const targetYear = parseInt(year) || new Date().getFullYear()
    const targetMonth = parseInt(month)

    let where = { memberId: employeeId }

    if (!isNaN(targetMonth)) {
      // Construct date bounds for the month
      const startDate = new Date(targetYear, targetMonth, 1)
      const endDate = new Date(targetYear, targetMonth + 1, 0)
      
      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]

      where.date = {
        [Op.between]: [startDateStr, endDateStr]
      }
    }

    const records = await Attendance.findAll({
      where,
      order: [['date', 'ASC']]
    })

    res.json({ success: true, data: records })
  } catch (err) {
    console.error('Error fetching attendance in routes:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/attendance/
router.post('/', verifyToken, async (req, res) => {
  try {
    const { memberId, memberName, department, date, status, notes } = req.body
    if (!memberId || !date) {
      return res.status(400).json({ success: false, error: 'memberId and date required' })
    }

    const [record, created] = await Attendance.findOrCreate({
      where: { memberId, date },
      defaults: {
        memberName: memberName || 'Employee',
        department: department || 'HR',
        date,
        checkIn: new Date(),
        status: status || 'Present',
        notes
      }
    })

    if (!created) {
      await record.update(req.body)
    }

    res.json({ success: true, data: record })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
