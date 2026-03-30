const express = require('express');
const router = express.Router();
const verifyAuthToken = require('../middleware/authMiddleware');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and DOC files are allowed'), false);
        }
    }
});

const {
    getKamsWithRecruitment,
    createRecruitmentPosition,
    updateRecruitmentPosition,
    deleteRecruitmentPosition,
    getAllPositions,
    getAllCandidates,
    addCandidate,
    updateCandidateStatus,
    getCandidatesByPosition,
    getRecruitmentStats,
    getClientRecruitmentProgress,
    // New functions for frontend compatibility
    getRequests,
    uploadResumes,
    acceptCandidateSimple,
    rejectCandidateSimple,
    getShortlistedCandidates,
    getClientRequestsSimple,
    getRequestDetails,
    getRecruitmentStatusSimple,
    scheduleInterviewForRecruit,
    closeRequest,
    generateMeetLinkForInterview,
    createRequest
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
 *                 format: uuid
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
 *       400:
 *         description: Validation failed (missing fields or invalid clientId)
 *       500:
 *         description: Failed to create position
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
 *               clientId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional, auto-resolved from positionId when omitted
 *               cvUrl:
 *                 type: string
 *               resumeUrl:
 *                 type: string
 *               experience:
 *                 type: string
 *               currentSalary:
 *                 type: string
 *               currentCTC:
 *                 type: string
 *               expectedSalary:
 *                 type: string
 *               expectedCTC:
 *                 type: string
 *               noticePeriod:
 *                 type: string
 *     responses:
 *       201:
 *         description: Candidate added
 */
router.post('/candidates', verifyAuthToken, upload.single('resume'), addCandidate);

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
 *                 enum: [Submitted, Shared, Shortlisted, Interview, Selected, Rejected, OnHold]
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

// Get all positions with filtering
router.get('/positions', verifyAuthToken, getAllPositions);

// Delete a position
router.delete('/positions/:id', verifyAuthToken, deleteRecruitmentPosition);

// Get all candidates with filtering (pipeline view)
router.get('/candidates', verifyAuthToken, getAllCandidates);

// Client-facing: Get recruitment progress for a specific client
router.get('/client-progress/:clientId', verifyAuthToken, getClientRecruitmentProgress);

// ==================== NEW ROUTES FOR FRONTEND COMPATIBILITY ====================

// Get recruitment requests for a team leader
router.get('/getRequests', verifyAuthToken, getRequests);

// Get requests for client (simple version)
router.get('/getRequests-client', verifyAuthToken, getClientRequestsSimple);

// Get single request details
router.get('/request/:requestId', verifyAuthToken, getRequestDetails);

// Create recruitment request (alternative format)
router.post('/request', verifyAuthToken, createRequest);

// Create client request (alias)
router.post('/create-request', verifyAuthToken, createRequest);

// Upload resumes
router.post('/upload-resumes', verifyAuthToken, upload.array('resume', 20), uploadResumes);

// Accept candidate (shortlist)
router.post('/accept', verifyAuthToken, acceptCandidateSimple);

// Reject candidate
router.post('/reject', verifyAuthToken, rejectCandidateSimple);

// Get shortlisted candidates
router.post('/shortlisted', verifyAuthToken, getShortlistedCandidates);

// Get recruitment status
router.post('/status', verifyAuthToken, getRecruitmentStatusSimple);

// Schedule interview
router.post('/schedule-interview', verifyAuthToken, scheduleInterviewForRecruit);

// Close recruitment request
router.post('/close-request', verifyAuthToken, closeRequest);

// Generate meet link
router.post('/meet-link', verifyAuthToken, generateMeetLinkForInterview);

module.exports = router;
