const express = require('express');
const router = express.Router();
const verifyAuthToken = require('../middleware/authMiddleware');
const { getKAMDashboard } = require('../controllers/salesKam');

// Dashboard data for the logged‑in Sales KAM
router.get('/dashboard', verifyAuthToken, getKAMDashboard);

module.exports = router;
