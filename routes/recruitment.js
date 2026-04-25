const express = require('express');
const router = express.Router();
const { verifyAuthToken, clientIsolation } = require('../middleware/authMiddleware');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf', 
            'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/png'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF, DOC, JPG and PNG files are allowed'), false);
        }
    }
});

const {
    getRecruitmentClients,
    getKamsWithRecruitment,
    createRecruitmentPosition,
    updateRecruitmentPosition,
    deleteRecruitmentPosition,
    getAllPositions,
    getAllCandidates,
    addCandidate,
    getCandidateById,
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
    createRequest,
    getMyPerformanceStats,
    getOffers,
    createOrUpdateOffer,
    getOfferCandidatesSuggestions,
    updateCandidate,
    deleteOffer,
    upsertOfferTemplate,
    getOfferTemplate,
    verifyCandidateKYC,
    uploadCandidateKYC,
    getCandidateProfile,
    attachFinalOfferLetter,
    generateCandidateCredentials,
    loginCandidate,
    submitCandidateKYC
} = require('../controllers/recruitment');

console.log('[ROUTING] Initializing Recruitment Routes...');
// TOP-LEVEL ROUTES TO AVOID 404 (Handling all singular/plural permutations)
router.post('/candidate/generate-credentials', verifyAuthToken, generateCandidateCredentials);
router.post('/candidate/generate-credential', verifyAuthToken, generateCandidateCredentials);
router.post('/candidates/generate-credentials', verifyAuthToken, generateCandidateCredentials);
router.post('/candidates/generate-credential', verifyAuthToken, generateCandidateCredentials);
router.post('/candidate/login', loginCandidate);
router.get('/candidate/profile', verifyAuthToken, getCandidateProfile);
router.post('/candidate/upload-kyc', verifyAuthToken, upload.single('document'), uploadCandidateKYC);
router.post('/candidate/verify-kyc', verifyAuthToken, verifyCandidateKYC);
router.post('/candidate/submit-kyc', verifyAuthToken, submitCandidateKYC);
router.post('/onboarding-gen-creds', generateCandidateCredentials);

router.get('/health', (req, res) => {
    console.log('[HEALTH CHECK] Recruitment Module reporting...');
    res.json({ 
        success: true, 
        message: 'Recruitment Module Active', 
        version: 'JOIN_CAND_FIX_V1', 
        timestamp: new Date(),
        routes: ['/candidate/generate-credentials', '/candidate/login', '/onboarding-gen-creds'] // Debug info
    });
});
router.get('/onboarding-gen-creds', (req, res) => res.send('Endpoint Active - Use POST'));
router.get('/fix-db', async (req, res) => {
    try {
        await RecruitmentPosition.sequelize.query('ALTER TABLE candidates DROP CONSTRAINT IF EXISTS "candidates_addedById_fkey"');
        res.json({ success: true, message: 'Database constraint dropped successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.get('/ping-test', (req, res) => res.send('API OK - ' + new Date()));


const { distributeJobToPlatforms } = require('../controllers/jobDistribution');

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
router.get('/kams', verifyAuthToken, clientIsolation, getKamsWithRecruitment);
router.get('/clients', verifyAuthToken, clientIsolation, getRecruitmentClients);

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
 *                 enum: ['Low', 'Medium', 'High', 'Urgent']
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

// Distribute job to external platforms
router.post('/positions/:id/distribute', verifyAuthToken, distributeJobToPlatforms);

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
router.put('/candidates/:id', verifyAuthToken, upload.single('resume'), updateCandidate);

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
 *                 enum: ['Submitted', 'Shared', 'Shortlisted', 'Interview', 'Selected', 'Rejected', 'OnHold']
 *     responses:
 *       200:
 *         description: Status updated
 */
/**
 * @swagger
 * /recruitment/candidates/{id}:
 *   get:
 *     summary: Get candidate details by ID
 *     tags: [Recruitment]
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
 *         description: Candidate details with resume and interview history
 */
router.get('/candidates/:id', verifyAuthToken, clientIsolation, getCandidateById); 

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
router.get('/positions/:positionId/candidates', verifyAuthToken, clientIsolation, getCandidatesByPosition);

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
router.get('/stats', verifyAuthToken, clientIsolation, getRecruitmentStats);
router.get('/my-performance', verifyAuthToken, getMyPerformanceStats);
router.get('/offers', verifyAuthToken, clientIsolation, getOffers);
router.post('/offers', verifyAuthToken, upload.single('offerLetter'), createOrUpdateOffer);
router.put('/offers/:candidateId', verifyAuthToken, upload.single('offerLetter'), createOrUpdateOffer);
router.get('/offers/candidate-suggestions', verifyAuthToken, getOfferCandidatesSuggestions);
router.delete('/offers/:candidateId', verifyAuthToken, deleteOffer);

router.post('/offer-templates', verifyAuthToken, upload.single('template'), upsertOfferTemplate);
router.get('/offer-templates', verifyAuthToken, clientIsolation, getOfferTemplate);
// Get all positions with filtering
router.get('/positions', verifyAuthToken, clientIsolation, getAllPositions);

// Delete a position
router.delete('/positions/:id', verifyAuthToken, deleteRecruitmentPosition);

// Get all candidates with filtering (pipeline view)
router.get('/candidates', verifyAuthToken, clientIsolation, getAllCandidates);

router.get('/client-progress/:clientId', verifyAuthToken, clientIsolation, getClientRecruitmentProgress);

// ==================== NEW ROUTES FOR FRONTEND COMPATIBILITY ====================

// Get recruitment requests for a team leader
router.get('/getRequests', verifyAuthToken, getRequests);

// Get requests for client (simple version)
router.get('/getRequests-client', verifyAuthToken, clientIsolation, getClientRequestsSimple);

// Get single request details
router.get('/request/:requestId', verifyAuthToken, clientIsolation, getRequestDetails);

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

router.post('/candidate/attach-final-offer', verifyAuthToken, upload.single('offerLetter'), attachFinalOfferLetter);


router.get('/test', (req, res) => {
    res.json({ status: 'Recruitment Module Active', timestamp: new Date().toISOString() });
});

module.exports = router;
// RESTART TRIGGER FOR ENDPOINTS
