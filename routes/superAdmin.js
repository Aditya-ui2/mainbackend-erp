const express = require('express');
const { loginSuperAdmin, editSuperAdmin, getDashboardStats, getDashboardKpiDetails } = require('../controllers/superAdmin');
const verifyAuthToken = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authMiddleware');
const router = express.Router();

// Route to login SuperAdmin
router.post('/login', loginSuperAdmin);

// Route to edit SuperAdmin (requires SuperAdmin authentication)
router.put('/edit', verifyAuthToken, authorize('superadmin'), editSuperAdmin);

// Route to get dashboard statistics
router.get('/dashboard-stats', verifyAuthToken, authorize('superadmin'), getDashboardStats);

// Route to get dashboard KPI lists/details
router.get('/dashboard-kpi-details', verifyAuthToken, authorize('superadmin'), getDashboardKpiDetails);

module.exports = router;