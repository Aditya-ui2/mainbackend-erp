const express = require('express');
const router = express.Router();
const {
    createHandover,
    getHandovers,
    updateHandover,
    changeHandoverStatus,
    deleteHandover,
    getActiveHandoverForClient
} = require('../controllers/workHandover');
const { protect } = require('../middleware/authMiddleware');

// All work handover routes require authentication
router.use(protect);

/**
 * @swagger
 * tags:
 *   name: WorkHandover
 *   description: Work Handover management - Client transition/handover tracking
 */

/**
 * @swagger
 * /workHandover/create:
 *   post:
 *     summary: Create a work handover
 *     tags: [WorkHandover]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clientId
 *               - fromUserId
 *               - toUserId
 *             properties:
 *               clientId:
 *                 type: string
 *               fromUserId:
 *                 type: string
 *               toUserId:
 *                 type: string
 *               reason:
 *                 type: string
 *               notes:
 *                 type: string
 *               handoverDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Handover created
 */
router.post('/create', createHandover);

/**
 * @swagger
 * /workHandover/all:
 *   get:
 *     summary: Get all handovers
 *     tags: [WorkHandover]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: ['Pending', 'InProgress', 'Completed', 'Cancelled']
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of handovers
 */
router.get('/all', getHandovers);

/**
 * @swagger
 * /workHandover/update/{id}:
 *   put:
 *     summary: Update handover details
 *     tags: [WorkHandover]
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
 *     responses:
 *       200:
 *         description: Handover updated
 */
router.put('/update/:id', updateHandover);

/**
 * @swagger
 * /workHandover/status/{id}:
 *   put:
 *     summary: Change handover status
 *     tags: [WorkHandover]
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
 *                 enum: ['Pending', 'InProgress', 'Completed', 'Cancelled']
 *     responses:
 *       200:
 *         description: Status updated
 */
router.put('/status/:id', changeHandoverStatus);

/**
 * @swagger
 * /workHandover/delete/{id}:
 *   delete:
 *     summary: Delete handover
 *     tags: [WorkHandover]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Handover deleted
 */
router.delete('/delete/:id', deleteHandover);

/**
 * @swagger
 * /workHandover/client/{clientId}:
 *   get:
 *     summary: Get active handover for a client
 *     tags: [WorkHandover]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Active handover details
 */
router.get('/client/:clientId', getActiveHandoverForClient);

module.exports = router;
