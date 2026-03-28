const express = require('express');
const { createTeamLeader, editTeamLeader, loginTeamLeader, getTeamLeaderHierarchy, getTeamLeaderTasks, deleteTeamLeaderWithReassignment, deleteTeamLeaderAndPromoteEmployee, getTeamLeaderDetails } = require('../controllers/teamLeader');
// Import the controller functions
const verifyAuthToken = require('../middleware/authMiddleware'); // Import the auth middleware 
const { authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Route to create a new TeamLeader (requires admin authentication)
router.post('/create', verifyAuthToken, authorize('superadmin', 'admin'), createTeamLeader);
// Route to edit an existing TeamLeader (requires admin authentication)
router.put('/edit', verifyAuthToken, editTeamLeader);
// Route to login a Team Leader
router.post('/login', loginTeamLeader);

router.delete('/deleteTeamLeaderWithReassignment', verifyAuthToken, authorize('superadmin', 'admin'), deleteTeamLeaderWithReassignment);

router.delete('/deleteTeamLeaderAndPromoteEmployee', verifyAuthToken, authorize('superadmin', 'admin'), deleteTeamLeaderAndPromoteEmployee);

router.post('/hierarchy', verifyAuthToken, getTeamLeaderHierarchy);

router.post('/teamLeaderTasks', verifyAuthToken, getTeamLeaderTasks);

router.post('/getTeamLeaderDetails', verifyAuthToken, getTeamLeaderDetails); 

module.exports = router;