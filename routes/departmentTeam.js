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
const { verifyToken } = require('../middleware/authMiddleware');

// Team Members Routes
router.get('/members', verifyToken, getTeamMembers);
router.get('/members/:id', verifyToken, getTeamMember);
router.post('/members', verifyToken, addTeamMember);
router.put('/members/:id', verifyToken, updateTeamMember);
router.delete('/members/:id', verifyToken, deleteTeamMember);

// Activity Logs Routes
router.get('/activities', verifyToken, getActivityLogs);
router.post('/activities', verifyToken, createActivityLog);

// Department Tasks Routes
router.get('/tasks', verifyToken, getDepartmentTasks);
router.post('/tasks', verifyToken, createDepartmentTask);
router.put('/tasks/:id', verifyToken, updateDepartmentTask);
router.delete('/tasks/:id', verifyToken, deleteDepartmentTask);

// Dashboard Stats
router.get('/stats', verifyToken, getDepartmentStats);

module.exports = router;
