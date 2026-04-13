const express = require('express');
const verifyAuthToken = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authMiddleware');
const { onboardClient, signupClient, loginClient, editClient, deleteClient, getAllClients, getClientsForTeamLeader, uploadDocuments, getClientDocuments, getClientDetails, getClientDashboardOverview, createClient, getClientAttendance, getClientPayroll, getClientMasterData } = require('../controllers/client');
const router = express.Router();

// Client create route (Admin directly)
router.post('/create', verifyAuthToken, createClient);

// Client signup route
router.post('/signup', signupClient);

// Client login route
router.post('/login', loginClient);

// Client onboarding route (Admin only)
router.post('/onboard-client', onboardClient);

// Edit client route
router.put('/edit', verifyAuthToken, editClient);

// Delete client route
router.delete('/delete', verifyAuthToken, deleteClient);

router.post('/getClientDetails', getClientDetails);

router.get('/all', verifyAuthToken, authorize('superadmin', 'admin', 'teamleader', 'kam', 'employee', 'hrRecruitment', 'hrOperations'), getAllClients);

router.post('/getClientsForTeamLeader', getClientsForTeamLeader);

// Route for uploading client documents
router.post('/upload-documents', uploadDocuments);

router.post('/getClientDocuments', getClientDocuments);

// Unified dashboard overview (recruitment + operations)
router.get('/dashboard-overview/:clientId', getClientDashboardOverview);

// Client attendance for assigned team members
router.get('/attendance/:clientId', getClientAttendance);

// Client payroll data filtered by clientId
router.get('/payroll/:clientId', getClientPayroll);

// Client master data
router.get('/master-data/:clientId', getClientMasterData);

module.exports = router;