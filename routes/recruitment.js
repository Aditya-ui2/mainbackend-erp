const express = require('express');
const router = express.Router();
const verifyAuthToken = require('../middleware/authMiddleware');
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
router.get('/kams', verifyAuthToken, getKamsWithRecruitment);

// Position Routes
router.post('/positions', verifyAuthToken, createRecruitmentPosition);
router.put('/positions/:id', verifyAuthToken, updateRecruitmentPosition);

// Candidate Routes
router.post('/candidates', verifyAuthToken, addCandidate);
router.put('/candidates/:id/status', verifyAuthToken, updateCandidateStatus);
router.get('/positions/:positionId/candidates', verifyAuthToken, getCandidatesByPosition);

// Stats Route
router.get('/stats', verifyAuthToken, getRecruitmentStats);

module.exports = router;
