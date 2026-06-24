const { ClientAccount, Invoice, Client, Expense, PaymentRecord, PaymentRequest, Notification, ProfitabilityReport } = require('../models/sequelizeModels');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const saveUploadedBill = (file) => {
    if (!file) return null;
    const uploadDir = path.join(__dirname, '..', 'uploads', 'bills');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    const ext = path.extname(file.originalname);
    const fileName = `bill-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, file.buffer);
    return `/uploads/bills/${fileName}`;
};

// ─────────────────────────────────────────────────
// GET /finance/accounts
// Returns all client accounts + summary stats
// ─────────────────────────────────────────────────
exports.getClientAccounts = async (req, res) => {
    try {
        const accounts = await ClientAccount.findAll({
            include: [{
                model: Client,
                as: 'client',
                attributes: ['id', 'name', 'companyName', 'spocName', 'spocContact', 'email', 'contactNumber', 'status', 'gstNumber', 'panNumber', 'agreementType']
            }],
            order: [['companyName', 'ASC']]
        });

        // Merge client fields into account for easy frontend use
        const enriched = accounts.map(acc => {
            const plain = acc.toJSON();
            const client = plain.client || {};
            return {
                ...plain,
                spocName: client.spocName || null,
                contactNumber: client.contactNumber || client.spocContact || null,
                spocEmail: client.email || null,
                clientStatus: client.status || 'Active',
                agreementType: client.agreementType || null
            };
        });

        // Dashboard summary totals
        const totalOutstanding = enriched.reduce((sum, acc) => sum + parseFloat(acc.totalOutstanding || 0), 0);
        const totalCleared = enriched.reduce((sum, acc) => sum + parseFloat(acc.clearedAmount || 0), 0);
        const totalOverdue = enriched.reduce((sum, acc) => sum + parseFloat(acc.overdueAmount || 0), 0);
        const overdueCount = enriched.filter(acc => acc.status === 'Overdue').length;
        const pendingCount = enriched.filter(acc => acc.status === 'Pending').length;
        const clearedCount = enriched.filter(acc => acc.status === 'Cleared').length;

        res.status(200).json({
            success: true,
            data: enriched,
            summary: {
                totalOutstanding,
                totalCleared,
                totalOverdue,
                overdueCount,
                pendingCount,
                clearedCount,
                totalAccounts: enriched.length
            }
        });
    } catch (error) {
        console.error('[Finance] Error fetching client accounts:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch accounts' });
    }
};

// ─────────────────────────────────────────────────
// GET /finance/account/:clientId
// Returns account + all invoices for a client
// ─────────────────────────────────────────────────
exports.getAccountDetails = async (req, res) => {
    try {
        const { clientId } = req.params;

        const account = await ClientAccount.findOne({
            where: { clientId },
            include: [{
                model: Client,
                as: 'client',
                attributes: ['id', 'name', 'companyName', 'spocName', 'spocContact', 'email', 'contactNumber', 'corporateAddress', 'gstNumber', 'panNumber', 'status', 'paymentTerms', 'agreementType']
            }]
        });

        if (!account) {
            return res.status(404).json({ success: false, message: 'Account not found for this client' });
        }

        const invoices = await Invoice.findAll({
            where: { clientId },
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            success: true,
            data: { account, invoices }
        });
    } catch (error) {
        console.error('[Finance] Error fetching account details:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch account details' });
    }
};

// ─────────────────────────────────────────────────
// POST /finance/invoice/create
// Creates a new invoice and updates ClientAccount
// ─────────────────────────────────────────────────
exports.createInvoice = async (req, res) => {
    try {
        const { clientId, amount, dueDate, items, taxAmount, notes, invoiceFileName, invoiceFileData } = req.body;

        if (!clientId || !amount || !dueDate) {
            return res.status(400).json({ success: false, message: 'clientId, amount, and dueDate are required' });
        }

        const client = await Client.findByPk(clientId);
        if (!client) {
            return res.status(404).json({ success: false, message: 'Client not found' });
        }

        const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const tax = parseFloat(taxAmount || 0);
        const totalAmount = parseFloat(amount) + tax;

        const invoice = await Invoice.create({
            id: uuidv4(),
            invoiceNumber,
            clientId,
            companyName: client.companyName || client.name,
            amount: parseFloat(amount),
            taxAmount: tax,
            totalAmount,
            dueDate,
            items: items || [],
            notes: notes || '',
            status: 'Sent',
            invoiceFileName: invoiceFileName || null,
            invoiceFileData: invoiceFileData || null
        });

        // Create or update the ClientAccount record
        let account = await ClientAccount.findOne({ where: { clientId } });
        if (!account) {
            account = await ClientAccount.create({
                id: uuidv4(),
                clientId,
                companyName: client.companyName || client.name,
                totalOutstanding: totalAmount,
                clearedAmount: 0,
                overdueAmount: 0,
                pendingInvoicesCount: 1,
                status: 'Pending',
                lastInvoiceNumber: invoiceNumber
            });
        } else {
            await account.update({
                totalOutstanding: parseFloat(account.totalOutstanding || 0) + totalAmount,
                pendingInvoicesCount: (account.pendingInvoicesCount || 0) + 1,
                status: account.status === 'Cleared' ? 'Pending' : account.status,
                lastInvoiceNumber: invoiceNumber
            });
        }

        res.status(201).json({
            success: true,
            message: 'Invoice created successfully',
            data: invoice
        });
    } catch (error) {
        console.error('[Finance] Error creating invoice:', error);
        res.status(500).json({ success: false, message: 'Failed to create invoice' });
    }
};

// ─────────────────────────────────────────────────
// PUT /finance/invoice/:invoiceId/status
// Update invoice status (Paid / Overdue / Draft / Sent)
// ─────────────────────────────────────────────────
exports.updateInvoiceStatus = async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const { status, paidAmount, notes } = req.body;

        const validStatuses = ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: `Status must be one of: ${validStatuses.join(', ')}` });
        }

        const invoice = await Invoice.findByPk(invoiceId);
        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        await invoice.update({ status, notes: notes || invoice.notes });

        // If marked Paid → update ClientAccount
        if (status === 'Paid') {
            const account = await ClientAccount.findOne({ where: { clientId: invoice.clientId } });
            if (account) {
                const cleared = parseFloat(paidAmount || invoice.totalAmount);
                const newOutstanding = Math.max(0, parseFloat(account.totalOutstanding || 0) - cleared);
                const newCleared = parseFloat(account.clearedAmount || 0) + cleared;
                const newPendingCount = Math.max(0, (account.pendingInvoicesCount || 1) - 1);
                const newStatus = newOutstanding <= 0 ? 'Cleared' : account.status;

                await account.update({
                    totalOutstanding: newOutstanding,
                    clearedAmount: newCleared,
                    pendingInvoicesCount: newPendingCount,
                    status: newStatus
                });
            }
        }

        // If marked Overdue → update account status
        if (status === 'Overdue') {
            await ClientAccount.update(
                { status: 'Overdue', overdueAmount: invoice.totalAmount },
                { where: { clientId: invoice.clientId } }
            );
        }

        res.status(200).json({ success: true, message: `Invoice marked as ${status}`, data: invoice });
    } catch (error) {
        console.error('[Finance] Error updating invoice status:', error);
        res.status(500).json({ success: false, message: 'Failed to update invoice status' });
    }
};

// ─────────────────────────────────────────────────
// PUT /finance/account/:clientId/record-payment
// Record a collection (partial or full payment)
// ─────────────────────────────────────────────────
exports.recordPayment = async (req, res) => {
    try {
        const { clientId } = req.params;
        const { amountReceived, paymentMethod, transactionRef, notes, invoiceId } = req.body;

        if (!clientId || !amountReceived) {
            return res.status(400).json({ success: false, message: 'clientId and amountReceived are required' });
        }

        let account = await ClientAccount.findOne({ where: { clientId } });
        if (!account) {
            const client = await Client.findByPk(clientId);
            account = await ClientAccount.create({
                id: uuidv4(),
                clientId,
                companyName: client ? (client.companyName || client.name) : 'Unknown Client',
                totalOutstanding: 0,
                clearedAmount: 0,
                overdueAmount: 0,
                pendingInvoicesCount: 0,
                status: 'Cleared'
            });
        }

        const received = parseFloat(amountReceived);
        const newOutstanding = Math.max(0, parseFloat(account.totalOutstanding || 0) - received);
        const newCleared = parseFloat(account.clearedAmount || 0) + received;
        const newStatus = newOutstanding <= 0 ? 'Cleared' : (account.status === 'Overdue' ? 'Pending' : account.status);

        await account.update({
            totalOutstanding: newOutstanding,
            clearedAmount: newCleared,
            overdueAmount: newStatus !== 'Overdue' ? 0 : account.overdueAmount,
            status: newStatus,
            pendingInvoicesCount: newOutstanding <= 0 ? 0 : Math.max(0, (account.pendingInvoicesCount || 1) - 1)
        });

        // If specific invoice, mark it paid
        if (invoiceId) {
            await Invoice.update(
                { status: 'Paid', notes: notes || '' },
                { where: { id: invoiceId, clientId } }
            );
        }

        // Persist payment record to the database payments table!
        const paymentRecord = await PaymentRecord.create({
            id: uuidv4(),
            clientId,
            companyName: account.companyName,
            invoiceId: invoiceId || null,
            amountReceived: received,
            dateReceived: req.body.dateReceived || new Date(),
            paymentMethod: paymentMethod || 'Bank Transfer',
            transactionRef: transactionRef || null,
            notes: notes || null
        });

        res.status(200).json({
            success: true,
            message: `Payment of ₹${received.toLocaleString('en-IN')} recorded successfully`,
            data: paymentRecord
        });
    } catch (error) {
        console.error('[Finance] Error recording payment:', error);
        res.status(500).json({ success: false, message: 'Failed to record payment' });
    }
};

// ─────────────────────────────────────────────────
// GET /finance/invoices
// Get all invoices (across all clients) with filters
// ─────────────────────────────────────────────────
exports.getAllInvoices = async (req, res) => {
    try {
        const { status, clientId, from, to } = req.query;
        const where = {};
        if (status) where.status = status;
        if (clientId) where.clientId = clientId;
        if (from || to) {
            const { Op } = require('sequelize');
            where.createdAt = {};
            if (from) where.createdAt[Op.gte] = new Date(from);
            if (to) where.createdAt[Op.lte] = new Date(to);
        }

        const invoices = await Invoice.findAll({
            where,
            include: [{
                model: Client,
                attributes: ['id', 'name', 'companyName', 'spocName', 'email', 'contactNumber']
            }],
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({ success: true, data: invoices, total: invoices.length });
    } catch (error) {
        console.error('[Finance] Error fetching invoices:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch invoices' });
    }
};

// ─────────────────────────────────────────────────
// POST /finance/seed (internal / one-time use)
// Seeds random finance data for all clients
// ─────────────────────────────────────────────────
exports.seedFinanceData = async (req, res) => {
    try {
        const clients = await Client.findAll();
        if (clients.length === 0) {
            return res.status(400).json({ message: 'No clients found to seed' });
        }

        for (const client of clients) {
            const totalOutstanding = Math.floor(Math.random() * 400000) + 50000;
            const clearedAmount = Math.floor(Math.random() * (totalOutstanding * 0.7));
            const status = ['Cleared', 'Pending', 'Overdue'][Math.floor(Math.random() * 3)];
            const pendingCount = status === 'Cleared' ? 0 : Math.floor(Math.random() * 4) + 1;

            let account = await ClientAccount.findOne({ where: { clientId: client.id } });
            if (!account) {
                await ClientAccount.create({
                    id: uuidv4(),
                    clientId: client.id,
                    companyName: client.companyName || client.name,
                    totalOutstanding,
                    clearedAmount,
                    overdueAmount: status === 'Overdue' ? Math.floor(Math.random() * 50000) : 0,
                    pendingInvoicesCount: pendingCount,
                    status,
                    accountType: Math.random() > 0.5 ? 'Premium' : 'Standard',
                    lastInvoiceNumber: `INV-2025-${Math.floor(Math.random() * 100).toString().padStart(3, '0')}`
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

            // Create 1-2 sample invoices per client
            const existingInvoices = await Invoice.count({ where: { clientId: client.id } });
            if (existingInvoices === 0) {
                const invStatuses = ['Sent', 'Paid', 'Overdue'];
                await Invoice.create({
                    id: uuidv4(),
                    invoiceNumber: `INV-2025-${Math.floor(1000 + Math.random() * 9000)}`,
                    clientId: client.id,
                    companyName: client.companyName || client.name,
                    amount: totalOutstanding,
                    taxAmount: Math.round(totalOutstanding * 0.18),
                    totalAmount: totalOutstanding + Math.round(totalOutstanding * 0.18),
                    dueDate: new Date(Date.now() + 30 * 86400000),
                    status: invStatuses[Math.floor(Math.random() * invStatuses.length)],
                    items: [{ description: 'Professional Services', amount: totalOutstanding }],
                    notes: 'Auto-seeded invoice'
                });
            }
        }

        res.status(200).json({
            success: true,
            message: `Finance data seeded for ${clients.length} clients`
        });
    } catch (error) {
        console.error('[Finance] Seed error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────────
// GET /finance/expenses
// Get all recorded expenses
// ─────────────────────────────────────────────────
exports.getExpenses = async (req, res) => {
    try {
        const expenses = await Expense.findAll({
            order: [['date', 'DESC']]
        });
        res.status(200).json({ success: true, data: expenses });
    } catch (error) {
        console.error('[Finance] Error fetching expenses:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch expenses' });
    }
};

// ─────────────────────────────────────────────────
// POST /finance/expense/create
// Create a new expense
// ─────────────────────────────────────────────────
exports.createExpense = async (req, res) => {
    try {
        const { category, vendor, amount, status, date, notes } = req.body;
        if (!category || !vendor || !amount || !date) {
            return res.status(400).json({ success: false, message: 'category, vendor, amount, and date are required' });
        }

        const expense = await Expense.create({
            id: uuidv4(),
            category,
            vendor,
            amount: parseFloat(amount),
            status: status || 'Paid',
            date,
            notes: notes || null
        });

        res.status(201).json({ success: true, message: 'Expense recorded successfully', data: expense });
    } catch (error) {
        console.error('[Finance] Error creating expense:', error);
        res.status(500).json({ success: false, message: 'Failed to record expense' });
    }
};

// ─────────────────────────────────────────────────
// PUT /finance/expense/:expenseId/status
// Update expense payment status (Paid / Pending)
// ─────────────────────────────────────────────────
exports.updateExpenseStatus = async (req, res) => {
    try {
        const { expenseId } = req.params;
        const { status, paymentMethod, transactionRef, paymentDate, receiptFileName, notes } = req.body;

        if (!status) {
            return res.status(400).json({ success: false, message: 'Status is required' });
        }

        const expense = await Expense.findByPk(expenseId);
        if (!expense) {
            return res.status(404).json({ success: false, message: 'Expense not found' });
        }

        let updatedFields = { status };
        if (status === 'Paid') {
            const paymentDetails = {
                paymentMethod: paymentMethod || 'Bank Transfer',
                transactionRef: transactionRef || '',
                paymentDate: paymentDate || new Date().toISOString().split('T')[0],
                receiptFileName: receiptFileName || '',
                receiptFileData: req.body.receiptFileData || '',
                additionalNotes: notes || ''
            };
            updatedFields.notes = JSON.stringify(paymentDetails);
        } else {
            if (notes !== undefined) {
                updatedFields.notes = notes;
            }
        }

        await expense.update(updatedFields);

        res.status(200).json({ success: true, message: `Expense marked as ${status}`, data: expense });
    } catch (error) {
        console.error('[Finance] Error updating expense status:', error);
        res.status(500).json({ success: false, message: 'Failed to update expense status' });
    }
};


// ─────────────────────────────────────────────────
// GET /finance/payments
// Get all payment transaction logs
// ─────────────────────────────────────────────────
exports.getPayments = async (req, res) => {
    try {
        const payments = await PaymentRecord.findAll({
            order: [['dateReceived', 'DESC']]
        });
        res.status(200).json({ success: true, data: payments });
    } catch (error) {
        console.error('[Finance] Error fetching payments:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch payments' });
    }
};

// ─────────────────────────────────────────────────
// GET /finance/payment-requests
// Get all payment requests
// ─────────────────────────────────────────────────
exports.getPaymentRequests = async (req, res) => {
    try {
        const requests = await PaymentRequest.findAll({
            order: [['dueDate', 'ASC']]
        });
        res.status(200).json({ success: true, data: requests });
    } catch (error) {
        console.error('[Finance] Error fetching payment requests:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch payment requests' });
    }
};

// ─────────────────────────────────────────────────
// POST /finance/payment-request/create
// Create a new payment request
// ─────────────────────────────────────────────────
exports.createPaymentRequest = async (req, res) => {
    try {
        const { payee, category, amount, dueDate, priority, bankDetails, notes, clientId, paymentSource, department } = req.body;
        if (!payee || !category || !amount || !dueDate) {
            return res.status(400).json({ success: false, message: 'payee, category, amount, and dueDate are required' });
        }

        const attachmentUrl = saveUploadedBill(req.file);

        const request = await PaymentRequest.create({
            id: uuidv4(),
            payee,
            category,
            amount: parseFloat(amount),
            dueDate,
            priority: priority || 'Medium',
            bankDetails: bankDetails || null,
            notes: notes || null,
            status: 'Pending',
            clientId: clientId || null,
            paymentSource: paymentSource || 'Client Side',
            department: department || null,
            attachmentUrl: attachmentUrl || null
        });

        res.status(201).json({ success: true, message: 'Payment request recorded successfully', data: request });
    } catch (error) {
        console.error('[Finance] Error creating payment request:', error);
        res.status(500).json({ success: false, message: 'Failed to record payment request' });
    }
};

// ─────────────────────────────────────────────────
// GET /finance/employees-payroll
// Returns payroll list using actual DB users
// ─────────────────────────────────────────────────
exports.getEmployeesPayroll = async (req, res) => {
    try {
        const { Admin, TeamLeader, Employee, DepartmentTeam } = require('../models/sequelizeModels');
        
        const admins = await Admin.findAll({ attributes: ['id', 'name', 'email', 'createdAt'] });
        const teamLeaders = await TeamLeader.findAll({ attributes: ['id', 'name', 'email', 'department', 'createdAt', 'phone'] });
        const employees = await Employee.findAll({ attributes: ['id', 'name', 'email', 'createdAt', 'phone'] });
        const departmentTeams = await DepartmentTeam.findAll({ attributes: ['id', 'name', 'email', 'department', 'createdAt', 'phone', 'role'] });

        const list = [];
        
        admins.forEach(item => {
            list.push({
                id: item.id,
                col1: `#ADM-${item.id.substring(0, 4).toUpperCase()}`,
                col2: item.name,
                col3: 'Administration',
                col4: '₹1,50,000',
                col5: 'Processed',
                details: {
                    email: item.email,
                    joinDate: new Date(item.createdAt).toLocaleDateString('en-IN'),
                    phone: 'N/A'
                }
            });
        });

        teamLeaders.forEach(item => {
            list.push({
                id: item.id,
                col1: `#TL-${item.id.substring(0, 4).toUpperCase()}`,
                col2: item.name,
                col3: item.department || 'Management',
                col4: '₹85,000',
                col5: 'Processed',
                details: {
                    email: item.email,
                    joinDate: new Date(item.createdAt).toLocaleDateString('en-IN'),
                    phone: item.phone || 'N/A'
                }
            });
        });

        employees.forEach(item => {
            list.push({
                id: item.id,
                col1: `#EMP-${item.id.substring(0, 4).toUpperCase()}`,
                col2: item.name,
                col3: 'Recruitment',
                col4: '₹45,000',
                col5: 'Processed',
                details: {
                    email: item.email,
                    joinDate: new Date(item.createdAt).toLocaleDateString('en-IN'),
                    phone: item.phone || 'N/A'
                }
            });
        });

        departmentTeams.forEach(item => {
            list.push({
                id: item.id,
                col1: `#DEP-${item.id.substring(0, 4).toUpperCase()}`,
                col2: item.name,
                col3: item.department || 'Operations',
                col4: '₹60,000',
                col5: 'Processed',
                details: {
                    email: item.email,
                    joinDate: new Date(item.createdAt).toLocaleDateString('en-IN'),
                    phone: item.phone || 'N/A'
                }
            });
        });

        res.status(200).json({ success: true, data: list });
    } catch (error) {
        console.error('[Finance] Error fetching employees payroll:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch employees payroll' });
    }
};

// ─────────────────────────────────────────────────
// Utility Helpers for Profitability Reports
// ─────────────────────────────────────────────────

const normDept = (val) => {
    const deptStr = String(val || '').toLowerCase().trim();
    if (deptStr.includes('operation')) return 'Operations';
    if (deptStr.includes('recruit')) return 'Recruitment';
    if (deptStr.includes('crm') || deptStr.includes('sales')) return 'Sales';
    return 'Recruitment';
};

const getInvoiceDept = (invoice) => {
    let dept = invoice.department || invoice.serviceDepartment || invoice.dept || 'Recruitment';
    if (invoice.notes && invoice.notes.includes('Department:')) {
        invoice.notes.split(' | ').forEach(part => {
            if (part.startsWith('Department:')) {
                dept = part.replace('Department:', '').trim();
            }
        });
    }
    return dept;
};

const getExpenseDept = (exp) => {
    return exp.department || exp.dept || exp.serviceDepartment || exp.departmentName || '';
};

const getPeriodDateRange = (reportType, periodVal) => {
    let startDate, endDate;
    if (reportType === 'Monthly') {
        const [year, month] = periodVal.split('-').map(Number);
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0, 23, 59, 59, 999);
    } else if (reportType === 'Quarterly') {
        const year = Number(periodVal.substring(0, 4));
        const qVal = periodVal.substring(5);
        let startMonth, endMonth;
        if (qVal === 'Q1') { startMonth = 0; endMonth = 2; }
        else if (qVal === 'Q2') { startMonth = 3; endMonth = 5; }
        else if (qVal === 'Q3') { startMonth = 6; endMonth = 8; }
        else { startMonth = 9; endMonth = 11; }
        startDate = new Date(year, startMonth, 1);
        endDate = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);
    } else if (reportType === 'Half-Month') {
        const parts = periodVal.split('-');
        const year = Number(parts[0]);
        const month = Number(parts[1]);
        const half = parts[2];
        if (half === 'H1') {
            startDate = new Date(year, month - 1, 1);
            endDate = new Date(year, month - 1, 15, 23, 59, 59, 999);
        } else {
            startDate = new Date(year, month - 1, 16);
            endDate = new Date(year, month, 0, 23, 59, 59, 999);
        }
    } else if (reportType === 'Yearly') {
        const year = Number(periodVal);
        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 11, 31, 23, 59, 59, 999);
    } else {
        throw new Error('Invalid report type: ' + reportType);
    }
    return { startDate, endDate };
};

const formatPeriodDisplay = (reportType, periodVal) => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    if (reportType === 'Monthly') {
        const [year, month] = periodVal.split('-').map(Number);
        return `${monthNames[month - 1]} ${year}`;
    } else if (reportType === 'Quarterly') {
        const year = periodVal.substring(0, 4);
        const qVal = periodVal.substring(5);
        let months = '';
        if (qVal === 'Q1') months = 'Jan - Mar';
        else if (qVal === 'Q2') months = 'Apr - Jun';
        else if (qVal === 'Q3') months = 'Jul - Sep';
        else months = 'Oct - Dec';
        return `${qVal} ${year} (${months})`;
    } else if (reportType === 'Half-Month') {
        const parts = periodVal.split('-');
        const year = Number(parts[0]);
        const month = Number(parts[1]);
        const half = parts[2];
        return `${monthNames[month - 1]} ${year} - ${half === 'H1' ? 'First Half' : 'Second Half'}`;
    } else if (reportType === 'Yearly') {
        return `Year ${periodVal}`;
    }
    return periodVal;
};

const calculateStatsHelper = async (startDate, endDate, department, reportType) => {
    const { Invoice, Expense, PaymentRequest, Payslip, Admin, TeamLeader, Employee, DepartmentTeam } = require('../models/sequelizeModels');
    const { Op } = require('sequelize');
    
    // 1. Invoices
    const invoices = await Invoice.findAll({
        where: {
            status: 'Paid',
            createdAt: { [Op.between]: [startDate, endDate] }
        }
    });
    const filteredInvoices = invoices.filter(inv => {
        if (department === 'All' || !department) return true;
        return normDept(getInvoiceDept(inv)).toLowerCase() === department.toLowerCase();
    });
    const revenue = filteredInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount || inv.amount || 0), 0);

    // 2. Expenses
    const expenses = await Expense.findAll({
        where: {
            status: 'Paid',
            date: { [Op.between]: [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]] }
        }
    });
    const filteredExpenses = expenses.filter(exp => {
        if (department === 'All' || !department) return true;
        return normDept(getExpenseDept(exp)).toLowerCase() === department.toLowerCase();
    });

    const rentExpenses = filteredExpenses
        .filter(exp => ['office rent', 'rent', 'electricity', 'internet'].includes((exp.category || '').toLowerCase()))
        .reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
        
    const miscExpenses = filteredExpenses
        .filter(exp => ['miscellaneous', 'misc', 'other'].includes((exp.category || '').toLowerCase()))
        .reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
        
    const otherExpenses = filteredExpenses
        .filter(exp => !['office rent', 'rent', 'electricity', 'internet', 'miscellaneous', 'misc', 'other'].includes((exp.category || '').toLowerCase()))
        .reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);

    // 3. Payment Requests
    const paymentRequests = await PaymentRequest.findAll({
        where: {
            dueDate: { [Op.between]: [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]] }
        }
    });
    const filteredPRs = paymentRequests.filter(pr => {
        if (department === 'All' || !department) return true;
        return pr.department && normDept(pr.department).toLowerCase() === department.toLowerCase();
    });
    const incomingBills = filteredPRs.reduce((sum, pr) => sum + parseFloat(pr.amount || 0), 0);

    // 4. Payslips (Salary)
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const payslips = await Payslip.findAll();
    const filteredPayslips = payslips.filter(ps => {
        const psMonthIdx = monthNames.indexOf(ps.month);
        if (psMonthIdx === -1) return false;
        const psDate = new Date(ps.year, psMonthIdx, 15);
        if (psDate < startDate || psDate > endDate) return false;
        
        if (department === 'All' || !department) return true;
        return normDept(ps.department).toLowerCase() === department.toLowerCase();
    });
    let salaryExpenses = filteredPayslips.reduce((sum, ps) => sum + parseFloat(ps.netSalary || 0), 0);

    // Salary dynamic fallback
    if (salaryExpenses === 0) {
        const monthsDiff = Math.max(1, (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth() + 1));
        const adminsCount = await Admin.count();
        const tls = await TeamLeader.findAll();
        const emps = await Employee.findAll();
        const depts = await DepartmentTeam.findAll();
        
        let monthlySalary = 0;
        if (department === 'All' || !department) {
            monthlySalary += adminsCount * 150000;
            tls.forEach(tl => { monthlySalary += 85000; });
            emps.forEach(emp => { monthlySalary += parseFloat(emp.basicSalary || 45000); });
            depts.forEach(d => { monthlySalary += 60000; });
        } else if (department.toLowerCase() === 'recruitment') {
            emps.forEach(emp => { monthlySalary += parseFloat(emp.basicSalary || 45000); });
        } else if (department.toLowerCase() === 'operations') {
            depts.forEach(d => { monthlySalary += 60000; });
        } else if (department.toLowerCase() === 'sales') {
            tls.filter(t => normDept(t.department).toLowerCase() === 'sales').forEach(t => { monthlySalary += 85000; });
        }
        
        if (reportType === 'Half-Month') {
            salaryExpenses = monthlySalary / 2;
        } else {
            salaryExpenses = monthlySalary * monthsDiff;
        }
    }

    const totalExpenses = salaryExpenses + rentExpenses + miscExpenses + otherExpenses;
    const netProfit = revenue - totalExpenses;
    const margin = revenue > 0 ? `${Math.round((netProfit / revenue) * 100)}%` : '0%';

    return {
        revenue,
        salaryExpenses,
        rentExpenses,
        miscExpenses,
        incomingBills,
        otherExpenses,
        totalExpenses,
        netProfit,
        margin,
        invoicesCount: filteredInvoices.length,
        expensesCount: filteredExpenses.length,
        paymentRequestsCount: filteredPRs.length
    };
};

// ─────────────────────────────────────────────────
// GET /finance/profitability-reports
// Calculates dynamic monthly margin and profitability reports
// ─────────────────────────────────────────────────
exports.getProfitabilityReports = async (req, res) => {
    try {
        let reports = await ProfitabilityReport.findAll({
            order: [['createdAt', 'DESC']]
        });
        
        if (reports.length === 0) {
            console.log('Seeding initial profitability reports from DB history...');
            const currentYear = new Date().getFullYear();
            const seedMonths = [
                { type: 'Monthly', val: `${currentYear}-04`, name: `April ${currentYear} Profitability Analysis` },
                { type: 'Monthly', val: `${currentYear}-05`, name: `May ${currentYear} Profitability Analysis` },
                { type: 'Monthly', val: `${currentYear}-06`, name: `June ${currentYear} Profitability Analysis` }
            ];
            
            const seededList = [];
            for (let i = 0; i < seedMonths.length; i++) {
                const item = seedMonths[i];
                const { startDate, endDate } = getPeriodDateRange(item.type, item.val);
                const period = formatPeriodDisplay(item.type, item.val);
                
                const stats = await calculateStatsHelper(startDate, endDate, 'All', item.type);
                
                const reportNumber = `REP-${item.type.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}-${i + 1}`;
                
                const report = await ProfitabilityReport.create({
                    id: uuidv4(),
                    reportNumber,
                    reportName: item.name,
                    reportType: item.type,
                    period,
                    department: 'All',
                    revenue: stats.revenue,
                    expenses: stats.totalExpenses,
                    netProfit: stats.netProfit,
                    margin: stats.margin,
                    generatedBy: 'System',
                    status: 'Finalized',
                    notes: `System-generated baseline report for ${period}.`,
                    details: {
                        salary: stats.salaryExpenses,
                        rent: stats.rentExpenses,
                        misc: stats.miscExpenses,
                        incomingBills: stats.incomingBills,
                        otherExpenses: stats.otherExpenses,
                        invoicesCount: stats.invoicesCount,
                        expensesCount: stats.expensesCount,
                        paymentRequestsCount: stats.paymentRequestsCount
                    }
                });
                seededList.push(report);
            }
            reports = seededList;
        }
        
        res.status(200).json({ success: true, data: reports });
    } catch (error) {
        console.error('[Finance] Error fetching profitability reports:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch profitability reports' });
    }
};

// ─────────────────────────────────────────────────
// POST /finance/profitability-reports/generate
// Dynamically generates a new profitability report
// ─────────────────────────────────────────────────
exports.generateProfitabilityReport = async (req, res) => {
    try {
        const { reportType, periodVal, department, reportName, notes, generatedBy } = req.body;
        
        if (!reportType || !periodVal) {
            return res.status(400).json({ success: false, message: 'reportType and periodVal are required.' });
        }
        
        const { startDate, endDate } = getPeriodDateRange(reportType, periodVal);
        const period = formatPeriodDisplay(reportType, periodVal);
        
        const stats = await calculateStatsHelper(startDate, endDate, department || 'All', reportType);
        
        const reportNumber = `REP-${reportType.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;
        const defaultName = `${period} Profitability Analysis`;
        
        const report = await ProfitabilityReport.create({
            id: uuidv4(),
            reportNumber,
            reportName: reportName || defaultName,
            reportType,
            period,
            department: department || 'All',
            revenue: stats.revenue,
            expenses: stats.totalExpenses,
            netProfit: stats.netProfit,
            margin: stats.margin,
            generatedBy: generatedBy || 'System',
            status: 'Generated',
            notes: notes || `Dynamically generated report for ${period}.`,
            details: {
                salary: stats.salaryExpenses,
                rent: stats.rentExpenses,
                misc: stats.miscExpenses,
                incomingBills: stats.incomingBills,
                otherExpenses: stats.otherExpenses,
                invoicesCount: stats.invoicesCount,
                expensesCount: stats.expensesCount,
                paymentRequestsCount: stats.paymentRequestsCount
            }
        });
        
        res.status(201).json({ success: true, data: report });
    } catch (error) {
        console.error('[Finance] Error generating profitability report:', error);
        res.status(500).json({ success: false, message: 'Failed to generate profitability report', error: error.message });
    }
};

// ─────────────────────────────────────────────────
// PUT /finance/profitability-reports/:id/status
// Updates profitability report status (e.g. Reviewed / Finalized)
// ─────────────────────────────────────────────────
exports.updateProfitabilityReportStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const report = await ProfitabilityReport.findByPk(id);
        if (!report) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }
        
        await report.update({ status });
        res.status(200).json({ success: true, message: `Report status updated to ${status}`, data: report });
    } catch (error) {
        console.error('[Finance] Error updating profitability report status:', error);
        res.status(500).json({ success: false, message: 'Failed to update report status' });
    }
};

exports.updateExpense = async (req, res) => {
    try {
        const { expenseId } = req.params;
        const expense = await Expense.findByPk(expenseId);
        if (!expense) {
            return res.status(404).json({ success: false, message: 'Expense not found' });
        }
        await expense.update(req.body);
        res.status(200).json({ success: true, message: 'Expense updated successfully', data: expense });
    } catch (error) {
        console.error('[Finance] Error updating expense:', error);
        res.status(500).json({ success: false, message: 'Failed to update expense' });
    }
};

exports.updatePaymentRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const request = await PaymentRequest.findByPk(requestId);
        if (!request) {
            return res.status(404).json({ success: false, message: 'Payment request not found' });
        }

        const updateData = { ...req.body };
        if (req.file) {
            const attachmentUrl = saveUploadedBill(req.file);
            updateData.attachmentUrl = attachmentUrl;
        }

        await request.update(updateData);
        res.status(200).json({ success: true, message: 'Payment request updated successfully', data: request });
    } catch (error) {
        console.error('[Finance] Error updating payment request:', error);
        res.status(500).json({ success: false, message: 'Failed to update payment request' });
    }
};

exports.sendPaymentReminder = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { senderId, senderType } = req.body;

        const request = await PaymentRequest.findByPk(requestId);
        if (!request) {
            return res.status(404).json({ success: false, message: 'Payment request not found' });
        }

        // 1. Create notification for Client (if clientId is present)
        if (request.clientId) {
            await Notification.create({
                userId: request.clientId,
                userType: 'Client',
                message: `Payment Reminder: Pending payment request of ₹${Number(request.amount).toLocaleString('en-IN')} for "${request.payee}" is due on ${request.dueDate}.`,
                type: 'alert',
                priority: request.priority ? request.priority.toLowerCase() : 'medium',
                status: 'unread'
            });
        }

        // Normalize senderType to match notifications userType enum ('Admin', 'TeamLeader', 'Employee', 'Client', 'DepartmentTeam')
        let normalizedSenderType = 'Admin';
        if (senderType) {
            const lowerType = String(senderType).toLowerCase().trim();
            if (lowerType === 'client') {
                normalizedSenderType = 'Client';
            } else if (lowerType === 'teamleader') {
                normalizedSenderType = 'TeamLeader';
            } else if (['employee', 'kam', 'crm', 'tech', 'hroperations', 'hrrecruitment'].includes(lowerType)) {
                normalizedSenderType = 'Employee';
            } else if (lowerType === 'departmentteam') {
                normalizedSenderType = 'DepartmentTeam';
            } else {
                normalizedSenderType = 'Admin';
            }
        }

        // 2. Create notification for Sender (if senderId is present)
        if (senderId) {
            await Notification.create({
                userId: senderId,
                userType: normalizedSenderType,
                message: `Reminder sent to client for payment of ₹${Number(request.amount).toLocaleString('en-IN')} due on ${request.dueDate}.`,
                type: 'message',
                priority: 'low',
                status: 'unread'
            });
        }

        res.status(200).json({ success: true, message: 'Reminder sent and notifications recorded successfully' });
    } catch (error) {
        console.error('[Finance] Error sending payment reminder:', error);
        res.status(500).json({ success: false, message: 'Failed to send reminder', error: error.message });
    }
};
