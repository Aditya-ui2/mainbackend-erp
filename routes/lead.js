const express = require('express');
const router = express.Router();
const verifyAuthToken = require('../middleware/authMiddleware');
const { getAllLeads, createLead, updateLead, getBDMetrics, seedLeads } = require('../controllers/lead');

// Define routes with proper mapping to match api.jsx
router.get('/', verifyAuthToken, getAllLeads); 
router.post('/', verifyAuthToken, createLead);
router.put('/:leadId', verifyAuthToken, updateLead);
router.get('/metrics', verifyAuthToken, getBDMetrics);
router.post('/seed', seedLeads);

module.exports = router;
