const express = require('express');
const router = express.Router();
const {
    createWorkAgreement,
    getWorkAgreements,
    getWorkAgreementById,
    updateWorkAgreement,
    deleteWorkAgreement,
    getAgreementSummary
} = require('../controllers/workAgreement');

/**
 * @swagger
 * tags:
 *   name: WorkAgreement
 *   description: Work Agreement management - Client service agreements
 */

/**
 * @swagger
 * /workAgreement/create:
 *   post:
 *     summary: Create a new work agreement
 *     tags: [WorkAgreement]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clientId
 *               - startDate
 *             properties:
 *               clientId:
 *                 type: string
 *               services:
 *                 type: array
 *                 items:
 *                   type: object
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               value:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [Draft, Active, Expired, Terminated]
 *     responses:
 *       201:
 *         description: Agreement created
 */
router.post('/create', createWorkAgreement);

/**
 * @swagger
 * /workAgreement/all:
 *   get:
 *     summary: Get all work agreements
 *     tags: [WorkAgreement]
 *     parameters:
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Draft, Active, Expired, Terminated]
 *     responses:
 *       200:
 *         description: List of agreements
 */
router.get('/all', getWorkAgreements);

/**
 * @swagger
 * /workAgreement/summary:
 *   get:
 *     summary: Get agreement summary statistics
 *     tags: [WorkAgreement]
 *     responses:
 *       200:
 *         description: Agreement summary
 */
router.get('/summary', getAgreementSummary);

/**
 * @swagger
 * /workAgreement/{id}:
 *   get:
 *     summary: Get work agreement by ID
 *     tags: [WorkAgreement]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Agreement details
 */
router.get('/:id', getWorkAgreementById);

/**
 * @swagger
 * /workAgreement/update:
 *   put:
 *     summary: Update work agreement
 *     tags: [WorkAgreement]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - agreementId
 *             properties:
 *               agreementId:
 *                 type: string
 *               services:
 *                 type: array
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Agreement updated
 */
router.put('/update', updateWorkAgreement);

/**
 * @swagger
 * /workAgreement/delete:
 *   delete:
 *     summary: Delete work agreement
 *     tags: [WorkAgreement]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - agreementId
 *             properties:
 *               agreementId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Agreement deleted
 */
router.delete('/delete', deleteWorkAgreement);

module.exports = router;
