const { ClientReport, Client } = require('../models/sequelizeModels');

// Get all reports
exports.getAllReports = async (req, res) => {
    try {
        const reports = await ClientReport.findAll({
            order: [['createdAt', 'DESC']]
        });
        res.status(200).json({ success: true, data: reports });
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch reports' });
    }
};

// Create a report
exports.createReport = async (req, res) => {
    try {
        const { reportName, clientId, status, size, fileUrl } = req.body;
        const client = await Client.findByPk(clientId);
        if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

        const reportNumber = `R-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 899)}`;
        
        const report = await ClientReport.create({
            reportName,
            reportNumber,
            clientId,
            companyName: client.companyName || client.name,
            size: size || "1.0 MB",
            status: status || "PENDING",
            fileUrl
        });

        res.status(201).json({ success: true, data: report });
    } catch (error) {
        console.error('Error creating report:', error);
        res.status(500).json({ success: false, message: 'Failed to create report' });
    }
};

// Seed initial reports
exports.seedReports = async (req, res) => {
    try {
        const clients = await Client.findAll({ limit: 5 });
        if (clients.length === 0) return res.status(400).json({ message: 'No clients found to seed reports' });

        const reportNames = [
            'Monthly Performance', 'Strategy Review', 'Audit Sync', 'Quarterly Analysis', 'Onboarding Report'
        ];

        for (let i = 0; i < reportNames.length; i++) {
            const client = clients[i % clients.length];
            const reportNumber = `R-2024-00${i + 1}`;
            
            await ClientReport.findOrCreate({
                where: { reportNumber },
                defaults: {
                    reportName: reportNames[i],
                    reportNumber,
                    clientId: client.id,
                    companyName: client.companyName || client.name,
                    size: `${(Math.random() * 5).toFixed(1)} MB`,
                    status: ['VERIFIED', 'PENDING', 'DRAFT'][Math.floor(Math.random() * 3)]
                }
            });
        }
        res.status(200).json({ success: true, message: 'Reports seeded successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
