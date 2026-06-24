const { Campaign } = require('../models/sequelizeModels');

// Get all campaigns (optionally filtered by type)
const getAllCampaigns = async (req, res) => {
    try {
        const { type } = req.query;
        const where = type ? { type } : {};
        const campaigns = await Campaign.findAll({ where, order: [['createdAt', 'DESC']] });
        res.status(200).json({ success: true, campaigns });
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Create a new campaign
const createCampaign = async (req, res) => {
    try {
        const campaign = await Campaign.create(req.body);
        res.status(201).json({ success: true, data: campaign });
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Update a campaign
const updateCampaign = async (req, res) => {
    try {
        const { campaignId } = req.params;
        const campaign = await Campaign.findByPk(campaignId);
        if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
        await campaign.update(req.body);
        res.status(200).json({ success: true, data: campaign });
    } catch (error) {
        console.error('Error updating campaign:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Delete a campaign
const deleteCampaign = async (req, res) => {
    try {
        const { campaignId } = req.params;
        const campaign = await Campaign.findByPk(campaignId);
        if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
        await campaign.destroy();
        res.status(200).json({ success: true, message: 'Campaign deleted successfully' });
    } catch (error) {
        console.error('Error deleting campaign:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = { getAllCampaigns, createCampaign, updateCampaign, deleteCampaign };
