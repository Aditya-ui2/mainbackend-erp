const express = require('express')
const router = express.Router()
const controller = require('../controllers/employee')
const verifyToken = require('../middleware/authMiddleware')
const { Employee } = require('../models/sequelizeModels')
const bcrypt = require('bcrypt')

router.get('/', verifyToken, async (req, res) => {
  try {
    const rows = await Employee.findAll({ order: [['createdAt', 'DESC']] })
    res.json({ success: true, data: rows })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const emp = await Employee.findByPk(req.params.id)
    if (!emp) return res.status(404).json({ success: false, error: 'Not found' })
    res.json({ success: true, data: emp })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/', verifyToken, controller.createEmployee)

router.put('/:id', verifyToken, async (req, res) => {
  try {
    const emp = await Employee.findByPk(req.params.id)
    if (!emp) return res.status(404).json({ success: false, error: 'Not found' })
    const { name, password, phone, documents } = req.body
    if (name) emp.name = name
    if (phone) emp.phone = phone
    if (password) {
      const requesterRole = String(req.user?.role || req.user?.userType || '').trim().toLowerCase();
      const allowedRoles = ['tech', 'superadmin', 'super_admin', 'super admin', 'techperson', 'tech_person', 'tech person', 'manager', 'admin', 'administrator'];
      if (!allowedRoles.includes(requesterRole)) {
        return res.status(403).json({ success: false, error: 'Access denied. Only authorized roles (Tech, Admin, Super Admin, Manager) can reset passwords.' });
      }
      emp.password = await bcrypt.hash(password, 10)
    }
    if (documents !== undefined) {
      emp.documents = typeof documents === 'string' ? JSON.parse(documents) : documents
    }
    await emp.save()
    res.json({ success: true, data: emp })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const requesterRole = String(req.user?.role || req.user?.userType || '').trim().toLowerCase();
    const allowedRoles = ['tech', 'superadmin', 'super_admin', 'super admin', 'admin', 'administrator'];
    if (!allowedRoles.includes(requesterRole)) {
      return res.status(403).json({ success: false, error: 'Access denied. You do not have permission to delete employees.' });
    }
    const emp = await Employee.findByPk(req.params.id)
    if (!emp) return res.status(404).json({ success: false, error: 'Not found' })
    await emp.destroy()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/:id/reset-password', verifyToken, async (req, res) => {
  try {
    const requesterRole = String(req.user?.role || req.user?.userType || '').trim().toLowerCase();
    const allowedRoles = ['tech', 'superadmin', 'super_admin', 'super admin', 'techperson', 'tech_person', 'tech person', 'manager', 'admin', 'administrator'];
    if (!allowedRoles.includes(requesterRole)) {
      return res.status(403).json({ success: false, error: 'Access denied. Only authorized roles (Tech, Admin, Super Admin, Manager) can reset passwords.' });
    }
    const { password } = req.body
    if (!password) return res.status(400).json({ success: false, error: 'Password required' })
    const emp = await Employee.findByPk(req.params.id)
    if (!emp) return res.status(404).json({ success: false, error: 'Not found' })
    emp.password = await bcrypt.hash(password, 10)
    await emp.save()
    res.json({ success: true, message: 'Password updated' })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
