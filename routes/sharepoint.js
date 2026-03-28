/**
 * SharePoint Routes
 * API endpoints for SharePoint integration
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  testConnection,
  syncCandidates,
  syncInterviews,
  syncClients,
  syncAll,
  updateCandidate,
  getLists,
  getListItems,
  getSavedCandidates,
  getSavedInterviews,
  getSavedClients,
  getSyncLogs,
} = require('../controllers/sharepoint');
const { protect, authorize } = require('../middleware/authMiddleware');

// Rate limit for SharePoint sync operations (heavy API calls)
const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 sync requests per 15 min
  message: { success: false, message: 'Too many sync requests, please try again later' }
});

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
router.get('/test', authorize('superadmin', 'admin', 'kam'), testConnection);

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
router.get('/lists', authorize('superadmin', 'admin', 'kam'), getLists);

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
router.get('/lists/:listId/items', authorize('superadmin', 'admin', 'kam'), getListItems);

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
router.get('/sync/candidates', syncLimiter, authorize('superadmin', 'admin', 'kam'), syncCandidates);

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
router.get('/sync/interviews', syncLimiter, authorize('superadmin', 'admin', 'kam'), syncInterviews);

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
router.get('/sync/clients', syncLimiter, authorize('superadmin', 'admin', 'kam'), syncClients);

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
router.post('/sync/all', syncLimiter, authorize('superadmin', 'admin'), syncAll);

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
router.put('/candidates/:sharePointId', authorize('superadmin', 'admin', 'kam'), updateCandidate);

// ═══════════════════════════════════════════
// LOCAL DATABASE ENDPOINTS (saved SharePoint data)
// ═══════════════════════════════════════════

/**
 * @swagger
 * /sharepoint/data/candidates:
 *   get:
 *     summary: Get saved candidates from local database
 *     tags: [SharePoint]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: client
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Saved candidates with pagination
 */
router.get('/data/candidates', authorize('superadmin', 'admin', 'kam', 'employee'), getSavedCandidates);

/**
 * @swagger
 * /sharepoint/data/interviews:
 *   get:
 *     summary: Get saved interviews from local database
 *     tags: [SharePoint]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Saved interviews with pagination
 */
router.get('/data/interviews', authorize('superadmin', 'admin', 'kam', 'employee'), getSavedInterviews);

/**
 * @swagger
 * /sharepoint/data/clients:
 *   get:
 *     summary: Get saved clients from local database
 *     tags: [SharePoint]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Saved SharePoint clients
 */
router.get('/data/clients', authorize('superadmin', 'admin', 'kam'), getSavedClients);

/**
 * @swagger
 * /sharepoint/sync-logs:
 *   get:
 *     summary: Get sync history logs
 *     tags: [SharePoint]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of sync logs
 */
router.get('/sync-logs', authorize('superadmin', 'admin'), getSyncLogs);

module.exports = router;
