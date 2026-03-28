const express = require('express');
const verifyAuthToken = require('../middleware/authMiddleware');
const { authorize, clientIsolation } = require('../middleware/authMiddleware');
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
router.put('/edit', verifyAuthToken, clientIsolation, editClient);

// Delete client route
router.delete('/delete', verifyAuthToken, authorize('superadmin', 'admin'), deleteClient);

router.post('/getClientDetails', verifyAuthToken, clientIsolation, getClientDetails);

router.get('/all', verifyAuthToken, authorize('superadmin', 'admin', 'teamleader', 'kam'), getAllClients);

router.post('/getClientsForTeamLeader', verifyAuthToken, getClientsForTeamLeader);

// Route for uploading client documents (client can only upload their own)
router.post('/upload-documents', verifyAuthToken, clientIsolation, uploadDocuments);

router.post('/getClientDocuments', verifyAuthToken, clientIsolation, getClientDocuments);

// Unified dashboard overview — client isolation ensures clients see only their data
router.get('/dashboard-overview/:clientId', verifyAuthToken, clientIsolation, getClientDashboardOverview);

module.exports = router;