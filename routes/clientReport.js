const express = require('express');
const router = express.Router();
const reportController = require('../controllers/clientReport');

router.get('/all', reportController.getAllReports);
router.post('/create', reportController.createReport);
router.post('/seed', reportController.seedReports);

module.exports = router;
