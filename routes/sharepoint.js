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

// All routes require authentication
router.use(protect);

// Test connection
router.get('/test', authorize('admin', 'kam'), testConnection);

// Get SharePoint lists
router.get('/lists', authorize('admin', 'kam'), getLists);
router.get('/lists/:listId/items', authorize('admin', 'kam'), getListItems);

// Sync routes
router.get('/sync/candidates', authorize('admin', 'kam'), syncCandidates);
router.get('/sync/interviews', authorize('admin', 'kam'), syncInterviews);
router.get('/sync/clients', authorize('admin', 'kam'), syncClients);
router.post('/sync/all', authorize('admin', 'kam'), syncAll);

// Update routes (push back to SharePoint)
router.put('/candidates/:sharePointId', authorize('admin', 'kam', 'employee'), updateCandidate);

module.exports = router;
