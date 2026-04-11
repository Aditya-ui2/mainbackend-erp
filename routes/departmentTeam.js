const express = require('express');
const router = express.Router();
const {
    loginDepartmentTeam,
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
    getMyTasks,
    getMyStats,
} = require('../controllers/departmentTeam');
const verifyAuthToken = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Department
 *   description: Department & Team management - Members, Tasks, Activities
 */

/**
 * @swagger
 * /department/login:
 *   post:
 *     summary: Login for department team members
 *     tags: [Department]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', loginDepartmentTeam);

/**
 * @swagger
 * /department/members:
 *   get:
 *     summary: Get all team members
 *     tags: [Department]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of team members
 */
router.get('/members', verifyAuthToken, getTeamMembers);

/**
 * @swagger
 * /department/members/{id}:
 *   get:
 *     summary: Get single team member
 *     tags: [Department]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Team member details
 */
router.get('/members/:id', verifyAuthToken, getTeamMember);

/**
 * @swagger
 * /department/members:
 *   post:
 *     summary: Add new team member
 *     tags: [Department]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *               departmentId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Member added
 */
router.post('/members', verifyAuthToken, addTeamMember);

/**
 * @swagger
 * /department/members/{id}:
 *   put:
 *     summary: Update team member
 *     tags: [Department]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Member updated
 */
router.put('/members/:id', verifyAuthToken, updateTeamMember);

/**
 * @swagger
 * /department/members/{id}:
 *   delete:
 *     summary: Delete team member
 *     tags: [Department]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Member deleted
 */
router.delete('/members/:id', verifyAuthToken, deleteTeamMember);

/**
 * @swagger
 * /department/activities:
 *   get:
 *     summary: Get activity logs
 *     tags: [Department]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: memberId
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of activities
 */
router.get('/activities', verifyAuthToken, getActivityLogs);

/**
 * @swagger
 * /department/activities:
 *   post:
 *     summary: Create activity log
 *     tags: [Department]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               memberId:
 *                 type: string
 *               type:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Activity logged
 */
router.post('/activities', verifyAuthToken, createActivityLog);

/**
 * @swagger
 * /department/tasks:
 *   get:
 *     summary: Get department tasks
 *     tags: [Department]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: ['Pending', 'InProgress', 'Completed']
 *       - in: query
 *         name: assignedTo
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of tasks
 */
router.get('/tasks', verifyAuthToken, getDepartmentTasks);

/**
 * @swagger
 * /department/tasks:
 *   post:
 *     summary: Create department task
 *     tags: [Department]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               assignedTo:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: ['Low', 'Medium', 'High']
 *               dueDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Task created
 */
router.post('/tasks', verifyAuthToken, createDepartmentTask);

/**
 * @swagger
 * /department/tasks/{id}:
 *   put:
 *     summary: Update department task
 *     tags: [Department]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Task updated
 */
router.put('/tasks/:id', verifyAuthToken, updateDepartmentTask);

/**
 * @swagger
 * /department/tasks/{id}:
 *   delete:
 *     summary: Delete department task
 *     tags: [Department]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Task deleted
 */
router.delete('/tasks/:id', verifyAuthToken, deleteDepartmentTask);

/**
 * @swagger
 * /department/stats:
 *   get:
 *     summary: Get department dashboard statistics
 *     tags: [Department]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Department stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalMembers:
 *                   type: integer
 *                 totalTasks:
 *                   type: integer
 *                 completedTasks:
 *                   type: integer
 *                 pendingTasks:
 *                   type: integer
 */
router.get('/stats', verifyAuthToken, getDepartmentStats);

// ============== MEMBER SELF-SERVICE ==============

/**
 * @swagger
 * /department/my-tasks:
 *   get:
 *     summary: Get tasks assigned to the logged-in team member
 *     tags: [Department]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: ['Pending', 'In Progress', 'Completed', 'Overdue']
 *     responses:
 *       200:
 *         description: List of my tasks
 */
router.get('/my-tasks', verifyAuthToken, getMyTasks);

/**
 * @swagger
 * /department/my-stats:
 *   get:
 *     summary: Get personal stats for logged-in team member
 *     tags: [Department]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Personal task stats
 */
router.get('/my-stats', verifyAuthToken, getMyStats);

// ============== MEMBER FEATURES ROUTES ==============
const mf = require('../controllers/memberFeatures');

// Profile
router.get('/my-profile', verifyAuthToken, mf.getMyProfile);
router.put('/my-profile', verifyAuthToken, mf.updateMyProfile);

// Leave Requests
router.get('/leaves', verifyAuthToken, mf.getLeaveRequests);
router.post('/leaves', verifyAuthToken, mf.applyLeave);
router.get('/dept-leaves', verifyAuthToken, mf.getDeptLeaveRequests);
router.put('/leaves/:id/approve', verifyAuthToken, mf.approveRejectLeave);

// Attendance
router.post('/attendance/check-in', verifyAuthToken, mf.checkIn);
router.post('/attendance/check-out', verifyAuthToken, mf.checkOut);
router.get('/my-attendance', verifyAuthToken, mf.getMyAttendance);
router.get('/dept-attendance', verifyAuthToken, mf.getDeptAttendance);

// Performance
router.get('/performance', verifyAuthToken, mf.getPerformanceStats);

// Daily Reports / MIS Reports
router.post('/daily-report', verifyAuthToken, mf.submitDailyReport);
router.get('/my-reports', verifyAuthToken, mf.getMyReports);
router.get('/dept-reports', verifyAuthToken, mf.getDeptReports);
router.get('/mis-reports', verifyAuthToken, mf.getMISReports);
router.post('/daily-report/:id/comment', verifyAuthToken, mf.addHeadComment);

// Announcements
router.get('/announcements', verifyAuthToken, mf.getAnnouncements);
router.post('/announcements', verifyAuthToken, mf.createAnnouncement);
router.delete('/announcements/:id', verifyAuthToken, mf.deleteAnnouncement);

// Documents
router.get('/documents', verifyAuthToken, mf.getDocuments);
router.post('/documents', verifyAuthToken, mf.uploadDocument);
router.delete('/documents/:id', verifyAuthToken, mf.deleteDocument);

// Training
router.get('/my-trainings', verifyAuthToken, mf.getMyTrainings);
router.put('/trainings/:id', verifyAuthToken, mf.updateTraining);
router.post('/trainings', verifyAuthToken, mf.assignTraining);

// Payslips
router.get('/my-payslips', verifyAuthToken, mf.getMyPayslips);
router.post('/payslips', verifyAuthToken, mf.generatePayslip);

// Team Chat
router.get('/chat', verifyAuthToken, mf.getChatMessages);
router.post('/chat', verifyAuthToken, mf.sendChatMessage);

// Calendar
router.get('/calendar', verifyAuthToken, mf.getCalendarEvents);

// Notes
router.get('/notes', verifyAuthToken, mf.getNotes);
router.post('/notes', verifyAuthToken, mf.createNote);
router.put('/notes/:id', verifyAuthToken, mf.updateNote);
router.delete('/notes/:id', verifyAuthToken, mf.deleteNote);

module.exports = router;
