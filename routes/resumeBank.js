const express = require('express');
const router = express.Router();
const resumeBankController = require('../controllers/resumeBank');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Resume Bank
 *   description: Resume bank management - sync and manage 10,000+ resumes from SharePoint
 */

/**
 * @swagger
 * /api/resumebank/sync:
 *   post:
 *     summary: Sync resumes from SharePoint
 *     tags: [Resume Bank]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roleType:
 *                 type: string
 *                 description: Sync only specific role type folder
 *               fullSync:
 *                 type: boolean
 *                 description: Force full sync (default false for incremental)
 *     responses:
 *       200:
 *         description: Sync completed
 */
router.post('/sync', authMiddleware.verifyTeamLeaderToken, resumeBankController.syncResumes);

/**
 * @swagger
 * /api/resumebank/stats:
 *   get:
 *     summary: Get resume bank statistics
 *     tags: [Resume Bank]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved
 */
router.get('/stats', authMiddleware.verifyTeamLeaderToken, resumeBankController.getStats);

/**
 * @swagger
 * /api/resumebank/roles:
 *   get:
 *     summary: Get all role types with counts
 *     tags: [Resume Bank]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Role types retrieved
 */
router.get('/roles', authMiddleware.verifyTeamLeaderToken, resumeBankController.getRoleTypes);

/**
 * @swagger
 * /api/resumebank/folders:
 *   get:
 *     summary: Get SharePoint folder structure
 *     tags: [Resume Bank]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Folder structure retrieved
 */
router.get('/folders', authMiddleware.verifyTeamLeaderToken, resumeBankController.getFolders);

/**
 * @swagger
 * /api/resumebank/search-sharepoint:
 *   get:
 *     summary: Search resumes directly in SharePoint
 *     tags: [Resume Bank]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         required: true
 *         description: Search query
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/search-sharepoint', authMiddleware.verifyTeamLeaderToken, resumeBankController.searchSharePoint);

/**
 * @swagger
 * /api/resumebank:
 *   get:
 *     summary: Get resumes with filters and pagination
 *     tags: [Resume Bank]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: roleType
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Available, Shortlisted, Contacted, Interview Scheduled, Hired, Rejected, Not Interested]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: isStarred
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Resumes retrieved
 */
router.get('/', authMiddleware.verifyTeamLeaderToken, resumeBankController.getResumes);

/**
 * @swagger
 * /api/resumebank/star:
 *   post:
 *     summary: Star/unstar multiple resumes
 *     tags: [Resume Bank]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resumeIds
 *               - isStarred
 *             properties:
 *               resumeIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               isStarred:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Resumes updated
 */
router.post('/star', authMiddleware.verifyTeamLeaderToken, resumeBankController.toggleStarResumes);

/**
 * @swagger
 * /api/resumebank/bulk-status:
 *   post:
 *     summary: Update status for multiple resumes
 *     tags: [Resume Bank]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resumeIds
 *               - status
 *             properties:
 *               resumeIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               status:
 *                 type: string
 *                 enum: [Available, Shortlisted, Contacted, Interview Scheduled, Hired, Rejected, Not Interested]
 *     responses:
 *       200:
 *         description: Status updated
 */
router.post('/bulk-status', authMiddleware.verifyTeamLeaderToken, resumeBankController.bulkUpdateStatus);

/**
 * @swagger
 * /api/resumebank/assign:
 *   post:
 *     summary: Assign resumes to a recruitment position
 *     tags: [Resume Bank]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resumeIds
 *               - positionId
 *             properties:
 *               resumeIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               positionId:
 *                 type: string
 *               assignedTo:
 *                 type: string
 *                 description: DepartmentTeam member ID
 *     responses:
 *       200:
 *         description: Resumes assigned
 */
router.post('/assign', authMiddleware.verifyTeamLeaderToken, resumeBankController.assignToPosition);

/**
 * @swagger
 * /api/resumebank/{id}:
 *   get:
 *     summary: Get single resume details
 *     tags: [Resume Bank]
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
 *         description: Resume details
 */
router.get('/:id', authMiddleware.verifyTeamLeaderToken, resumeBankController.getResumeById);

/**
 * @swagger
 * /api/resumebank/{id}:
 *   put:
 *     summary: Update resume details
 *     tags: [Resume Bank]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               candidateName:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               experience:
 *                 type: string
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *               currentCompany:
 *                 type: string
 *               currentLocation:
 *                 type: string
 *               status:
 *                 type: string
 *               rating:
 *                 type: number
 *               isStarred:
 *                 type: boolean
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Resume updated
 */
router.put('/:id', authMiddleware.verifyTeamLeaderToken, resumeBankController.updateResume);

/**
 * @swagger
 * /api/resumebank/{id}/download:
 *   get:
 *     summary: Get download URL for resume
 *     tags: [Resume Bank]
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
 *         description: Download URL
 */
router.get('/:id/download', authMiddleware.verifyTeamLeaderToken, resumeBankController.getDownloadUrl);

module.exports = router;
