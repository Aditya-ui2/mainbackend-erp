const express = require('express');
const router = express.Router();
const verifyAuthToken = require('../middleware/authMiddleware');
const {
    scheduleInterview,
    getInterviews,
    getInterviewById,
    getInterviewByToken,
    updateInterviewStatus,
    submitInterviewFeedback,
    getInterviewFeedbackForm,
    cancelInterview,
    sendInterviewReminder
} = require('../controllers/interview');

/**
 * @swagger
 * tags:
 *   name: Interview
 *   description: Interview scheduling and feedback management
 */

/**
 * @swagger
 * /interview:
 *   get:
 *     summary: Get all interviews with optional filters
 *     tags: [Interview]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Scheduled, In Progress, Completed, Cancelled, Rescheduled, No Show]
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: interviewType
 *         schema:
 *           type: string
 *           enum: [HR Round, Technical Round, Client Interview, Phone Screening, Final Round]
 *       - in: query
 *         name: candidateId
 *         schema:
 *           type: string
 *       - in: query
 *         name: positionId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of interviews with stats
 */
router.get('/', verifyAuthToken, getInterviews);

/**
 * @swagger
 * /interview/schedule:
 *   post:
 *     summary: Schedule a new interview (sends automatic email to candidate)
 *     tags: [Interview]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - candidateId
 *               - positionId
 *               - clientId
 *               - interviewType
 *               - interviewDate
 *               - startTime
 *               - interviewerName
 *             properties:
 *               candidateId:
 *                 type: string
 *               positionId:
 *                 type: string
 *               clientId:
 *                 type: string
 *               interviewType:
 *                 type: string
 *                 enum: [HR Round, Technical Round, Client Interview, Phone Screening, Final Round]
 *               interviewDate:
 *                 type: string
 *                 format: date
 *               startTime:
 *                 type: string
 *                 example: "10:00 AM"
 *               duration:
 *                 type: integer
 *                 default: 45
 *               meetingType:
 *                 type: string
 *                 enum: [Video, In-Person, Phone]
 *                 default: Video
 *               interviewerId:
 *                 type: string
 *               interviewerType:
 *                 type: string
 *                 enum: [TeamLeader, DepartmentTeam, Client]
 *               interviewerName:
 *                 type: string
 *               interviewerEmail:
 *                 type: string
 *               interviewerRole:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Interview scheduled and email sent
 *       404:
 *         description: Candidate or position not found
 */
router.post('/schedule', verifyAuthToken, scheduleInterview);

/**
 * @swagger
 * /interview/join/{token}:
 *   get:
 *     summary: Get interview details by meeting token (for candidate access)
 *     tags: [Interview]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Interview details for candidate
 *       404:
 *         description: Invalid meeting link
 */
router.get('/join/:token', getInterviewByToken);

/**
 * @swagger
 * /interview/{id}:
 *   get:
 *     summary: Get interview by ID
 *     tags: [Interview]
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
 *         description: Interview details
 *       404:
 *         description: Interview not found
 */
router.get('/:id', verifyAuthToken, getInterviewById);

/**
 * @swagger
 * /interview/{id}/status:
 *   put:
 *     summary: Update interview status
 *     tags: [Interview]
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
 *                 enum: [Scheduled, In Progress, Completed, Cancelled, Rescheduled, No Show]
 *               rescheduleReason:
 *                 type: string
 *               newDate:
 *                 type: string
 *                 format: date
 *               newTime:
 *                 type: string
 *     responses:
 *       200:
 *         description: Interview status updated
 */
router.put('/:id/status', verifyAuthToken, updateInterviewStatus);

/**
 * @swagger
 * /interview/{id}/feedback-form:
 *   get:
 *     summary: Get interview feedback form with candidate details
 *     tags: [Interview]
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
 *         description: Feedback form with candidate and evaluation criteria
 */
router.get('/:id/feedback-form', verifyAuthToken, getInterviewFeedbackForm);

/**
 * @swagger
 * /interview/{id}/feedback:
 *   post:
 *     summary: Submit interview feedback/evaluation
 *     tags: [Interview]
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
 *               - skills
 *               - attitude
 *               - knowledge
 *               - communication
 *               - behavior
 *               - recommendation
 *             properties:
 *               skills:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 description: Technical skills rating
 *               attitude:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 description: Attitude rating
 *               knowledge:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 description: Domain knowledge rating
 *               communication:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 description: Communication skills rating
 *               behavior:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 description: Professional behavior rating
 *               overallRating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 description: Overall rating (auto-calculated if not provided)
 *               strengths:
 *                 type: string
 *               weaknesses:
 *                 type: string
 *               recommendation:
 *                 type: string
 *                 enum: [Strongly Recommend, Recommend, Neutral, Not Recommend, Strongly Not Recommend]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Feedback submitted successfully
 */
router.post('/:id/feedback', verifyAuthToken, submitInterviewFeedback);

/**
 * @swagger
 * /interview/{id}/remind:
 *   post:
 *     summary: Send interview reminder email to candidate
 *     tags: [Interview]
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
 *         description: Reminder sent successfully
 */
router.post('/:id/remind', verifyAuthToken, sendInterviewReminder);

/**
 * @swagger
 * /interview/{id}:
 *   delete:
 *     summary: Cancel an interview
 *     tags: [Interview]
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
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Interview cancelled
 */
router.delete('/:id', verifyAuthToken, cancelInterview);

module.exports = router;
