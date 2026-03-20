const express = require('express');
const router = express.Router();
const {
    getTeamMembers,
    getTeamMember,
    addTeamMember,
    updateTeamMember,
    deleteTeamMember,
    getActivityLogs,
    createActivityLog,
    getDepartmentTasks,
    createDepartmentTask,
    updateDepartmentTask,
    deleteDepartmentTask,
    getDepartmentStats,
} = require('../controllers/departmentTeam');
const verifyAuthToken = require('../middleware/authMiddleware');

// Team Members Routes
router.get('/members', verifyAuthToken, getTeamMembers);
router.get('/members/:id', verifyAuthToken, getTeamMember);
router.post('/members', verifyAuthToken, addTeamMember);
router.put('/members/:id', verifyAuthToken, updateTeamMember);
router.delete('/members/:id', verifyAuthToken, deleteTeamMember);

// Activity Logs Routes
router.get('/activities', verifyAuthToken, getActivityLogs);
router.post('/activities', verifyAuthToken, createActivityLog);

// Department Tasks Routes
router.get('/tasks', verifyAuthToken, getDepartmentTasks);
router.post('/tasks', verifyAuthToken, createDepartmentTask);
router.put('/tasks/:id', verifyAuthToken, updateDepartmentTask);
router.delete('/tasks/:id', verifyAuthToken, deleteDepartmentTask);

// Dashboard Stats
router.get('/stats', verifyAuthToken, getDepartmentStats);

module.exports = router;
