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

router.post('/create', createHandover);
router.get('/all', getHandovers);
router.put('/update/:id', updateHandover);
router.put('/status/:id', changeHandoverStatus);
router.delete('/delete/:id', deleteHandover);
router.get('/client/:clientId', getActiveHandoverForClient);

module.exports = router;
