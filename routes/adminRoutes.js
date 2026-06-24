const express = require('express')
const router = express.Router()
const controller = require('../controllers/admin')
const verifyToken = require('../middleware/authMiddleware')
const {
    getDashboardStats,
    getDashboardKpiDetails
} = require('../controllers/admin');

router.get('/stats', verifyToken, controller.getStats || (async (req, res) => { res.status(501).json({ message: 'Not implemented' }) }))
router.get('/users', verifyToken, controller.getAllUsers || (async (req, res) => { res.status(501).json({ message: 'Not implemented' }) }))
router.get(
    '/kpi-details/:type',
    getDashboardKpiDetails
);

module.exports = router;
