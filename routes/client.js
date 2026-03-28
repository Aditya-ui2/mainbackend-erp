const express = require('express');
const verifyAuthToken = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authMiddleware');
const { onboardClient, signupClient, loginClient, editClient, deleteClient, getAllClients, getClientsForTeamLeader, uploadDocuments, getClientDocuments, getClientDetails, getClientDashboardOverview, createClient } = require('../controllers/client');
const router = express.Router();

// Client create route (Admin directly)
router.post('/create', verifyAuthToken, authorize('superadmin', 'admin'), createClient);

// Client signup route
router.post('/signup', signupClient);

// Client login route
router.post('/login', loginClient);

// Client onboarding route (Admin only)
router.post('/onboard-client', verifyAuthToken, authorize('superadmin', 'admin'), onboardClient);

// Edit client route
router.put('/edit', verifyAuthToken, editClient);

// Delete client route
router.delete('/delete', verifyAuthToken, authorize('superadmin', 'admin'), deleteClient);

router.post('/getClientDetails', verifyAuthToken, getClientDetails);

router.get('/all', verifyAuthToken, getAllClients);

router.post('/getClientsForTeamLeader', verifyAuthToken, getClientsForTeamLeader);

// Route for uploading client documents
router.post('/upload-documents', verifyAuthToken, uploadDocuments);

router.post('/getClientDocuments', verifyAuthToken, getClientDocuments);

// Unified dashboard overview (recruitment + operations)
router.get('/dashboard-overview/:clientId', verifyAuthToken, getClientDashboardOverview);

module.exports = router;