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

        // Compare provided password with the stored hashed password
        const isPasswordValid = await comparePasswords(password, superAdmin.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate JWT tokens
        const payload = { id: superAdmin.id, email: superAdmin.email, role: 'SuperAdmin' };
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
        const { superAdminId, name, password } = req.body; // SuperAdmin details

        // Validate SuperAdmin ID
        if (!superAdminId) {
            return res.status(400).json({ message: 'SuperAdmin ID is required' });
        }

        // Find SuperAdmin by ID
        const superAdmin = await SuperAdmin.findByPk(superAdminId);
        if (!superAdmin) {
            return res.status(404).json({ message: 'SuperAdmin not found' });
        }

        // Update fields if provided
        if (name) superAdmin.name = name;
        if (password) {
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
        
        // Calculate total revenue and outstanding payments
        // We'll calculate sum from Invoices if they exist
        let totalRevenue = 0;
        let outstandingPayment = 0;
        
        try {
            const invoices = await Invoice.findAll();
            invoices.forEach(inv => {
                if (inv.status === 'Paid') {
                    totalRevenue += Number(inv.totalAmount || 0);
                } else if (inv.status === 'Sent' || inv.status === 'Overdue') {
                    outstandingPayment += Number(inv.totalAmount || 0);
                }
            });
        } catch (e) {
            console.log("Invoices table might not exist or empty");
        }
        
        // Format as Indian currency
        const formatCurrency = (val) => {
            if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
            if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
            return `₹${val.toLocaleString('en-IN')}`;
        };

        const summaryData = {
            totalRevenue: totalRevenue > 0 ? formatCurrency(totalRevenue) : '₹0',
            activeClients,
            totalHiring,
            activeEmployees,
            totalAdmins,
            totalKAMs,
            retentionRate: '94%', // Fixed for now
            outstandingPayment: outstandingPayment > 0 ? formatCurrency(outstandingPayment) : '₹0',
            totalMRR: '₹0', // Mock
            projectedARR: '₹0', // Mock
            totalSalaries: '₹0', // Mock
            totalRent: '₹0' // Mock
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

module.exports = {
    loginSuperAdmin,
    editSuperAdmin,
    getDashboardStats,
};
