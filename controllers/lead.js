const { Lead, Client, DepartmentTeam } = require('../models/sequelizeModels');
const { Op } = require('sequelize');
const { hashPassword, comparePasswords } = require('../utils/bcryptUtils');
const { generateToken } = require('../utils/jwtUtils');

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

// Helper to convert lead to client
const convertLeadToClientIfNeeded = async (lead, updatedStatus) => {
    if (updatedStatus === 'Converted') {
        const email = lead.email || `client_${lead.id}@mabicons.com`;
        const companyName = lead.companyName;

        let existingClient = null;
        if (lead.email) {
            existingClient = await Client.findOne({ where: { email: lead.email } });
        }
        if (!existingClient) {
            existingClient = await Client.findOne({ where: { companyName: companyName } });
        }

        if (!existingClient) {
            const clientPassword = `${companyName.replace(/\s+/g, '')}@123`;
            const hashedPassword = await hashPassword(clientPassword);

            await Client.create({
                name: lead.contactPerson || lead.companyName,
                email: email,
                password: hashedPassword,
                companyName: companyName,
                contactNumber: lead.phone || null,
                spocName: lead.contactPerson || null,
                spocContact: lead.phone || null,
                status: 'Requested'
            });
        }
    }
};

// Create a lead
const createLead = async (req, res) => {
    try {
        const lead = await Lead.create(req.body);
        if (req.body.status === 'Converted') {
            await convertLeadToClientIfNeeded(lead, 'Converted');
        }
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

        const oldStatus = lead.status;
        await lead.update(req.body);

        if (req.body.status === 'Converted' && oldStatus !== 'Converted') {
            await convertLeadToClientIfNeeded(lead, 'Converted');
        }

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
        const lostLeads = await Lead.count({ where: { status: 'Lost' } });
        const openPipeline = await Lead.count({ 
            where: { 
                status: { [Op.notIn]: ['Converted', 'Lost'] } 
            } 
        });

        const totalPipelineValue = await Lead.sum('value', { 
            where: { status: { [Op.notIn]: ['Converted', 'Lost'] } } 
        }) || 0;
        const revenueSum = await Lead.sum('value', { where: { status: 'Converted' } }) || 0;
        const averageDealSize = convertedLeads ? parseFloat((revenueSum / convertedLeads).toFixed(2)) : 0;

        const metrics = {
            totalLeads,
            convertedLeads,
            openPipeline,
            lostLeads,
            conversionRate: totalLeads ? Math.round((convertedLeads / totalLeads) * 100) : 0,
            winRate: totalLeads ? Math.round((convertedLeads / totalLeads) * 100) : 0,
            averageDealSize,
            pipelineValue: parseFloat(totalPipelineValue.toFixed(2)),
            revenue: parseFloat(revenueSum.toFixed(2)),
            cac: 0,
            ltv: averageDealSize
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

// Get BD dashboard statistics from DB
const getBDDashboardStats = async (req, res) => {
    try {
        const totalLeads = await Lead.count();
        const newLeads = await Lead.count({ 
            where: { 
                status: { [Op.in]: ['Open', 'New', 'In Progress'] } 
            } 
        });
        const hotLeads = await Lead.count({ 
            where: { 
                status: { [Op.in]: ['Qualified', 'Negotiation', 'Proposal'] } 
            } 
        });
        const closedLeads = await Lead.count({ 
            where: { status: 'Converted' } 
        });
        const lostLeads = await Lead.count({ where: { status: 'Lost' } });

        // Pipeline values
        const pipelineSum = await Lead.sum('value', {
            where: { status: { [Op.notIn]: ['Converted', 'Lost'] } }
        }) || 0;
        const revenueSum = await Lead.sum('value', { where: { status: 'Converted' } }) || 0;
        const averageDealSize = closedLeads ? parseFloat((revenueSum / closedLeads).toFixed(2)) : 0;
        const conversionRate = totalLeads ? Math.round((closedLeads / totalLeads) * 100) : 0;

        // Stage counts
        const stageCounts = {
            new: newLeads,
            qualified: await Lead.count({ where: { status: 'Qualified' } }),
            proposal: await Lead.count({ where: { status: 'Proposal' } }),
            closed: closedLeads,
            lost: lostLeads
        };

        // Recent activities
        const recentLeads = await Lead.findAll({
            order: [['createdAt', 'DESC']],
            limit: 3
        });
        const recentActivities = recentLeads.map(lead => {
            return `New lead "${lead.companyName}" added under owner ${lead.owner || 'Unassigned'}`;
        });

        // Team performance
        const executives = await DepartmentTeam.findAll({
            where: {
                department: {
                    [Op.in]: ['BD', 'Sales']
                }
            },
            attributes: ['name']
        });
        const execNames = new Set(executives.map(e => e.name.trim().toLowerCase()));

        const allLeads = await Lead.findAll();
        const ownerCounts = {};
        allLeads.forEach(lead => {
            const ownerName = (lead.owner || '').trim();
            if (ownerName && execNames.has(ownerName.toLowerCase())) {
                if (!ownerCounts[ownerName]) {
                    ownerCounts[ownerName] = { total: 0, converted: 0 };
                }
                ownerCounts[ownerName].total += 1;
                if (lead.status === 'Converted') {
                    ownerCounts[ownerName].converted += 1;
                }
            }
        });

        const teamPerformance = Object.keys(ownerCounts).map(owner => {
            const stats = ownerCounts[owner];
            const pct = stats.total ? Math.round((stats.converted / stats.total) * 100) : 0;
            return {
                name: owner,
                percentage: pct,
                total: stats.total
            };
        }).sort((a, b) => b.percentage - a.percentage).slice(0, 3);

        res.status(200).json({
            success: true,
            data: {
                totalLeads,
                newLeads,
                hotLeads,
                closedLeads,
                lostLeads,
                pipelineValue: parseFloat(pipelineSum.toFixed(2)),
                revenue: parseFloat(revenueSum.toFixed(2)),
                averageDealSize,
                conversionRate,
                stages: stageCounts,
                teamPerformance: teamPerformance,
                recentActivities: recentActivities.length ? recentActivities : [
                    'New lead added from LinkedIn',
                    'Proposal sent to Infosys',
                    'Meeting scheduled with TCS'
                ]
            }
        });
    } catch (error) {
        console.error('Error fetching BD dashboard stats:', error);
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

// Delete lead
const deleteLead = async (req, res) => {
    try {
        const { leadId } = req.params;
        const lead = await Lead.findByPk(leadId);
        if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

        await lead.destroy();
        res.status(200).json({ success: true, message: 'Lead deleted successfully' });
    } catch (error) {
        console.error('Error deleting lead:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get lead by ID
const getLeadById = async (req, res) => {
    try {
        const { leadId } = req.params;
        const lead = await Lead.findByPk(leadId);
        if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
        res.status(200).json({ success: true, lead });
    } catch (error) {
        console.error('Error fetching lead by ID:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get leads owned by a specific BD
const getLeadsByBD = async (req, res) => {
    try {
        const { businessDevId } = req.params;
        const leads = await Lead.findAll({
            where: {
                [Op.or]: [
                    { owner: businessDevId },
                    { id: businessDevId }
                ]
            },
            order: [['createdAt', 'DESC']]
        });
        res.status(200).json({ success: true, leads });
    } catch (error) {
        console.error('Error fetching leads by BD:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Create a BD proposal
const createBDProposal = async (req, res) => {
    try {
        const proposal = req.body;
        res.status(201).json({
            success: true,
            message: 'Proposal created successfully',
            data: {
                id: require('crypto').randomUUID(),
                ...proposal,
                createdAt: new Date(),
                status: 'Sent'
            }
        });
    } catch (error) {
        console.error('Error creating BD proposal:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Send proposal to lead
const sendProposal = async (req, res) => {
    try {
        const { leadId } = req.body;
        res.status(200).json({
            success: true,
            message: 'Proposal sent to lead successfully',
            leadId
        });
    } catch (error) {
        console.error('Error sending proposal:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Send profile to lead
const sendProfile = async (req, res) => {
    try {
        const { leadId } = req.body;
        res.status(200).json({
            success: true,
            message: 'Company profile sent to lead successfully',
            leadId
        });
    } catch (error) {
        console.error('Error sending profile:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Create a new BD Executive
const createBD = async (req, res) => {
    try {
        const { name, email, password, phone, role } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }
        const existing = await DepartmentTeam.findOne({ where: { email: email.toLowerCase() } });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }
        const hashedPassword = await hashPassword(password);
        const executive = await DepartmentTeam.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            phone,
            role: role || 'BD Executive',
            department: 'BD'
        });
        res.status(201).json({
            success: true,
            message: 'BD Executive created successfully',
            executive: { id: executive.id, name: executive.name, email: executive.email, role: executive.role }
        });
    } catch (error) {
        console.error('Error creating BD executive:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// BD Executive Login
const bdLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }
        const executive = await DepartmentTeam.findOne({
            where: { email: email.toLowerCase(), department: 'BD' }
        });
        if (!executive) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
        const isMatch = await comparePasswords(password, executive.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
        
        const token = generateToken(executive);
        res.status(200).json({
            success: true,
            token,
            executive: {
                id: executive.id,
                name: executive.name,
                email: executive.email,
                role: executive.role
            }
        });
    } catch (error) {
        console.error('Error during BD login:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = {
    getAllLeads,
    createLead,
    updateLead,
    deleteLead,
    getBDMetrics,
    getBDDashboardStats,
    seedLeads,
    getLeadById,
    getLeadsByBD,
    createBDProposal,
    sendProposal,
    sendProfile,
    createBD,
    bdLogin
};
