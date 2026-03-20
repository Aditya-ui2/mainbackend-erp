const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const {
    getKamsWithRecruitment,
    createRecruitmentPosition,
    updateRecruitmentPosition,
    addCandidate,
    updateCandidateStatus,
    getCandidatesByPosition,
    getRecruitmentStats
} = require('../controllers/recruitment');

// KAM Routes
router.get('/kams', authMiddleware, getKamsWithRecruitment);

// Position Routes
router.post('/positions', authMiddleware, createRecruitmentPosition);
router.put('/positions/:id', authMiddleware, updateRecruitmentPosition);

// Candidate Routes
router.post('/candidates', authMiddleware, addCandidate);
router.put('/candidates/:id/status', authMiddleware, updateCandidateStatus);
router.get('/positions/:positionId/candidates', authMiddleware, getCandidatesByPosition);

// Stats Route
router.get('/stats', authMiddleware, getRecruitmentStats);

module.exports = router;
