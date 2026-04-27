const { Lead, Client } = require('../models/sequelizeModels');
const { Op } = require('sequelize');

// Get all leads
const getAllLeads = async (req, res) => {
    try {
        const leads = await Lead.findAll({
            order: [['createdAt', 'DESC']]
        });
        res.status(200).json({
            success: true,
            leads
        });
    } catch (error) {
        console.error('Error fetching leads:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Create a lead
const createLead = async (req, res) => {
    try {
        const lead = await Lead.create(req.body);
        res.status(201).json({
            success: true,
            data: lead
        });
    } catch (error) {
        console.error('Error creating lead:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Update lead status
const updateLead = async (req, res) => {
    try {
        const { leadId } = req.params;
        const lead = await Lead.findByPk(leadId);
        if (!lead) return res.status(404).json({ message: 'Lead not found' });

        await lead.update(req.body);
        res.status(200).json({ success: true, data: lead });
    } catch (error) {
        console.error('Error updating lead:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get BD metrics
const getBDMetrics = async (req, res) => {
    try {
        const totalLeads = await Lead.count();
        const convertedLeads = await Lead.count({ where: { status: 'Converted' } });
        const openPipeline = await Lead.count({ 
            where: { 
                status: { [Op.notIn]: ['Converted', 'Lost'] } 
            } 
        });

        const metrics = {
            totalLeads,
            convertedLeads,
            openPipeline,
            conversionRate: totalLeads ? Math.round((convertedLeads / totalLeads) * 100) : 0,
            cac: 1250, // Mock for now or calculate if data exists
            ltv: 8500  // Mock for now
        };

        res.status(200).json({
            success: true,
            data: metrics
        });
    } catch (error) {
        console.error('Error fetching BD metrics:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Seed leads for demo
const seedLeads = async (req, res) => {
    try {
        const existingCount = await Lead.count();
        if (existingCount > 0) {
            return res.status(200).json({ message: 'Leads already seeded' });
        }

        const mockLeads = [
            {
                companyName: "Tech Corp",
                contactPerson: "John Doe",
                email: "john@techcorp.com",
                phone: "9876543210",
                value: 50000,
                status: "Proposal",
                segment: "IT Services",
                owner: "Sanya Gupta"
            },
            {
                companyName: "Green Energy Ltd",
                contactPerson: "Alice Smith",
                email: "alice@greenenergy.com",
                phone: "8887776665",
                value: 75000,
                status: "Negotiation",
                segment: "Renewables",
                owner: "Rahul Mehta"
            },
            {
                companyName: "Global Logistics",
                contactPerson: "Bob Johnson",
                email: "bob@globallog.com",
                phone: "7776665554",
                value: 30000,
                status: "Converted",
                segment: "Logistics",
                owner: "Sanya Gupta"
            },
            {
                companyName: "Future Retail",
                contactPerson: "Emma Wilson",
                email: "emma@futureretail.com",
                phone: "6665554443",
                value: 20000,
                status: "In Progress",
                segment: "Retail",
                owner: "Rahul Mehta"
            }
        ];

        await Lead.bulkCreate(mockLeads);
        res.status(201).json({ message: 'Leads seeded successfully' });
    } catch (error) {
        console.error('Error seeding leads:', error);
        res.status(500).json({ message: 'Error seeding leads' });
    }
};

module.exports = {
    getAllLeads,
    createLead,
    updateLead,
    getBDMetrics,
    seedLeads
};
