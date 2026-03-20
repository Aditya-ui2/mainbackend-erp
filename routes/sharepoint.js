/**
 * SharePoint Routes
 * API endpoints for SharePoint integration
 */

const express = require('express');
const router = express.Router();
const {
  testConnection,
  syncCandidates,
  syncInterviews,
  syncClients,
  syncAll,
  updateCandidate,
  getLists,
  getListItems,
} = require('../controllers/sharepoint');
const { protect, authorize } = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: SharePoint
 *   description: SharePoint integration - Sync data from Microsoft SharePoint
 */

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /sharepoint/test:
 *   get:
 *     summary: Test SharePoint connection
 *     tags: [SharePoint]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Connection successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 siteId:
 *                   type: string
 *                 availableLists:
 *                   type: array
 *       500:
 *         description: Connection failed
 */
router.get('/test', authorize('admin', 'kam'), testConnection);

/**
 * @swagger
 * /sharepoint/lists:
 *   get:
 *     summary: Get all SharePoint lists
 *     tags: [SharePoint]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of SharePoint lists
 */
router.get('/lists', authorize('admin', 'kam'), getLists);

/**
 * @swagger
 * /sharepoint/lists/{listId}/items:
 *   get:
 *     summary: Get items from a SharePoint list
 *     tags: [SharePoint]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List items
 */
router.get('/lists/:listId/items', authorize('admin', 'kam'), getListItems);

/**
 * @swagger
 * /sharepoint/sync/candidates:
 *   get:
 *     summary: Sync candidates from SharePoint
 *     tags: [SharePoint]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: listName
 *         schema:
 *           type: string
 *           default: Candidates
 *     responses:
 *       200:
 *         description: Candidates synced successfully
 */
router.get('/sync/candidates', authorize('admin', 'kam'), syncCandidates);

/**
 * @swagger
 * /sharepoint/sync/interviews:
 *   get:
 *     summary: Sync interviews from SharePoint
 *     tags: [SharePoint]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: listName
 *         schema:
 *           type: string
 *           default: Interviews
 *     responses:
 *       200:
 *         description: Interviews synced successfully
 */
router.get('/sync/interviews', authorize('admin', 'kam'), syncInterviews);

/**
 * @swagger
 * /sharepoint/sync/clients:
 *   get:
 *     summary: Sync clients from SharePoint
 *     tags: [SharePoint]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: listName
 *         schema:
 *           type: string
 *           default: Clients
 *     responses:
 *       200:
 *         description: Clients synced successfully
 */
router.get('/sync/clients', authorize('admin', 'kam'), syncClients);

/**
 * @swagger
 * /sharepoint/sync/all:
 *   post:
 *     summary: Sync all data from SharePoint (candidates, interviews, clients)
 *     tags: [SharePoint]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Full sync completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 candidates:
 *                   type: object
 *                 interviews:
 *                   type: object
 *                 clients:
 *                   type: object
 */
router.post('/sync/all', authorize('admin', 'kam'), syncAll);

/**
 * @swagger
 * /sharepoint/candidates/{sharePointId}:
 *   put:
 *     summary: Update candidate in SharePoint
 *     tags: [SharePoint]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sharePointId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               stage:
 *                 type: string
 *               status:
 *                 type: string
 *               assignedTo:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Candidate updated in SharePoint
 */
router.put('/candidates/:sharePointId', authorize('admin', 'kam', 'employee'), updateCandidate);

module.exports = router;
