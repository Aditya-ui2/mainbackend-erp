const express = require('express');
const verifyAuthToken = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authMiddleware');
const { createEmployee, editEmployee, loginEmployee, deleteEmployee, getEmployeeTasks} = require('../controllers/employee');
const router = express.Router();

router.post('/create', verifyAuthToken, authorize('superadmin', 'admin', 'teamleader'), createEmployee);

router.put('/edit', verifyAuthToken, editEmployee);

router.post('/login', loginEmployee);

router.delete('/delete', verifyAuthToken, authorize('superadmin', 'admin'), deleteEmployee);

router.post('/employeeTasks', verifyAuthToken, getEmployeeTasks); 

module.exports = router;