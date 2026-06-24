const express = require('express');
const router = express.Router();
const verifyAuthToken = require('../middleware/authMiddleware');
const { getSalesLeads, getSalesMeetings } = require('../controllers/sales');

// Sales scoped leads endpoint
router.get('/leads', verifyAuthToken, getSalesLeads);
// Sales scoped meetings endpoint
router.get('/meetings', verifyAuthToken, getSalesMeetings);

module.exports = router;
