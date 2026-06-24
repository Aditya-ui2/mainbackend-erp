// controllers/superAdminController.js

const { SuperAdmin, Client, Employee, Admin, DepartmentTeam, Invoice, RecruitmentPosition, TeamLeader } = require('../models/sequelizeModels');
const { comparePasswords, hashPassword } = require('../utils/bcryptUtils');
const { getOrCreateFolder, uploadFileToDrive, getFileLink, deleteFile } = require('../utils/googleDriveServices');
const { generateToken, generateRefreshToken } = require('../utils/jwtUtils');
const formidable = require("formidable");
const fs = require("fs/promises");

// Function to login SuperAdmin
const loginSuperAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate email and password
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Find SuperAdmin by email
        const superAdmin = await SuperAdmin.findOne({ where: { email } });
        if (!superAdmin) {
            return res.status(404).json({ message: 'SuperAdmin not found' });
        }

        if (superAdmin.status && superAdmin.status !== 'Active') {
            return res.status(401).json({ message: 'Account is blocked/disabled. Please contact administrator.' });
        }

        // Compare provided password with the stored hashed password
        const isPasswordValid = await comparePasswords(password, superAdmin.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate JWT tokens
        const payload = { 
            id: superAdmin.id, 
            email: superAdmin.email, 
            role: 'SuperAdmin',
            passwordHash: superAdmin.password ? superAdmin.password.substring(0, 10) : undefined
        };
        const token = generateToken(payload);
        const refreshToken = generateRefreshToken(payload);

        res.status(200).json({
            message: 'Login successful',
            token,
            refreshToken,
            superAdmin: {
                id: superAdmin.id,
                name: superAdmin.name,
                email: superAdmin.email
            }
        });
    } catch (error) {
        console.error('Error logging in SuperAdmin:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Function to edit SuperAdmin
const editSuperAdmin = async (req, res) => {
    try {
        const { superAdminId, name, email, password } = req.body; // SuperAdmin details

        // Validate SuperAdmin ID
        if (!superAdminId) {
            return res.status(400).json({ message: 'SuperAdmin ID is required' });
        }

        // Find SuperAdmin by ID
        const superAdmin = await SuperAdmin.findByPk(superAdminId);
        if (!superAdmin) {
            return res.status(404).json({ message: 'SuperAdmin not found' });
        }

        // 1. Email ID Change Constraint
        if (email && email.toLowerCase().trim() !== superAdmin.email.toLowerCase().trim()) {
            const isRequesterTech = req.user && (
                String(req.user.email || '').toLowerCase().includes('tech') || 
                String(req.user.role || req.user.userType || '').toLowerCase().includes('tech')
            );
            if (!isRequesterTech) {
                return res.status(403).json({ message: 'Access denied. Email ID cannot be changed except by a tech person.' });
            }
            superAdmin.email = email;
        }

        // 2. Tech Password Change Constraint
        const isTargetTech = (
            String(superAdmin.email || '').toLowerCase().includes('tech') ||
            String(superAdmin.role || '').toLowerCase().includes('tech')
        );

        // Update fields if provided
        if (name) superAdmin.name = name;
        if (password) {
            if (isTargetTech) {
                if (!req.user || req.user.id !== superAdmin.id) {
                    return res.status(403).json({ message: 'Access denied. Password of a tech person cannot be changed by others.' });
                }
            }
            // Hash the new password before saving
            superAdmin.password = await hashPassword(password);
        }

        // Save updated SuperAdmin
        await superAdmin.save();

        res.status(200).json({
            message: 'SuperAdmin updated successfully',
            superAdmin: {
                id: superAdmin.id,
                name: superAdmin.name,
                email: superAdmin.email
            }
        });
    } catch (error) {
        console.error('Error updating SuperAdmin:', error);
        res.status(500).json({ message: 'Server error' });
    }
};


// Function to get dashboard statistics
const getDashboardStats = async (req, res) => {
    try {
        const { Expense, Invoice } = require('../models/sequelizeModels');

        // Count active clients
        const activeClients = await Client.count();
        
        // Count active employees (sum of all user tables)
        const employeeCount = await Employee.count();
        const deptTeamCount = await DepartmentTeam.count();
        const tlCount = await TeamLeader.count();
        const adminCount = await Admin.count();
        const saCount = await SuperAdmin.count();
        const activeEmployees = employeeCount + deptTeamCount + tlCount + adminCount + saCount;
        
        // Count admins
        const totalAdmins = adminCount + saCount;
        
        // Count KAMs (Using HR Recruitment department as KAMs, similar to the recruitment dashboard)
        const totalKAMs = await DepartmentTeam.count({ 
            where: { department: 'HR Recruitment' } 
        });
        
        // Count open positions
        const totalHiring = await RecruitmentPosition.count({ where: { status: 'Open' } });
        
        // Calculate total revenue, outstanding payments, and department billings
        let totalRevenue = 0;
        let outstandingPayment = 0;
        let operationsBilling = 0;
        let recruitmentBilling = 0;
        let crmConvertedRevenue = 0;
        let totalMonthlyBilling = 0;

        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        let invoices = [];
        try {
            invoices = await Invoice.findAll();
            invoices.forEach(inv => {
                const invAmount = Number(inv.totalAmount || 0);
                const invDate = new Date(inv.createdAt || inv.dueDate);
                
                // Monthly billing (current month)
                if (invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear) {
                    totalMonthlyBilling += invAmount;
                }

                // Department wise
                const itemsStr = JSON.stringify(inv.items || '').toLowerCase();
                const notesStr = (inv.notes || '').toLowerCase();
                const compName = (inv.companyName || '').toLowerCase();
                
                if (compName.includes('aerometric') || itemsStr.includes('recruitment') || itemsStr.includes('hiring') || notesStr.includes('recruitment')) {
                    recruitmentBilling += invAmount;
                } else if (itemsStr.includes('operations') || itemsStr.includes('ops') || notesStr.includes('operations')) {
                    operationsBilling += invAmount;
                } else if (itemsStr.includes('crm') || notesStr.includes('crm') || itemsStr.includes('lead')) {
                    crmConvertedRevenue += invAmount;
                } else {
                    // Fallback distribution
                    operationsBilling += invAmount * 0.5;
                    recruitmentBilling += invAmount * 0.3;
                    crmConvertedRevenue += invAmount * 0.2;
                }

                if (inv.status === 'Paid' || inv.status === 'Sent' || inv.status === 'Overdue') {
                    totalRevenue += invAmount;
                }
                if (inv.status === 'Sent' || inv.status === 'Overdue') {
                    outstandingPayment += invAmount;
                }
            });
        } catch (e) {
            console.log("Invoices table might not exist or empty", e);
        }

        // Calculate Rent & office expenses from Expenses table
        let totalRent = 0;
        let totalExpenses = 0;
        try {
            const expensesList = await Expense.findAll();
            expensesList.forEach(exp => {
                const amt = Number(exp.amount || 0);
                totalExpenses += amt;
                const cat = (exp.category || '').toLowerCase();
                const vend = (exp.vendor || '').toLowerCase();
                if (cat.includes('rent') || cat.includes('office') || vend.includes('wework') || cat.includes('maintenance')) {
                    totalRent += amt;
                }
            });
        } catch (e) {
            console.log("Expenses table error", e);
        }

        // Calculate dynamic salaries based on actual basic salaries from the database
        const allDbEmployees = await Employee.findAll({ attributes: ['basicSalary'] });
        let salaryPayout = 0;
        allDbEmployees.forEach(emp => {
            salaryPayout += Number(emp.basicSalary || 0);
        });
        totalExpenses += salaryPayout;

        const netProfit = totalRevenue - totalExpenses;
        
        // Format as Indian currency
        const formatCurrency = (val) => {
            const isNegative = val < 0;
            const absVal = Math.abs(val);
            let formatted = '';
            if (absVal >= 10000000) formatted = `₹${(absVal / 10000000).toFixed(1)}Cr`;
            else if (absVal >= 100000) formatted = `₹${(absVal / 100000).toFixed(1)}L`;
            else formatted = `₹${absVal.toLocaleString('en-IN')}`;
            return isNegative ? `₹-${formatted.substring(1)}` : formatted;
        };

        // 1. Recent Invoices
        const allInvoices = await Invoice.findAll({
            order: [['createdAt', 'DESC']],
            limit: 5
        });
        const clientMap = {};
        const clients = await Client.findAll();
        clients.forEach(c => {
            clientMap[c.id] = c;
        });

        const recentInvoices = allInvoices.map(inv => {
            const itemsStr = JSON.stringify(inv.items || '').toLowerCase();
            const notesStr = (inv.notes || '').toLowerCase();
            const compName = (inv.companyName || '').toLowerCase();
            
            let dept = 'Operations';
            if (compName.includes('aerometric') || itemsStr.includes('recruitment') || itemsStr.includes('hiring') || notesStr.includes('recruitment')) {
                dept = 'Recruitment';
            } else if (itemsStr.includes('crm') || notesStr.includes('crm') || itemsStr.includes('lead')) {
                dept = 'CRM';
            }
            
            const invDate = new Date(inv.createdAt);
            const dateStr = invDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            const dueDateStr = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
            const amt = Number(inv.amount || 0);
            const tax = Number(inv.taxAmount || 0);
            const total = Number(inv.totalAmount || 0);

            return {
                id: inv.invoiceNumber || inv.id,
                dbId: inv.id,
                client: inv.companyName,
                dept: dept,
                amount: `₹${amt.toLocaleString('en-IN')}`,
                gst: `18% (₹${tax.toLocaleString('en-IN')})`,
                total: `₹${total.toLocaleString('en-IN')}`,
                status: inv.status === 'Paid' ? 'Paid' : (inv.status === 'Sent' ? 'Pending' : inv.status),
                date: dateStr,
                dueDate: dueDateStr,
                invoiceFileName: inv.invoiceFileName || null,
                invoiceFileData: inv.invoiceFileData || null,
                notes: inv.notes || '',
                email: clientMap[inv.clientId]?.email || `accounts@${(inv.companyName || 'company').toLowerCase().replace(/\s+/g, '')}.com`,
                spoc: clientMap[inv.clientId]?.spocName || 'N/A'
            };
        });

        // 2. Expense Breakdown
        let totalMarketing = 0;
        let totalTools = 0;
        const expensesList = await Expense.findAll();
        expensesList.forEach(exp => {
            const cat = (exp.category || '').toLowerCase();
            const amt = Number(exp.amount || 0);
            if (cat.includes('marketing') || cat.includes('advertising') || cat.includes('lead') || cat.includes('sales')) {
                totalMarketing += amt;
            } else if (cat.includes('tool') || cat.includes('software') || cat.includes('license') || cat.includes('subscription')) {
                totalTools += amt;
            }
        });

        const expenseBreakdown = {
            salary: salaryPayout,
            office: totalRent,
            marketing: totalMarketing,
            tools: totalTools
        };

        // 3. Last 6 Months Chart Data
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthlyChartLabels = [];
        const monthlyRevenue = [];
        const monthlyExpenses = [];

        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const m = d.getMonth();
            const y = d.getFullYear();
            monthlyChartLabels.push(monthNames[m]);

            let mRevenue = 0;
            // Sum invoices for month m & year y
            invoices.forEach(inv => {
                const invDate = new Date(inv.createdAt || inv.dueDate);
                if (invDate.getMonth() === m && invDate.getFullYear() === y && (inv.status === 'Paid' || inv.status === 'Sent' || inv.status === 'Overdue')) {
                    mRevenue += Number(inv.totalAmount || 0);
                }
            });
            monthlyRevenue.push(mRevenue);

            let mExpense = 0;
            // Sum expenses for month m & year y
            expensesList.forEach(exp => {
                const expDate = new Date(exp.date || exp.createdAt);
                if (expDate.getMonth() === m && expDate.getFullYear() === y) {
                    mExpense += Number(exp.amount || 0);
                }
            });
            // Add monthly salary payout
            mExpense += salaryPayout;
            monthlyExpenses.push(mExpense);
        }

        // 4. Pending Collections Clients Count
        const pendingClientsSet = new Set();
        invoices.forEach(inv => {
            if (inv.status === 'Sent' || inv.status === 'Overdue') {
                pendingClientsSet.add(inv.clientId);
            }
        });
        const pendingCollectionsClientsCount = pendingClientsSet.size;

        const summaryData = {
            totalRevenue: formatCurrency(totalRevenue),
            activeClients,
            totalHiring,
            activeEmployees,
            totalAdmins,
            totalKAMs,
            retentionRate: '94%',
            outstandingPayment: formatCurrency(outstandingPayment),
            
            // Financial Details
            totalMonthlyBilling: formatCurrency(totalMonthlyBilling),
            totalYearlyRevenue: formatCurrency(totalRevenue),
            operationsBilling: formatCurrency(operationsBilling),
            recruitmentBilling: formatCurrency(recruitmentBilling),
            crmConvertedRevenue: formatCurrency(crmConvertedRevenue),
            salaryPayout: formatCurrency(salaryPayout),
            officeRentExpenses: formatCurrency(totalRent),
            netProfit: formatCurrency(netProfit),
            
            totalMRR: formatCurrency(totalMonthlyBilling),
            projectedARR: formatCurrency(totalRevenue * 12),
            totalSalaries: formatCurrency(salaryPayout),
            totalRent: formatCurrency(totalRent),

            recentInvoices,
            expenseBreakdown,
            monthlyChartLabels,
            monthlyRevenue,
            monthlyExpenses,
            pendingCollectionsClientsCount
        };

        res.status(200).json({
            success: true,
            data: summaryData
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const getDashboardKpiDetails = async (req, res) => {
    try {
        const { type } = req.query;
        if (!type) {
            return res.status(400).json({ success: false, message: 'Type parameter is required' });
        }

        let details = [];

        if (type === 'clients') {
            const clients = await Client.findAll();
            details = clients.map(c => ({
                id: c.id,
                name: c.name,
                email: c.email,
                phone: c.contactNumber || c.spocContact || 'N/A',
                industry: c.category || c.industry || 'Technology',
                status: c.status || 'Active',
                location: c.corporateAddress || 'N/A'
            }));
        } else if (type === 'admins') {
            const admins = await Admin.findAll();
            const superAdmins = await SuperAdmin.findAll();
            
            details = [
                ...superAdmins.map(sa => ({
                    id: sa.id,
                    name: sa.name,
                    email: sa.email,
                    phone: sa.phone || 'N/A',
                    role: 'Super Admin',
                    department: 'Management',
                    status: sa.status || 'Active'
                })),
                ...admins.map(a => ({
                    id: a.id,
                    name: a.name,
                    email: a.email,
                    phone: a.phone || 'N/A',
                    role: a.role || 'Admin',
                    department: a.department || 'Administration',
                    status: a.status || 'Active'
                }))
            ];
        } else if (type === 'kams') {
            const kams = await DepartmentTeam.findAll({
                where: { department: 'HR Recruitment' }
            });
            details = kams.map(k => ({
                id: k.id,
                name: k.name,
                email: k.email,
                phone: k.phone || 'N/A',
                role: k.role || 'KAM',
                department: k.department || 'HR Recruitment',
                status: k.status || 'Active'
            }));
        } else if (type === 'employees') {
            const employees = await Employee.findAll();
            const deptTeams = await DepartmentTeam.findAll();
            const teamLeaders = await TeamLeader.findAll();
            const admins = await Admin.findAll();
            const superAdmins = await SuperAdmin.findAll();

            details = [
                ...superAdmins.map(sa => ({
                    id: sa.id,
                    name: sa.name,
                    email: sa.email,
                    phone: sa.phone || 'N/A',
                    role: 'Super Admin',
                    designation: 'MD & Founder',
                    department: 'Management',
                    status: sa.status || 'Active'
                })),
                ...admins.map(a => ({
                    id: a.id,
                    name: a.name,
                    email: a.email,
                    phone: a.phone || 'N/A',
                    role: a.role || 'Admin',
                    designation: a.designation || 'Administrator',
                    department: a.department || 'Administration',
                    status: a.status || 'Active'
                })),
                ...teamLeaders.map(tl => ({
                    id: tl.id,
                    name: tl.name,
                    email: tl.email,
                    phone: tl.phone || 'N/A',
                    role: tl.role || 'Team Leader',
                    designation: tl.designation || 'Team Lead',
                    department: tl.department || 'Operations',
                    status: tl.status || 'Active'
                })),
                ...deptTeams.map(dt => ({
                    id: dt.id,
                    name: dt.name,
                    email: dt.email,
                    phone: dt.phone || 'N/A',
                    role: dt.role || 'Executive',
                    designation: dt.designation || 'Associate',
                    department: dt.department || 'Operations',
                    status: dt.status || 'Active'
                })),
                ...employees.map(e => ({
                    id: e.id,
                    name: e.name,
                    email: e.email,
                    phone: e.phone || 'N/A',
                    role: e.role || 'Employee',
                    designation: e.designation || 'Associate',
                    department: e.department || 'Operations',
                    status: e.status || 'Active'
                }))
            ];
        } else if (['total_monthly_billing', 'total_yearly_revenue', 'total_revenue', 'operations_billing', 'recruitment_billing', 'sales_revenue', 'office_rent', 'net_profit', 'salary_payout', 'pending_collections'].includes(type)) {
            const { Expense } = require('../models/sequelizeModels');
            
            // Build clientMap for quick lookups
            const clientMap = {};
            const clients = await Client.findAll();
            clients.forEach(c => {
                clientMap[c.id] = c;
            });

            // Helper to format invoices with full detail fields
            const formatInvoiceDetail = (inv, deptOverride = null) => {
                const itemsStr = JSON.stringify(inv.items || '').toLowerCase();
                const notesStr = (inv.notes || '').toLowerCase();
                const compName = (inv.companyName || '').toLowerCase();
                
                let dept = 'Operations';
                if (compName.includes('aerometric') || itemsStr.includes('recruitment') || itemsStr.includes('hiring') || notesStr.includes('recruitment')) {
                    dept = 'Recruitment';
                } else if (itemsStr.includes('crm') || notesStr.includes('crm') || itemsStr.includes('lead')) {
                    dept = 'CRM';
                }
                if (deptOverride) {
                    dept = deptOverride;
                }

                const amt = Number(inv.amount || 0);
                const tax = Number(inv.taxAmount || 0);
                const total = Number(inv.totalAmount || 0);
                const invDate = new Date(inv.createdAt || inv.dueDate || new Date());
                const dueDateVal = inv.dueDate ? new Date(inv.dueDate) : null;

                return {
                    id: inv.invoiceNumber || inv.id,
                    dbId: inv.id,
                    name: inv.companyName,
                    email: clientMap[inv.clientId]?.email || `accounts@${(inv.companyName || 'company').toLowerCase().replace(/\s+/g, '')}.com`,
                    phone: clientMap[inv.clientId]?.contactNumber || clientMap[inv.clientId]?.spocContact || 'N/A',
                    amount: `₹${amt.toLocaleString('en-IN')}`,
                    gst: `18% (₹${tax.toLocaleString('en-IN')})`,
                    total: `₹${total.toLocaleString('en-IN')}`,
                    ref: inv.invoiceNumber,
                    status: inv.status === 'Paid' ? 'Paid' : (inv.status === 'Sent' ? 'Pending' : inv.status),
                    dept: dept,
                    dueDate: dueDateVal ? dueDateVal.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A',
                    date: invDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
                    spoc: clientMap[inv.clientId]?.spocName || 'N/A',
                    invoiceFileName: inv.invoiceFileName || null,
                    invoiceFileData: inv.invoiceFileData || null,
                    notes: inv.notes || ''
                };
            };

            if (type === 'total_monthly_billing') {
                const currentMonth = new Date().getMonth();
                const currentYear = new Date().getFullYear();
                const invoices = await Invoice.findAll();
                const filteredInvoices = invoices.filter(inv => {
                    const invDate = new Date(inv.createdAt || inv.dueDate);
                    return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
                });
                details = filteredInvoices.map(inv => formatInvoiceDetail(inv));
            } else if (type === 'pending_collections') {
                const invoices = await Invoice.findAll();
                const filteredInvoices = invoices.filter(inv => inv.status === 'Sent' || inv.status === 'Overdue');
                details = filteredInvoices.map(inv => formatInvoiceDetail(inv));
            } else if (type === 'total_yearly_revenue' || type === 'total_revenue') {
                const invoices = await Invoice.findAll();
                const filteredInvoices = invoices.filter(inv => inv.status === 'Paid' || inv.status === 'Sent' || inv.status === 'Overdue');
                details = filteredInvoices.map(inv => formatInvoiceDetail(inv));
            } else if (type === 'operations_billing') {
                const invoices = await Invoice.findAll();
                details = [];
                invoices.forEach(inv => {
                    const invAmount = Number(inv.totalAmount || 0);
                    const itemsStr = JSON.stringify(inv.items || '').toLowerCase();
                    const notesStr = (inv.notes || '').toLowerCase();
                    const compName = (inv.companyName || '').toLowerCase();
                    
                    let isOps = false;
                    let isRec = false;
                    let isSales = false;
                    let isFallback = false;
                    
                    if (compName.includes('aerometric') || itemsStr.includes('recruitment') || itemsStr.includes('hiring') || notesStr.includes('recruitment')) {
                        isRec = true;
                    } else if (itemsStr.includes('operations') || itemsStr.includes('ops') || notesStr.includes('operations')) {
                        isOps = true;
                    } else if (itemsStr.includes('crm') || notesStr.includes('crm') || itemsStr.includes('lead')) {
                        isSales = true;
                    } else {
                        isFallback = true;
                    }
                    
                    if (isOps || isFallback) {
                        const baseAmt = Number(inv.amount || 0);
                        const taxAmt = Number(inv.taxAmount || 0);
                        const totalAmt = Number(inv.totalAmount || 0);
                        const allocatedAmt = isOps ? baseAmt : baseAmt * 0.5;
                        const allocatedTax = isOps ? taxAmt : taxAmt * 0.5;
                        const allocatedTotal = isOps ? totalAmt : totalAmt * 0.5;
                        
                        const formatted = formatInvoiceDetail(inv, 'Operations');
                        formatted.name = inv.companyName + (isFallback ? ' (50% Allocated)' : '');
                        formatted.amount = `₹${allocatedAmt.toLocaleString('en-IN')}`;
                        formatted.gst = `18% (₹${allocatedTax.toLocaleString('en-IN')})`;
                        formatted.total = `₹${allocatedTotal.toLocaleString('en-IN')}`;
                        details.push(formatted);
                    }
                });
            } else if (type === 'recruitment_billing') {
                const invoices = await Invoice.findAll();
                details = [];
                invoices.forEach(inv => {
                    const invAmount = Number(inv.totalAmount || 0);
                    const itemsStr = JSON.stringify(inv.items || '').toLowerCase();
                    const notesStr = (inv.notes || '').toLowerCase();
                    const compName = (inv.companyName || '').toLowerCase();
                    
                    let isOps = false;
                    let isRec = false;
                    let isSales = false;
                    let isFallback = false;
                    
                    if (compName.includes('aerometric') || itemsStr.includes('recruitment') || itemsStr.includes('hiring') || notesStr.includes('recruitment')) {
                        isRec = true;
                    } else if (itemsStr.includes('operations') || itemsStr.includes('ops') || notesStr.includes('operations')) {
                        isOps = true;
                    } else if (itemsStr.includes('crm') || notesStr.includes('crm') || itemsStr.includes('lead')) {
                        isSales = true;
                    } else {
                        isFallback = true;
                    }
                    
                    if (isRec || isFallback) {
                        const baseAmt = Number(inv.amount || 0);
                        const taxAmt = Number(inv.taxAmount || 0);
                        const totalAmt = Number(inv.totalAmount || 0);
                        const allocatedAmt = isRec ? baseAmt : baseAmt * 0.3;
                        const allocatedTax = isRec ? taxAmt : taxAmt * 0.3;
                        const allocatedTotal = isRec ? totalAmt : totalAmt * 0.3;
                        
                        const formatted = formatInvoiceDetail(inv, 'Recruitment');
                        formatted.name = inv.companyName + (isFallback ? ' (30% Allocated)' : '');
                        formatted.amount = `₹${allocatedAmt.toLocaleString('en-IN')}`;
                        formatted.gst = `18% (₹${allocatedTax.toLocaleString('en-IN')})`;
                        formatted.total = `₹${allocatedTotal.toLocaleString('en-IN')}`;
                        details.push(formatted);
                    }
                });
            } else if (type === 'sales_revenue') {
                const invoices = await Invoice.findAll();
                details = [];
                invoices.forEach(inv => {
                    const invAmount = Number(inv.totalAmount || 0);
                    const itemsStr = JSON.stringify(inv.items || '').toLowerCase();
                    const notesStr = (inv.notes || '').toLowerCase();
                    const compName = (inv.companyName || '').toLowerCase();
                    
                    let isOps = false;
                    let isRec = false;
                    let isSales = false;
                    let isFallback = false;
                    
                    if (compName.includes('aerometric') || itemsStr.includes('recruitment') || itemsStr.includes('hiring') || notesStr.includes('recruitment')) {
                        isRec = true;
                    } else if (itemsStr.includes('operations') || itemsStr.includes('ops') || notesStr.includes('operations')) {
                        isOps = true;
                    } else if (itemsStr.includes('crm') || notesStr.includes('crm') || itemsStr.includes('lead')) {
                        isSales = true;
                    } else {
                        isFallback = true;
                    }
                    
                    if (isSales || isFallback) {
                        const baseAmt = Number(inv.amount || 0);
                        const taxAmt = Number(inv.taxAmount || 0);
                        const totalAmt = Number(inv.totalAmount || 0);
                        const allocatedAmt = isSales ? baseAmt : baseAmt * 0.2;
                        const allocatedTax = isSales ? taxAmt : taxAmt * 0.2;
                        const allocatedTotal = isSales ? totalAmt : totalAmt * 0.2;
                        
                        const formatted = formatInvoiceDetail(inv, 'CRM');
                        formatted.name = inv.companyName + (isFallback ? ' (20% Allocated)' : '');
                        formatted.amount = `₹${allocatedAmt.toLocaleString('en-IN')}`;
                        formatted.gst = `18% (₹${allocatedTax.toLocaleString('en-IN')})`;
                        formatted.total = `₹${allocatedTotal.toLocaleString('en-IN')}`;
                        details.push(formatted);
                    }
                });
            } else if (type === 'office_rent') {
                const expensesList = await Expense.findAll();
                const filteredExpenses = expensesList.filter(exp => {
                    const cat = (exp.category || '').toLowerCase();
                    const vend = (exp.vendor || '').toLowerCase();
                    return cat.includes('rent') || cat.includes('office') || vend.includes('wework') || cat.includes('maintenance');
                });
                
                details = filteredExpenses.map(exp => ({
                    id: exp.id,
                    name: exp.vendor + ` (${exp.category})`,
                    email: exp.notes || 'Office Rent/Maintenance',
                    phone: 'N/A',
                    amount: `₹${Number(exp.amount || 0).toLocaleString('en-IN')}`,
                    ref: 'EXP-' + exp.id.substring(0, 8),
                    status: exp.status || 'Paid'
                }));
            } else if (type === 'salary_payout') {
                const admins = await Admin.findAll();
                const superAdmins = await SuperAdmin.findAll();
                const teamLeaders = await TeamLeader.findAll();
                const deptTeams = await DepartmentTeam.findAll();
                const employees = await Employee.findAll();
                
                details = [
                    ...superAdmins.map(sa => ({
                        id: sa.id,
                        name: sa.name + ' (Super Admin)',
                        email: sa.email,
                        phone: sa.phone || 'N/A',
                        amount: `₹1,50,000`,
                        ref: 'SA-' + sa.id.substring(0, 8),
                        status: 'Active'
                    })),
                    ...admins.map(a => ({
                        id: a.id,
                        name: a.name + ' (Admin)',
                        email: a.email,
                        phone: a.phone || 'N/A',
                        amount: `₹1,50,000`,
                        ref: 'AD-' + a.id.substring(0, 8),
                        status: 'Active'
                    })),
                    ...teamLeaders.map(tl => ({
                        id: tl.id,
                        name: tl.name + ' (Team Leader)',
                        email: tl.email,
                        phone: tl.phone || 'N/A',
                        amount: `₹85,000`,
                        ref: 'TL-' + tl.id.substring(0, 8),
                        status: 'Active'
                    })),
                    ...deptTeams.map(dt => ({
                        id: dt.id,
                        name: dt.name + ' (Dept Executive)',
                        email: dt.email,
                        phone: dt.phone || 'N/A',
                        amount: `₹60,000`,
                        ref: 'DT-' + dt.id.substring(0, 8),
                        status: 'Active'
                    })),
                    ...employees.map(e => ({
                        id: e.id,
                        name: e.name + ' (Employee)',
                        email: e.email,
                        phone: e.phone || 'N/A',
                        amount: `₹${(e.basicSalary ? Number(e.basicSalary) : 45000).toLocaleString('en-IN')}`,
                        ref: 'EMP-' + e.id.substring(0, 8),
                        status: 'Active'
                    }))
                ];
            } else if (type === 'net_profit') {
                const invoices = await Invoice.findAll();
                const paidInvoices = invoices.filter(inv => inv.status === 'Paid');
                
                const expensesList = await Expense.findAll();
                
                const admins = await Admin.findAll();
                const superAdmins = await SuperAdmin.findAll();
                const teamLeaders = await TeamLeader.findAll();
                const deptTeams = await DepartmentTeam.findAll();
                const employees = await Employee.findAll();
                
                const revenueDetails = paidInvoices.map(inv => ({
                    id: inv.id,
                    name: inv.companyName + ' (Invoice Paid)',
                    email: 'Revenue',
                    phone: 'N/A',
                    amount: `+₹${Number(inv.totalAmount || 0).toLocaleString('en-IN')}`,
                    ref: inv.invoiceNumber,
                    status: 'Active'
                }));
                
                const expenseDetails = expensesList.map(exp => ({
                    id: exp.id,
                    name: exp.vendor + ` (${exp.category})`,
                    email: 'Expense',
                    phone: 'N/A',
                    amount: `-₹${Number(exp.amount || 0).toLocaleString('en-IN')}`,
                    ref: 'EXP-' + exp.id.substring(0, 8),
                    status: 'Active'
                }));
                
                const salaryDetails = [
                    ...superAdmins.map(sa => ({
                        id: sa.id,
                        name: sa.name + ' (Super Admin Salary)',
                        email: 'Salary Payout',
                        phone: 'N/A',
                        amount: `-₹1,50,000`,
                        ref: 'SA-' + sa.id.substring(0, 8),
                        status: 'Active'
                    })),
                    ...admins.map(a => ({
                        id: a.id,
                        name: a.name + ' (Admin Salary)',
                        email: 'Salary Payout',
                        phone: 'N/A',
                        amount: `-₹1,50,000`,
                        ref: 'AD-' + a.id.substring(0, 8),
                        status: 'Active'
                    })),
                    ...teamLeaders.map(tl => ({
                        id: tl.id,
                        name: tl.name + ' (Team Leader Salary)',
                        email: 'Salary Payout',
                        phone: 'N/A',
                        amount: `-₹85,000`,
                        ref: 'TL-' + tl.id.substring(0, 8),
                        status: 'Active'
                    })),
                    ...deptTeams.map(dt => ({
                        id: dt.id,
                        name: dt.name + ' (Dept Executive Salary)',
                        email: 'Salary Payout',
                        phone: 'N/A',
                        amount: `-₹60,000`,
                        ref: 'DT-' + dt.id.substring(0, 8),
                        status: 'Active'
                    })),
                    ...employees.map(e => ({
                        id: e.id,
                        name: e.name + ' (Employee Salary)',
                        email: 'Salary Payout',
                        phone: 'N/A',
                        amount: `-₹${(e.basicSalary ? Number(e.basicSalary) : 45000).toLocaleString('en-IN')}`,
                        ref: 'EMP-' + e.id.substring(0, 8),
                        status: 'Active'
                    }))
                ];
                
                details = [...revenueDetails, ...expenseDetails, ...salaryDetails];
            }
        } else {
            return res.status(400).json({ success: false, message: 'Invalid type parameter' });
        }

        res.status(200).json({
            success: true,
            data: details
        });
    } catch (error) {
        console.error('Error fetching dashboard KPI details:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = {
    loginSuperAdmin,
    editSuperAdmin,
    getDashboardStats,
    getDashboardKpiDetails,
};
