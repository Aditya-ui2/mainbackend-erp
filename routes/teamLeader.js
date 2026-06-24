const express = require('express');
const verifyAuthToken = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authMiddleware');
const { 
    createTeamLeader, 
    editTeamLeader, 
    loginTeamLeader, 
    getTeamLeaderHierarchy, 
    getTeamLeaderTasks, 
    deleteTeamLeaderWithReassignment, 
    deleteTeamLeaderAndPromoteEmployee, 
    getTeamLeaderDetails,
    getAllTeamLeaders
} = require('../controllers/teamLeader');

const router = express.Router();

router.get('/all', verifyAuthToken, authorize('superadmin', 'admin'), getAllTeamLeaders);
// Route to create a new TeamLeader (requires admin authentication)
router.post('/create', verifyAuthToken, authorize('superadmin', 'manager'), createTeamLeader);
// Route to edit an existing TeamLeader (requires admin authentication)
router.put('/edit', verifyAuthToken, editTeamLeader);
// Route to login a Team Leader
router.post('/login', loginTeamLeader);

router.delete('/deleteTeamLeaderWithReassignment', verifyAuthToken, authorize('superadmin', 'admin', 'manager', 'kam'), deleteTeamLeaderWithReassignment);

router.delete('/deleteTeamLeaderAndPromoteEmployee', verifyAuthToken, authorize('superadmin', 'admin', 'manager', 'kam'), deleteTeamLeaderAndPromoteEmployee);

router.post('/hierarchy', verifyAuthToken, getTeamLeaderHierarchy);

router.post('/teamLeaderTasks', verifyAuthToken, getTeamLeaderTasks);

router.post('/getTeamLeaderDetails', verifyAuthToken, getTeamLeaderDetails); 

module.exports = router;