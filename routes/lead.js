const express = require('express');
const router = express.Router();
const verifyAuthToken = require('../middleware/authMiddleware');
const { 
    getAllLeads, 
    createLead, 
    updateLead, 
    deleteLead, 
    getBDMetrics, 
    getBDDashboardStats, 
    seedLeads,
    getLeadById,
    getLeadsByBD,
    createBDProposal,
    sendProposal,
    sendProfile,
    createBD,
    bdLogin
} = require('../controllers/lead');

// Define routes with proper mapping to match api.jsx
router.get('/', verifyAuthToken, getAllLeads); 
router.get('/leads', verifyAuthToken, getAllLeads); 
router.post('/', verifyAuthToken, createLead);
router.post('/leads', verifyAuthToken, createLead);
router.put('/:leadId', verifyAuthToken, updateLead);
router.put('/leads/:leadId', verifyAuthToken, updateLead);
router.delete('/:leadId', verifyAuthToken, deleteLead);
router.delete('/leads/:leadId', verifyAuthToken, deleteLead);
router.get('/metrics', verifyAuthToken, getBDMetrics);
router.get('/dashboard-stats', verifyAuthToken, getBDDashboardStats);
router.get('/leads/dashboard-stats', verifyAuthToken, getBDDashboardStats);
router.post('/seed', seedLeads);

// Support for detailed BD view / single lead operations
router.get('/leads/:leadId', verifyAuthToken, getLeadById);
router.get('/leads/business-dev/:businessDevId', verifyAuthToken, getLeadsByBD);
router.post('/proposals', verifyAuthToken, createBDProposal);
router.post('/leads/send-proposal', verifyAuthToken, sendProposal);
router.post('/leads/send-profile', verifyAuthToken, sendProfile);
router.post('/create', createBD);
router.post('/login', bdLogin);

module.exports = router;
