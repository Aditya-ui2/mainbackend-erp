const { ClientAccount, Invoice, Client } = require('../models/sequelizeModels');

// Get all client accounts summary
exports.getClientAccounts = async (req, res) => {
    try {
        const accounts = await ClientAccount.findAll({
            order: [['companyName', 'ASC']]
        });

        // Calculate totals for stat cards
        const totalOutstanding = accounts.reduce((sum, acc) => sum + parseFloat(acc.totalOutstanding || 0), 0);
        const totalCleared = accounts.reduce((sum, acc) => sum + parseFloat(acc.clearedAmount || 0), 0);
        const overdueCount = accounts.filter(acc => acc.status === 'Overdue').length;

        res.status(200).json({
            success: true,
            data: accounts,
            summary: {
                totalOutstanding,
                totalCleared,
                overdueCount
            }
        });
    } catch (error) {
        console.error('Error fetching client accounts:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch accounts' });
    }
};

// Get specific account details and invoices
exports.getAccountDetails = async (req, res) => {
    try {
        const { clientId } = req.params;
        const account = await ClientAccount.findOne({ 
            where: { clientId },
            include: [{
                model: Client,
                as: 'client',
                attributes: ['spocName', 'email', 'contactNumber', 'corporateAddress', 'gstNumber', 'panNumber', 'category', 'status']
            }]
        });
        const invoices = await Invoice.findAll({ 
            where: { clientId },
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            success: true,
            data: {
                account,
                invoices
            }
        });
    } catch (error) {
        console.error('Error fetching account details:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch account details' });
    }
};

// Create an invoice (stub for now)
exports.createInvoice = async (req, res) => {
    try {
        const { clientId, amount, dueDate, items } = req.body;
        const client = await Client.findByPk(clientId);
        
        if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

        const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const totalAmount = amount; // Simple logic for now

        const invoice = await Invoice.create({
            invoiceNumber,
            clientId,
            companyName: client.companyName,
            amount,
            totalAmount,
            dueDate,
            items,
            status: 'Sent'
        });

        // Update ClientAccount
        let account = await ClientAccount.findOne({ where: { clientId } });
        if (!account) {
            account = await ClientAccount.create({
                clientId,
                companyName: client.companyName,
                totalOutstanding: totalAmount,
                status: 'Pending',
                lastInvoiceNumber: invoiceNumber
            });
        } else {
            account.totalOutstanding = parseFloat(account.totalOutstanding) + parseFloat(totalAmount);
            account.lastInvoiceNumber = invoiceNumber;
            account.pendingInvoicesCount += 1;
            account.status = 'Pending';
            await account.save();
        }

        res.status(201).json({ success: true, data: invoice });
    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({ success: false, message: 'Failed to create invoice' });
    }
};

// Seed initial data if needed
exports.seedFinanceData = async (req, res) => {
    try {
        const clients = await Client.findAll();
        if (clients.length === 0) return res.status(400).json({ message: 'No clients found to seed' });

        for (const client of clients) {
            let account = await ClientAccount.findOne({ where: { clientId: client.id } });
            
            const totalOutstanding = Math.floor(Math.random() * 400000) + 50000;
            const clearedAmount = Math.floor(Math.random() * (totalOutstanding * 0.7));
            const status = ['Cleared', 'Pending', 'Overdue'][Math.floor(Math.random() * 3)];
            const pendingCount = status === 'Cleared' ? 0 : Math.floor(Math.random() * 4) + 1;

            if (!account) {
                await ClientAccount.create({
                    id: require('uuid').v4(),
                    clientId: client.id,
                    companyName: client.companyName || client.name,
                    totalOutstanding,
                    clearedAmount,
                    overdueAmount: status === 'Overdue' ? Math.floor(Math.random() * 50000) : 0,
                    pendingInvoicesCount: pendingCount,
                    status,
                    accountType: Math.random() > 0.5 ? 'Premium' : 'Standard',
                    lastInvoiceNumber: `INV-2024-${Math.floor(Math.random() * 100).toString().padStart(3, '0')}`
                });
            } else {
                await account.update({
                    totalOutstanding,
                    clearedAmount,
                    overdueAmount: status === 'Overdue' ? Math.floor(Math.random() * 50000) : 0,
                    status,
                    pendingInvoicesCount: pendingCount,
                    companyName: client.companyName || client.name
                });
            }
        }
        res.status(200).json({ success: true, message: `Finance data seeded for ${clients.length} clients` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
