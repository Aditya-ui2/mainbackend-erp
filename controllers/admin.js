// controllers/adminController.js

const { Admin, TeamLeader, Employee, SuperAdmin } = require('../models/sequelizeModels');
const { Op } = require('sequelize');
const { hashPassword, comparePasswords } = require('../utils/bcryptUtils');
const { generateToken, generateRefreshToken } = require('../utils/jwtUtils');
const crypto = require('crypto');
const sendEmail = require('../utils/emailService');


const createAdmin = async (req, res) => {
    try {
        const { name, email } = req.body;
        
        // Generate a random password (8 characters with letters and numbers)
        const generateRandomPassword = () => {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
            let password = '';
            for (let i = 0; i < 10; i++) {
                password += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return password;
        };
        
        const generatedPassword = generateRandomPassword();

        // Check if all required fields are present
        if (!name || !email) {
            return res.status(400).json({ message: 'Name and email are required' });
        }

        // Check if the email is already taken by another Admin
        const existingAdmin = await Admin.findOne({ where: { email } });
        if (existingAdmin) {
            return res.status(409).json({ message: 'Email already in use' });
        }

        // Hash the generated password before saving
        const hashedPassword = await hashPassword(generatedPassword);

        // Create the new Admin
        const admin = await Admin.create({
            name,
            email,
            password: hashedPassword
        });

        // Send welcome email to admin
        const dashboardURL = 'https://mab-erp.vercel.app/login';
        const emailContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 10px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #4f46e5; margin: 0;">MabiconsERP</h1>
                    <p style="color: #6b7280; margin: 5px 0;">Enterprise Resource Planning</p>
                </div>
                
                <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <h2 style="color: #1f2937; margin-top: 0;">Welcome to MabiconsERP!</h2>
                    <p style="color: #4b5563;">Dear <strong>${name}</strong>,</p>
                    <p style="color: #4b5563;">Your Administrator account has been created successfully. Here are your login credentials:</p>
                    
                    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0; color: #374151;"><strong>Email:</strong> ${email}</p>
                        <p style="margin: 5px 0; color: #374151;"><strong>Password:</strong> <code style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px;">${generatedPassword}</code></p>
                    </div>
                    
                    <div style="text-align: center; margin: 25px 0;">
                        <a href="${dashboardURL}" style="background-color: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Login to Dashboard</a>
                    </div>
                    
                    <p style="color: #4b5563;"><strong>As an Administrator, you have access to:</strong></p>
                    <ul style="color: #4b5563;">
                        <li>Create and manage Team Leaders</li>
                        <li>Monitor all client activities</li>
                        <li>Access system-wide reports and analytics</li>
                        <li>Manage system configurations</li>
                    </ul>
                    
                    <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                        <p style="margin: 0; color: #92400e;"><strong>⚠️ Security Notice:</strong></p>
                        <p style="margin: 5px 0 0 0; color: #92400e;">Please change your password immediately after your first login for security purposes.</p>
                    </div>
                </div>
                
                <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">
                    This is an automated message from MabiconsERP. Please do not reply to this email.
                </p>
            </div>
        `;

        try {
            await sendEmail({
                email: email,
                name: name,
                subject: '🎉 Welcome to MabiconsERP - Your Admin Account is Ready!',
                htmlContent: emailContent
            });
        } catch (emailError) {
            console.error('Error sending admin welcome email:', emailError);
            // Continue with the response even if email fails
        }

        res.status(201).json({
            message: 'Admin created successfully. Login credentials have been sent to their email.',
            admin: {
                id: admin.id,
                name: admin.name,
                email: admin.email
            },
            emailSent: true
        });
    } catch (error) {
        console.error('Error creating Admin:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if email and password are provided
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Find the Admin by email
        const admin = await Admin.findOne({ where: { email } });
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        if (admin.status && admin.status !== 'Active') {
            return res.status(401).json({ message: 'Account is blocked/disabled. Please contact administrator.' });
        }

        // Compare the provided password with the stored hashed password
        const isPasswordValid = await comparePasswords(password, admin.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate JWT tokens
        const payload = { 
            id: admin.id, 
            email: admin.email, 
            role: 'Admin',
            passwordHash: admin.password ? admin.password.substring(0, 10) : undefined
        };
        const token = generateToken(payload);
        const refreshToken = generateRefreshToken(payload);

        res.status(200).json({
            message: 'Login successful',
            token,
            refreshToken,
            admin: {
                id: admin.id,
                name: admin.name,
                email: admin.email
            }
        });
    } catch (error) {
        console.error('Error logging in Admin:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const editAdmin = async (req, res) => {
    try {
        const { adminId, name, email, password, status } = req.body; // Admin details

        // Check if the Admin ID is provided
        if (!adminId) {
            return res.status(400).json({ message: 'Admin ID is required' });
        }

        // Find the Admin by ID
        const admin = await Admin.findByPk(adminId);
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        // 1. Email ID Change Constraint
        if (email && email.toLowerCase().trim() !== admin.email.toLowerCase().trim()) {
            const isRequesterTech = req.user && (
                String(req.user.email || '').toLowerCase().includes('tech') || 
                String(req.user.role || req.user.userType || '').toLowerCase().includes('tech')
            );
            if (!isRequesterTech) {
                return res.status(403).json({ message: 'Access denied. Email ID cannot be changed except by a tech person.' });
            }
            admin.email = email;
        }

        // 2. Tech Password Change Constraint
        const isTargetTech = (
            String(admin.email || '').toLowerCase().includes('tech') ||
            String(admin.role || '').toLowerCase().includes('tech')
        );

        // Update Admin fields if they are provided
        if (name) admin.name = name;
        if (password) {
            const requesterRole = String(req.user?.role || req.user?.userType || '').trim().toLowerCase();
            const requesterEmail = String(req.user?.email || '').trim().toLowerCase();
            const requesterName = String(req.user?.name || '').trim().toLowerCase();

            const isRequesterTech = requesterRole.includes('tech') || requesterEmail.includes('tech');
            const isRequesterAshish = requesterEmail.includes('ashish') || requesterName.includes('ashish') || requesterEmail === 'mabicons@gmail.com';
            const isSelf = req.user && req.user.id === admin.id;

            if (!isRequesterTech && !isRequesterAshish && !isSelf) {
                return res.status(403).json({ message: 'Access denied. Only Tech users and Ashish can reset passwords.' });
            }
            // Hash the new password before saving
            admin.password = await hashPassword(password);
        }
        if (status) {
            const requesterRole = String(req.user?.role || req.user?.userType || '').trim().toLowerCase();
            const allowedRoles = ['tech', 'superadmin', 'super_admin', 'super admin', 'admin', 'administrator', 'manager'];
            if (!allowedRoles.includes(requesterRole)) {
                return res.status(403).json({ message: 'Access denied. Only Tech, Admin, Super Admin, and Manager can modify status.' });
            }
            admin.status = status;
        }

        // Save the updated Admin
        await admin.save();

        res.status(200).json({
            message: 'Admin updated successfully',
            admin: {
                id: admin.id,
                name: admin.name,
                email: admin.email,
                status: admin.status
            }
        });
    } catch (error) {
        console.error('Error updating Admin:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const deleteAdmin = async (req, res) => {
    try {
        const { adminId } = req.body;

        if (!adminId) {
            return res.status(400).json({ message: 'Admin ID is required' });
        }

        const admin = await Admin.findByPk(adminId);
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        await admin.destroy();

        res.status(200).json({ message: 'Admin deleted successfully' });
    } catch (error) {
        console.error('Error deleting Admin:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getAttendanceCountForMember = async (memberId) => {
    const { Attendance } = require('../models/sequelizeModels');
    const { Op } = require('sequelize');
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startOfMonthStr = startOfMonth.toISOString().split('T')[0];
    const endOfMonthStr = endOfMonth.toISOString().split('T')[0];
    const daysInMonth = endOfMonth.getDate();

    try {
        const count = await Attendance.count({
            where: {
                memberId: memberId,
                date: {
                    [Op.between]: [startOfMonthStr, endOfMonthStr]
                },
                status: {
                    [Op.in]: ['Present', 'WFH', 'Present (Regularized)']
                }
            }
        });
        return { count, total: daysInMonth };
    } catch (err) {
        console.error(`Error counting attendance for member ${memberId}:`, err.message);
        return { count: 0, total: daysInMonth };
    }
};

const enrichEmployee = async (emp) => {
    const { DepartmentTeam } = require('../models/sequelizeModels');
    const { Op } = require('sequelize');
    const rawEmp = emp.toJSON ? emp.toJSON() : emp;
    let dept = await DepartmentTeam.findOne({
        where: {
            [Op.or]: [
                { id: rawEmp.id },
                { email: rawEmp.email }
            ]
        }
    });
    if (!dept && rawEmp.name) {
        dept = await DepartmentTeam.findOne({
            where: {
                name: { [Op.iLike]: rawEmp.name }
            }
        });
    }
    const att = await getAttendanceCountForMember(rawEmp.id);
    return {
        ...rawEmp,
        attendanceCount: att.count,
        totalDays: att.total,
        role: dept ? dept.role : 'Employee',
        department: dept ? dept.department : 'N/A',
        status: dept ? dept.status : rawEmp.status || 'Active',
        phone: rawEmp.phone || (dept ? dept.phone : '') || '',
        joiningDate: dept ? (dept.joinDate || dept.createdAt) : rawEmp.createdAt,
        documents: (dept && dept.documents && Object.keys(dept.documents).length > 0) ? dept.documents : (rawEmp.documents || {}),
        avatar: dept ? (dept.avatar || rawEmp.avatar || rawEmp.picture) : (rawEmp.avatar || rawEmp.picture || null),
        picture: dept ? (dept.avatar || rawEmp.picture || rawEmp.avatar) : (rawEmp.picture || rawEmp.avatar || null)
    };
};

const enrichTeamLeader = async (tl) => {
    const { DepartmentTeam } = require('../models/sequelizeModels');
    const { Op } = require('sequelize');
    const rawTl = tl.toJSON ? tl.toJSON() : tl;
    let dept = await DepartmentTeam.findOne({
        where: {
            [Op.or]: [
                { id: rawTl.id },
                { email: rawTl.email }
            ]
        }
    });
    if (!dept && rawTl.name) {
        dept = await DepartmentTeam.findOne({
            where: {
                name: { [Op.iLike]: rawTl.name }
            }
        });
    }
    const att = await getAttendanceCountForMember(rawTl.id);
    return {
        ...rawTl,
        attendanceCount: att.count,
        totalDays: att.total,
        role: dept ? dept.role : 'Team Leader',
        department: dept ? dept.department : rawTl.department || 'N/A',
        status: dept ? dept.status : rawTl.status || 'Active',
        phone: rawTl.phone || (dept ? dept.phone : '') || '',
        joiningDate: dept ? (dept.joinDate || dept.createdAt) : rawTl.createdAt,
        documents: (dept && dept.documents && Object.keys(dept.documents).length > 0) ? dept.documents : (rawTl.documents || {}),
        avatar: dept ? (dept.avatar || rawTl.avatar || rawTl.picture) : (rawTl.avatar || rawTl.picture || null),
        picture: dept ? (dept.avatar || rawTl.picture || rawTl.avatar) : (rawTl.picture || rawTl.avatar || null)
    };
};

// Function to get the hierarchy from Admin -> TeamLeaders -> Employees
const getAdminHierarchy = async (req, res) => {
    try {
        const { adminId } = req.body; // Get adminId from request body
        console.log('--- getAdminHierarchy called with adminId:', adminId);

        // Check if adminId is provided
        if (!adminId) {
            return res.status(400).json({ message: 'Admin ID is required' });
        }

        const { DepartmentTeam } = require('../models/sequelizeModels');

        // Find the admin by ID and include their team leaders and their employees
        let adminHierarchy = await Admin.findByPk(adminId, {
            attributes: ['id', 'name', 'email'],
            include: [{
                model: TeamLeader,
                as: 'teamLeaders',
                attributes: ['id', 'name', 'email', 'phone', 'department', 'status', 'documents'],
                include: [{
                    model: Employee,
                    as: 'employees',
                    attributes: [
                        'id', 'name', 'email', 'plainPassword', 'phone', 'status',
                        'basicSalary', 'leaveBalance', 'bankAccount', 'pfNumber', 'uanNumber', 'documents'
                    ]
                }]
            }]
        });

        // Enrich admin hierarchy if found
        if (adminHierarchy) {
            const rawHierarchy = adminHierarchy.toJSON ? adminHierarchy.toJSON() : adminHierarchy;
            if (rawHierarchy.teamLeaders) {
                rawHierarchy.teamLeaders = await Promise.all(rawHierarchy.teamLeaders.map(async (tl) => {
                    const enrichedTl = await enrichTeamLeader(tl);
                    if (enrichedTl.employees) {
                        enrichedTl.employees = await Promise.all(enrichedTl.employees.map(enrichEmployee));
                    }
                    return enrichedTl;
                }));
            }
            adminHierarchy = rawHierarchy;
        }

        // If not found in Admin table, check if this is a SuperAdmin requesting the system-wide hierarchy
        if (!adminHierarchy) {
            const superAdmin = await SuperAdmin.findByPk(adminId);
            if (superAdmin) {
                // Fetch all team leaders and employees in the system
                let allTeamLeaders = await TeamLeader.findAll({
                    attributes: ['id', 'name', 'email', 'phone', 'department', 'status', 'documents'],
                    include: [{
                        model: Employee,
                        as: 'employees',
                        attributes: [
                            'id', 'name', 'email', 'plainPassword', 'phone', 'status',
                            'basicSalary', 'leaveBalance', 'bankAccount', 'pfNumber', 'uanNumber', 'documents'
                        ]
                    }]
                });

                const enrichedTLs = await Promise.all(allTeamLeaders.map(async (tl) => {
                    const enrichedTl = await enrichTeamLeader(tl);
                    if (enrichedTl.employees) {
                        enrichedTl.employees = await Promise.all(enrichedTl.employees.map(enrichEmployee));
                    }
                    return enrichedTl;
                }));

                adminHierarchy = {
                    id: superAdmin.id,
                    name: superAdmin.name,
                    email: superAdmin.email,
                    teamLeaders: enrichedTLs
                };
            }
        }

        // If not found in Admin or SuperAdmin table, check if this is a DepartmentTeam manager
        if (!adminHierarchy) {
            const deptMember = await DepartmentTeam.findByPk(adminId);
            if (deptMember && (
                String(deptMember.role).toLowerCase() === 'manager' || 
                String(deptMember.role).toLowerCase() === 'super admin' || 
                String(deptMember.role).toLowerCase() === 'superadmin' || 
                String(deptMember.role).toLowerCase() === 'department head' ||
                String(deptMember.role).toLowerCase() === 'departmenthead'
            )) {
                // Fetch all team leaders and employees in the system
                let allTeamLeaders = await TeamLeader.findAll({
                    attributes: ['id', 'name', 'email', 'phone', 'department', 'status', 'documents'],
                    include: [{
                        model: Employee,
                        as: 'employees',
                        attributes: [
                            'id', 'name', 'email', 'plainPassword', 'phone', 'status',
                            'basicSalary', 'leaveBalance', 'bankAccount', 'pfNumber', 'uanNumber', 'documents'
                        ]
                    }]
                });

                const enrichedTLs = await Promise.all(allTeamLeaders.map(async (tl) => {
                    const enrichedTl = await enrichTeamLeader(tl);
                    if (enrichedTl.employees) {
                        enrichedTl.employees = await Promise.all(enrichedTl.employees.map(enrichEmployee));
                    }
                    return enrichedTl;
                }));

                adminHierarchy = {
                    id: deptMember.id,
                    name: deptMember.name,
                    email: deptMember.email,
                    teamLeaders: enrichedTLs
                };
            }
        }

        // Check token/db user roles for CRM/Sales/KAM fallback access to system hierarchy
        if (!adminHierarchy) {
            const tokenRole = String(req.user?.role || req.user?.userType || '').toLowerCase().trim();
            const tokenEmail = String(req.user?.email || '').toLowerCase().trim();
            
            // Try to find user in other tables to resolve details
            let dbUser = await Employee.findByPk(adminId);
            if (!dbUser) dbUser = await DepartmentTeam.findByPk(adminId);
            if (!dbUser) dbUser = await TeamLeader.findByPk(adminId);
            if (!dbUser) dbUser = await Admin.findByPk(adminId);
            if (!dbUser) dbUser = await SuperAdmin.findByPk(adminId);

            const dbRole = dbUser ? String(dbUser.role || '').toLowerCase().trim() : '';
            const dbEmail = dbUser ? String(dbUser.email || '').toLowerCase().trim() : '';

            const isAllowedRole = [
                'superadmin', 'super admin', 'admin', 'manager', 'crm', 'sales', 'kam', 
                'department head', 'departmenthead', 'hr head', 'hrhead', 'key account manager', 
                'keyaccountmanager', 'recruiter', 'recruitment head', 'recruitmenthead', 
                'hr recruitment head', 'hr recruitmenthead', 'hr operations head', 'hr operationshead', 
                'operations head', 'operationshead', 'tech', 'techperson', 'tech_person', 'tech person',
                'administrator'
            ].some(role => tokenRole.includes(role) || dbRole.includes(role) || tokenEmail.includes(role) || dbEmail.includes(role));

            if (isAllowedRole) {
                // Fetch all team leaders and employees in the system
                let allTeamLeaders = await TeamLeader.findAll({
                    attributes: ['id', 'name', 'email', 'phone', 'department', 'status', 'documents'],
                    include: [{
                        model: Employee,
                        as: 'employees',
                        attributes: [
                            'id', 'name', 'email', 'plainPassword', 'phone', 'status',
                            'basicSalary', 'leaveBalance', 'bankAccount', 'pfNumber', 'uanNumber', 'documents'
                        ]
                    }]
                });

                const enrichedTLs = await Promise.all(allTeamLeaders.map(async (tl) => {
                    const enrichedTl = await enrichTeamLeader(tl);
                    if (enrichedTl.employees) {
                        enrichedTl.employees = await Promise.all(enrichedTl.employees.map(enrichEmployee));
                    }
                    return enrichedTl;
                }));

                adminHierarchy = {
                    id: adminId,
                    name: dbUser?.name || req.user?.name || 'CRM Manager',
                    email: dbUser?.email || req.user?.email || '',
                    teamLeaders: enrichedTLs
                };
            }
        }

        // Check if admin/superadmin hierarchy exists
        if (!adminHierarchy) {
            return res.status(404).json({ message: 'Admin hierarchy not found' });
        }

        // Fallback/Merge: Combine legacy team leaders with SuperAdmins, DepartmentTeam managers, and independent employees
        if (adminHierarchy) {
            const rawHierarchy = adminHierarchy.toJSON ? adminHierarchy.toJSON() : adminHierarchy;
            const existingTeamLeaders = rawHierarchy.teamLeaders || [];
            
            // To avoid duplicating members who already exist in teamLeaders, keep track of emails
            const existingEmails = new Set(existingTeamLeaders.map(tl => (tl.email || '').toLowerCase().trim()));
            const rootEmail = (rawHierarchy.email || '').toLowerCase().trim();

            const teamLeaders = [...existingTeamLeaders];

            // 1. Fetch SuperAdmins to include Ashish
            const superAdmins = await SuperAdmin.findAll({
                attributes: ['id', 'name', 'email', 'status']
            });

            for (const sa of superAdmins) {
                const saEmail = (sa.email || '').toLowerCase().trim();
                if (saEmail === rootEmail || existingEmails.has(saEmail)) {
                    continue;
                }
                let saDept = await DepartmentTeam.findOne({ where: { email: sa.email } });
                if (!saDept && sa.name) {
                    saDept = await DepartmentTeam.findOne({
                        where: {
                            name: { [Op.iLike]: sa.name }
                        }
                    });
                }
                const rawSa = sa.toJSON ? sa.toJSON() : sa;
                teamLeaders.push({
                    id: rawSa.id,
                    name: rawSa.name,
                    email: rawSa.email,
                    phone: '',
                    role: 'Super Admin',
                    department: 'Management',
                    status: rawSa.status || 'Active',
                    documents: rawSa.documents || {},
                    avatar: saDept ? (saDept.avatar || rawSa.avatar || rawSa.picture) : (rawSa.avatar || rawSa.picture || null),
                    picture: saDept ? (saDept.avatar || rawSa.picture || rawSa.avatar) : (rawSa.picture || rawSa.avatar || null),
                    employees: []
                });
                existingEmails.add(saEmail);
            }

            // 2. Fetch DepartmentTeam Managers/Heads/Admins
            const deptManagers = await DepartmentTeam.findAll({
                where: {
                    [Op.or]: [
                        { role: { [Op.iLike]: '%manager%' } },
                        { role: { [Op.iLike]: '%head%' } },
                        { role: { [Op.iLike]: '%admin%' } }
                    ]
                }
            });

            for (const manager of deptManagers) {
                const managerEmail = (manager.email || '').toLowerCase().trim();
                if (managerEmail === rootEmail || existingEmails.has(managerEmail)) {
                    // If this manager is the root user (meaning managerEmail === rootEmail), they report directly to the root node.
                    // Instead of adding the manager as a team leader under themselves (which creates duplicate nodes),
                    // we add their direct employees directly to the teamLeaders list as direct reports of the root!
                    if (managerEmail === rootEmail && !existingEmails.has(managerEmail)) {
                        const employees = await DepartmentTeam.findAll({
                            where: { 
                                managerId: manager.id,
                                [Op.and]: [
                                    { role: { [Op.notILike]: '%manager%' } },
                                    { role: { [Op.notILike]: '%head%' } },
                                    { role: { [Op.notILike]: '%admin%' } }
                                ]
                            }
                        });

                        for (const emp of employees) {
                            const empEmail = (emp.email || '').toLowerCase().trim();
                            if (existingEmails.has(empEmail)) continue;

                            const empFinance = await Employee.findByPk(emp.id);
                            teamLeaders.push({
                                id: emp.id,
                                name: emp.name,
                                email: emp.email,
                                phone: emp.phone || (empFinance ? empFinance.phone : '') || '',
                                status: emp.status || 'Active',
                                role: emp.role || 'Employee',
                                department: emp.department || 'N/A',
                                basicSalary: empFinance ? empFinance.basicSalary : null,
                                leaveBalance: empFinance ? empFinance.leaveBalance : null,
                                bankAccount: empFinance ? empFinance.bankAccount : null,
                                pfNumber: empFinance ? empFinance.pfNumber : null,
                                uanNumber: empFinance ? empFinance.uanNumber : null,
                                plainPassword: empFinance ? empFinance.plainPassword : 'mabicons123',
                                avatar: emp.avatar || emp.picture || null,
                                picture: emp.picture || emp.avatar || null,
                                employees: [],
                                documents: emp.documents || (empFinance ? empFinance.documents : {}) || {}
                            });
                            existingEmails.add(empEmail);
                        }
                    }
                    continue;
                }

                const employees = await DepartmentTeam.findAll({
                    where: { 
                        managerId: manager.id,
                        [Op.and]: [
                            { role: { [Op.notILike]: '%manager%' } },
                            { role: { [Op.notILike]: '%head%' } },
                            { role: { [Op.notILike]: '%admin%' } }
                        ]
                    }
                });

                const formattedEmployees = [];
                for (const emp of employees) {
                    const empFinance = await Employee.findByPk(emp.id);
                    formattedEmployees.push({
                        id: emp.id,
                        name: emp.name,
                        email: emp.email,
                        phone: emp.phone || (empFinance ? empFinance.phone : '') || '',
                        status: emp.status || 'Active',
                        role: emp.role || 'Employee',
                        department: emp.department || 'N/A',
                        basicSalary: empFinance ? empFinance.basicSalary : null,
                        leaveBalance: empFinance ? empFinance.leaveBalance : null,
                        bankAccount: empFinance ? empFinance.bankAccount : null,
                        pfNumber: empFinance ? empFinance.pfNumber : null,
                        uanNumber: empFinance ? empFinance.uanNumber : null,
                        plainPassword: empFinance ? empFinance.plainPassword : 'mabicons123',
                        avatar: emp.avatar || emp.picture || null,
                        picture: emp.picture || emp.avatar || null,
                        documents: emp.documents || (empFinance ? empFinance.documents : {}) || {}
                    });
                }

                teamLeaders.push({
                    id: manager.id,
                    name: manager.name,
                    email: manager.email,
                    phone: manager.phone || '',
                    role: manager.role || 'Team Leader',
                    department: manager.department || 'N/A',
                    status: manager.status || 'Active',
                    avatar: manager.avatar || manager.picture || null,
                    picture: manager.picture || manager.avatar || null,
                    employees: formattedEmployees,
                    documents: manager.documents || {}
                });
                existingEmails.add(managerEmail);
            }

            // 3. Fetch independent DepartmentTeam members (e.g. managerId: null and not manager role)
            const independentMembers = await DepartmentTeam.findAll({
                where: {
                    managerId: null,
                    [Op.and]: [
                        { role: { [Op.notILike]: '%manager%' } },
                        { role: { [Op.notILike]: '%head%' } },
                        { role: { [Op.notILike]: '%admin%' } }
                    ]
                }
            });

            for (const member of independentMembers) {
                const memberEmail = (member.email || '').toLowerCase().trim();
                if (memberEmail === rootEmail || existingEmails.has(memberEmail)) {
                    continue;
                }

                const empFinance = await Employee.findByPk(member.id);
                teamLeaders.push({
                    id: member.id,
                    name: member.name,
                    email: member.email,
                    phone: member.phone || (empFinance ? empFinance.phone : '') || '',
                    role: member.role || 'Employee',
                    department: member.department || 'N/A',
                    status: member.status || 'Active',
                    basicSalary: empFinance ? empFinance.basicSalary : null,
                    leaveBalance: empFinance ? empFinance.leaveBalance : null,
                    bankAccount: empFinance ? empFinance.bankAccount : null,
                    pfNumber: empFinance ? empFinance.pfNumber : null,
                    uanNumber: empFinance ? empFinance.uanNumber : null,
                    plainPassword: empFinance ? empFinance.plainPassword : 'mabicons123',
                    avatar: member.avatar || member.picture || null,
                    picture: member.picture || member.avatar || null,
                    employees: [],
                    documents: member.documents || (empFinance ? empFinance.documents : {}) || {}
                });
                existingEmails.add(memberEmail);
            }

            rawHierarchy.teamLeaders = teamLeaders;
            adminHierarchy = rawHierarchy;
        }

        // Ensure adminHierarchy is a plain JS object and resolve its full database details
        let finalHierarchy = adminHierarchy.toJSON ? adminHierarchy.toJSON() : adminHierarchy;

        // Try to find the top-level user details in the database to fetch role, department, salary, etc.
        let topUser = await Employee.findByPk(finalHierarchy.id);
        if (!topUser) topUser = await DepartmentTeam.findByPk(finalHierarchy.id);
        if (!topUser) topUser = await TeamLeader.findByPk(finalHierarchy.id);
        if (!topUser) topUser = await Admin.findByPk(finalHierarchy.id);
        if (!topUser) topUser = await SuperAdmin.findByPk(finalHierarchy.id);

        if (topUser) {
            const rawUser = topUser.toJSON ? topUser.toJSON() : topUser;
            finalHierarchy.role = rawUser.role || (rawUser.email && (rawUser.email.includes('superadmin') || rawUser.email.includes('ashish')) ? 'Super Admin' : 'Manager');
            finalHierarchy.department = rawUser.department || 'Management';
            finalHierarchy.status = rawUser.status || 'Active';
            finalHierarchy.phone = rawUser.phone || '';
            finalHierarchy.basicSalary = rawUser.basicSalary || null;
            finalHierarchy.leaveBalance = rawUser.leaveBalance || null;
            finalHierarchy.bankAccount = rawUser.bankAccount || null;
            finalHierarchy.pfNumber = rawUser.pfNumber || null;
            finalHierarchy.uanNumber = rawUser.uanNumber || null;
            finalHierarchy.documents = rawUser.documents || {};

            let topUserDept = await DepartmentTeam.findOne({
                where: {
                    [Op.or]: [
                        { id: finalHierarchy.id },
                        { email: finalHierarchy.email }
                    ]
                }
            });
            if (!topUserDept && finalHierarchy.name) {
                topUserDept = await DepartmentTeam.findOne({
                    where: {
                        name: { [Op.iLike]: finalHierarchy.name }
                    }
                });
            }
            finalHierarchy.avatar = topUserDept ? (topUserDept.avatar || rawUser.avatar || rawUser.picture) : (rawUser.avatar || rawUser.picture || null);
            finalHierarchy.picture = topUserDept ? (topUserDept.avatar || rawUser.picture || rawUser.avatar) : (rawUser.picture || rawUser.avatar || null);
        } else {
            finalHierarchy.role = finalHierarchy.role || 'Manager';
            finalHierarchy.department = finalHierarchy.department || 'Management';
            finalHierarchy.status = finalHierarchy.status || 'Active';
        }

        res.status(200).json({
            message: 'Admin hierarchy retrieved successfully',
            adminHierarchy: finalHierarchy
        });
    } catch (error) {
        console.error('Error retrieving admin hierarchy:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const updateAdminPassword = async (req, res) => {
    try {
        const { adminId, newPassword } = req.body;

        // Validate inputs
        if (!adminId || !newPassword) {
            return res.status(400).json({ message: 'Admin ID and new password are required' });
        }

        // Validate admin existence
        const admin = await Admin.findByPk(adminId);
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        const requesterRole = String(req.user?.role || req.user?.userType || '').trim().toLowerCase();
        const requesterEmail = String(req.user?.email || '').trim().toLowerCase();
        const requesterName = String(req.user?.name || '').trim().toLowerCase();

        const isRequesterTech = requesterRole.includes('tech') || requesterEmail.includes('tech');
        const isRequesterAshish = requesterEmail.includes('ashish') || requesterName.includes('ashish') || requesterEmail === 'mabicons@gmail.com';
        const isSelf = req.user && req.user.id === admin.id;

        if (!isRequesterTech && !isRequesterAshish && !isSelf) {
            return res.status(403).json({ message: 'Access denied. Only Tech users and Ashish can reset passwords.' });
        }

        // Hash the new password
        const hashedPassword = await hashPassword(newPassword);

        // Update the password in the database
        admin.password = hashedPassword;
        await admin.save();

        res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error updating admin password:', error);
        res.status(500).json({ message: 'Server error' });
    }
};



// controllers/admin.js
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const admin = await Admin.findOne({ where: { email } });
        if (!admin) {
            return res.status(404).json({ message: 'No admin found with this email' });
        }

        const resetToken = admin.createPasswordResetToken();
        await admin.save();

        const resetURL = `https://mab-erp.vercel.app/reset-password/${resetToken}`;

        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #333;">Password Reset Request</h1>
                <p>Hello ${admin.name || 'Admin'},</p>
                <p>You requested to reset your password. Click the button below to reset it:</p>
                <p>
                    <a href="${resetURL}" 
                       style="background-color: #4CAF50; 
                              color: white; 
                              padding: 12px 24px; 
                              text-decoration: none; 
                              border-radius: 5px; 
                              display: inline-block;
                              margin: 20px 0;">
                        Reset My Password
                    </a>
                </p>
                <p>If you didn't request this, please ignore this email.</p>
                <p>This link will expire in 10 minutes.</p>
                <p style="color: #666;">If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #0066cc;">${resetURL}</p>
                <hr style="border: 1px solid #eee; margin: 20px 0;">
                <p>Best regards,<br>MabiconsERP Team</p>
            </div>
        `;

        try {
            await sendEmail({
                email: admin.email,
                subject: 'Password Reset Request',
                htmlContent,
                name: admin.name
            });

            res.status(200).json({
                status: 'success',
                message: 'Password reset instructions sent to email!'
            });
        } catch (err) {
            admin.resetPasswordToken = null;
            admin.resetPasswordExpires = null;
            await admin.save();

            console.error('Email sending error:', err);
            return res.status(500).json({
                message: 'There was an error sending the email. Try again later!'
            });
        }
    } catch (error) {
        console.error('Error in forgot password:', error);
        res.status(500).json({ message: 'Server error' });
    }
};


const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        // Validate password
        if (!password) {
            return res.status(400).json({
                message: 'New password is required'
            });
        }

        // Hash the reset token from params
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        // Find admin with valid token
        const admin = await Admin.findOne({
            where: {
                resetPasswordToken: hashedToken,
                resetPasswordExpires: { [Op.gt]: new Date() }
            }
        });

        if (!admin) {
            return res.status(400).json({
                message: 'Token is invalid or has expired'
            });
        }

        const isTargetTech = (
            String(admin.email || '').toLowerCase().includes('tech') ||
            String(admin.role || '').toLowerCase().includes('tech')
        );

        if (isTargetTech) {
            return res.status(403).json({ message: 'Access denied. Password of a tech person cannot be reset via token.' });
        }

        // Hash the new password using your existing hashPassword function
        const newHashedPassword = await hashPassword(password);

        // Update admin's password and clear reset token fields
        admin.password = newHashedPassword;
        admin.resetPasswordToken = null;
        admin.resetPasswordExpires = null;

        await admin.save();

        // Generate new login token
        const loginToken = generateToken({
            id: admin.id,
            email: admin.email,
            role: 'Admin',
            passwordHash: admin.password ? admin.password.substring(0, 10) : undefined
        });

        // Send success response
        res.status(200).json({
            message: 'Password reset successful',
            token: loginToken
        });

    } catch (error) {
        console.error('Error in reset password:', error);
        res.status(500).json({
            message: 'An error occurred while resetting password'
        });
    }
};

const getAllAdmins = async (req, res) => {
    try {
        const admins = await Admin.findAll({
            attributes: ['id', 'name', 'email', 'createdAt', 'updatedAt'],
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            message: 'Admins retrieved successfully',
            admins: admins.map(admin => ({
                id: admin.id,
                name: admin.name,
                email: admin.email,
                role: 'Admin',
                status: 'Active',
                createdAt: admin.createdAt
            }))
        });
    } catch (error) {
        console.error('Error fetching admins:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getDashboardKpiDetails = async (req, res) => {
    try {

        const { type } = req.params;
        let data = [];

        switch (type) {

            case "admins":
                data = await Admin.findAll({
                    attributes: ["id", "name", "email"]
                });

                data = data.map(item => ({
                    id: item.id,
                    name: item.name,
                    email: item.email,
                    phone: "",
                    designation: "Admin",
                    department: "Administration",
                    status: "Active"
                }));

                break;

            case "employees":

                data = await Employee.findAll();

                data = data.map(item => ({
                    id: item.id,
                    name: item.name,
                    email: item.email,
                    phone: item.phone || "",
                    designation: "Employee",
                    department: item.department || "",
                    status: item.status || "Active"
                }));

                break;

            default:
                data = [];
        }

        return res.status(200).json({
            success: true,
            data
        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};



module.exports = {
    createAdmin,
    loginAdmin,
    editAdmin,
    deleteAdmin,
    getAdminHierarchy,
    updateAdminPassword,
    forgotPassword,
    resetPassword,
    getAllAdmins,
    getDashboardKpiDetails
};
