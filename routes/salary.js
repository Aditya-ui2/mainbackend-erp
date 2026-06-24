const express = require('express')
const router = express.Router()
const controller = require('../controllers/salary')
const verifyToken = require('../middleware/authMiddleware')

router.get('/all-employees', verifyToken, controller.getAllEmployeesPayroll)
router.get('/:employeeId', verifyToken, controller.getSalary)
router.put('/:employeeId', verifyToken, controller.updateSalary)

module.exports = router
