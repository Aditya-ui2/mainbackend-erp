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

// CRUD
router.post('/create', createWorkAgreement);
router.get('/all', getWorkAgreements);      // ?clientId=...&status=Active
router.get('/summary', getAgreementSummary);
router.get('/:id', getWorkAgreementById);
router.put('/update', updateWorkAgreement);
router.delete('/delete', deleteWorkAgreement);

module.exports = router;
