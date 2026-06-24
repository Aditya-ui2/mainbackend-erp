const express = require('express');
const verifyAuthToken = require('../middleware/authMiddleware');
const { authorize, clientIsolation } = require('../middleware/authMiddleware');
const {
    getClientReviews,
    createClientReview,
    updateClientReview,
    deleteClientReview,
    getClientReviewStats
} = require('../controllers/clientReview');

const router = express.Router();

// Get review statistics for a client (must come BEFORE :clientId route)
router.get('/stats/:clientId', verifyAuthToken, authorize('superadmin', 'admin', 'crm', 'manager', 'teamleader', 'employee', 'client'), clientIsolation, getClientReviewStats);

// Create a new client review
router.post('/', verifyAuthToken, authorize('superadmin', 'admin', 'crm', 'manager', 'teamleader', 'employee', 'client'), clientIsolation, createClientReview);

// Get all reviews for a client
router.get('/:clientId', verifyAuthToken, authorize('superadmin', 'admin', 'crm', 'manager', 'teamleader', 'employee', 'client'), clientIsolation, getClientReviews);

// Update a client review
router.put('/:reviewId', verifyAuthToken, authorize('superadmin', 'admin', 'crm', 'manager', 'teamleader'), updateClientReview);

// Delete a client review
router.delete('/:reviewId', verifyAuthToken, authorize('superadmin', 'admin', 'crm', 'manager'), deleteClientReview);

module.exports = router;
