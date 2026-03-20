const express = require('express');
const router = express.Router();
const verifyAuthToken = require('../middleware/authMiddleware');
const {
    getKamsWithRecruitment,
    createRecruitmentPosition,
    updateRecruitmentPosition,
    addCandidate,
    updateCandidateStatus,
    getCandidatesByPosition,
    getRecruitmentStats
} = require('../controllers/recruitment');

/**
 * @swagger
 * tags:
 *   name: Recruitment
 *   description: Recruitment management - KAMs, Positions, Candidates
 */

/**
 * @swagger
 * /recruitment/kams:
 *   get:
 *     summary: Get all KAMs with their recruitment data
 *     tags: [Recruitment]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of KAMs with clients and positions
 *       401:
 *         description: Unauthorized
 */
router.get('/kams', verifyAuthToken, getKamsWithRecruitment);

/**
 * @swagger
 * /recruitment/positions:
 *   post:
 *     summary: Create a new recruitment position
 *     tags: [Recruitment]
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
 *               - clientId
 *             properties:
 *               title:
 *                 type: string
 *               clientId:
 *                 type: string
 *               location:
 *                 type: string
 *               openings:
 *                 type: integer
 *               priority:
 *                 type: string
 *                 enum: [Low, Medium, High, Urgent]
 *               deadline:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Position created successfully
 */
router.post('/positions', verifyAuthToken, createRecruitmentPosition);

/**
 * @swagger
 * /recruitment/positions/{id}:
 *   put:
 *     summary: Update a recruitment position
 *     tags: [Recruitment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Position updated
 */
router.put('/positions/:id', verifyAuthToken, updateRecruitmentPosition);

/**
 * @swagger
 * /recruitment/candidates:
 *   post:
 *     summary: Add a new candidate
 *     tags: [Recruitment]
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
 *               - positionId
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               positionId:
 *                 type: string
 *               resumeUrl:
 *                 type: string
 *               experience:
 *                 type: string
 *               currentCTC:
 *                 type: string
 *               expectedCTC:
 *                 type: string
 *               noticePeriod:
 *                 type: string
 *     responses:
 *       201:
 *         description: Candidate added
 */
router.post('/candidates', verifyAuthToken, addCandidate);

/**
 * @swagger
 * /recruitment/candidates/{id}/status:
 *   put:
 *     summary: Update candidate status
 *     tags: [Recruitment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [New, Shared, Shortlisted, Interview, Selected, Rejected, OnHold]
 *     responses:
 *       200:
 *         description: Status updated
 */
router.put('/candidates/:id/status', verifyAuthToken, updateCandidateStatus);

/**
 * @swagger
 * /recruitment/positions/{positionId}/candidates:
 *   get:
 *     summary: Get candidates for a position
 *     tags: [Recruitment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: positionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of candidates
 */
router.get('/positions/:positionId/candidates', verifyAuthToken, getCandidatesByPosition);

/**
 * @swagger
 * /recruitment/stats:
 *   get:
 *     summary: Get recruitment statistics
 *     tags: [Recruitment]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recruitment statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 positions:
 *                   type: object
 *                 candidates:
 *                   type: object
 */
router.get('/stats', verifyAuthToken, getRecruitmentStats);

module.exports = router;
