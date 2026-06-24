const express = require('express');
const router = express.Router();
const verifyAuthToken = require('../middleware/authMiddleware');
const { getAllCampaigns, createCampaign, updateCampaign, deleteCampaign } = require('../controllers/campaign');

router.get('/', verifyAuthToken, getAllCampaigns);
router.post('/', verifyAuthToken, createCampaign);
router.put('/:campaignId', verifyAuthToken, updateCampaign);
router.delete('/:campaignId', verifyAuthToken, deleteCampaign);

module.exports = router;
