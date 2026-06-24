// controllers/teamLeaderController.js

const { TeamLeader, Task, Employee, Client, Admin, sequelize } = require('../models/sequelizeModels');
const { Op } = require('sequelize');
const { hashPassword, comparePasswords } = require('../utils/bcryptUtils');
const { generateToken, generateRefreshToken } = require('../utils/jwtUtils');
const { getOrCreateFolder, uploadFileToDrive, getFileLink, deleteFile } = require('../utils/googleDriveServices');
const formidable = require("formidable");
const fs = require("fs/promises");
const sendEmail = require('../utils/emailService');

// TeamLeader Creation with Email
const createTeamLeader = async (req, res) => {
    try {
        const { name, email, adminId, phone, department, role, documents } = req.body;
        const defaultPassword = 'mabicons123';

        // Check if all required fields are present
        if (!name || !email || !adminId) {
            return res.status(400).json({ message: 'All fields are required (name, email, adminId)' });
        }

        // Find the Admin by ID
        let admin = await Admin.findByPk(adminId);
        let finalAdminId = adminId;
        
        // If not found in Admins, check if it's a SuperAdmin or DepartmentTeam
        if (!admin) {
            const { SuperAdmin, DepartmentTeam } = require('../models/sequelizeModels');
            const isSuperOrDept = await SuperAdmin.findByPk(adminId) || await DepartmentTeam.findByPk(adminId);
            if (isSuperOrDept) {
                // Find any admin to satisfy the foreign key constraint
                admin = await Admin.findOne();
                if (admin) {
                    finalAdminId = admin.id;
                }
            }
        }

        if (!admin) {
            return res.status(404).json({ message: 'Admin not found and no default Admin exists to assign.' });
        }

        // Check if the email is already taken
        const existingTeamLeader = await TeamLeader.findOne({ where: { email } });
        if (existingTeamLeader) {
            return res.status(409).json({ message: 'Email already in use' });
        }

        // Hash the password
        const hashedPassword = await hashPassword(defaultPassword);

        let tlDepartment = 'Both';
        if (department && ['HR Operations', 'HR Recruitment', 'Both'].includes(department)) {
            tlDepartment = department;
        }

        // Create the new TeamLeader
        const teamLeader = await TeamLeader.create({
            name,
            email,
            password: hashedPassword,
            adminId: finalAdminId,
            phone,
            department: tlDepartment,
            documents: documents ? (typeof documents === 'string' ? JSON.parse(documents) : documents) : {}
        });

        if (department && department !== 'N/A' && department !== 'Other') {
            const { DepartmentTeam } = require('../models/sequelizeModels');
            const existingDeptTeam = await DepartmentTeam.findOne({ where: { email } });
            if (!existingDeptTeam) {
                await DepartmentTeam.create({
                    id: teamLeader.id,
                    name,
                    email,
                    password: hashedPassword,
                    phone,
                    department,
                    role: role || 'Team Leader',
                    managerId: finalAdminId,
                    documents: documents ? (typeof documents === 'string' ? JSON.parse(documents) : documents) : {}
                });
            }
        }

        // Send welcome email to team leader
        const emailContent = `
            <h2>Welcome to MabiconsERP!</h2>
            <p>Dear ${name},</p>
            <p>Your Team Leader account has been created successfully. Here are your login credentials:</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Default Password:</strong> ${defaultPassword}</p>
            <p>For security reasons, please change your password after your first login.</p>
            <p>You can access your dashboard at: <a href="[YOUR_DASHBOARD_URL]">[YOUR_DASHBOARD_URL]</a></p>
            <p>As a Team Leader, you will be responsible for:</p>
            <ul>
                <li>Managing your team members</li>
                <li>Overseeing client projects</li>
                <li>Coordinating with other team leaders</li>
            </ul>
            <p>If you have any questions, please contact your admin.</p>
            <p>Best regards,<br>MabiconsERP Team</p>
        `;

        try {
            await sendEmail({
                email: email,
                name: name,
                subject: 'Welcome to MabiconsERP - Team Leader Account Created',
                htmlContent: emailContent
            });
        } catch (emailError) {
            console.error('Error sending team leader welcome email:', emailError);
        }

        res.status(201).json({
            message: 'TeamLeader created successfully',
            teamLeader: {
                id: teamLeader.id,
                name: teamLeader.name,
                email: teamLeader.email,
                phone: teamLeader.phone
            }
        });
    } catch (error) {
        console.error('Error creating TeamLeader:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const loginTeamLeader = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const teamLeader = await TeamLeader.findOne({ where: { email } });
        if (!teamLeader) {
            return res.status(404).json({ message: 'Team Leader not found' });
        }

        if (teamLeader.status && teamLeader.status !== 'Active') {
            return res.status(401).json({ message: 'Account is blocked/disabled. Please contact administrator.' });
        }

        const isPasswordValid = await comparePasswords(password, teamLeader.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const payload = { 
            id: teamLeader.id, 
            email: teamLeader.email, 
            role: 'TeamLeader', 
            department: teamLeader.department || 'Both',
            passwordHash: teamLeader.password ? teamLeader.password.substring(0, 10) : undefined
        };
        const token = generateToken(payload);
        const refreshToken = generateRefreshToken(payload);

        // Silently log attendance check-in
        const { recordSilentLoginAttendance } = require('../utils/attendanceHelper');
        await recordSilentLoginAttendance(teamLeader.id, teamLeader.name, teamLeader.department || 'Management');

        res.status(200).json({
            message: 'Login successful',
            token,
            refreshToken,
            teamLeader: {
                id: teamLeader.id,
                name: teamLeader.name,
                email: teamLeader.email,
                department: teamLeader.department || 'Both'
            }
        });
    } catch (error) {
        console.error('Error logging in Team Leader:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Function to edit an existing TeamLeader
const editTeamLeader = async (req, res) => {
    try {
        const { id, name, email, phone, password, status, department, role } = req.body;

        if (!id) {
            return res.status(400).json({ message: 'TeamLeader ID is required' });
        }

        const teamLeader = await TeamLeader.findByPk(id);
        if (!teamLeader) {
            return res.status(404).json({ message: 'TeamLeader not found' });
        }

        // 1. Email ID Change Constraint
        if (email && email.toLowerCase().trim() !== teamLeader.email.toLowerCase().trim()) {
            const isRequesterTech = req.user && (
                String(req.user.email || '').toLowerCase().includes('tech') || 
                String(req.user.role || req.user.userType || '').toLowerCase().includes('tech')
            );
            if (!isRequesterTech) {
                return res.status(403).json({ message: 'Access denied. Email ID cannot be changed except by a tech person.' });
            }
            teamLeader.email = email;
        }

        // 2. Tech Password Change Constraint
        const isTargetTech = (
            String(teamLeader.email || '').toLowerCase().includes('tech') ||
            String(teamLeader.role || '').toLowerCase().includes('tech')
        );

        if (name) teamLeader.name = name;
        if (phone) teamLeader.phone = phone;
        if (password) {
            if (isTargetTech) {
                if (!req.user || req.user.id !== teamLeader.id) {
                    return res.status(403).json({ message: 'Access denied. Password of a tech person cannot be changed by others.' });
                }
            } else {
                const requesterRole = String(req.user?.role || req.user?.userType || '').trim().toLowerCase();
                const allowedRoles = ['tech', 'superadmin', 'super_admin', 'super admin', 'techperson', 'tech_person', 'tech person', 'manager', 'admin', 'administrator'];
                if (!allowedRoles.includes(requesterRole)) {
                    return res.status(403).json({ message: 'Access denied. Only authorized roles (Tech, Admin, Super Admin, Manager) can reset passwords.' });
                }
            }
            teamLeader.password = await hashPassword(password);
        }
        if (status) {
            const requesterRole = String(req.user?.role || req.user?.userType || '').trim().toLowerCase();
            const allowedRoles = ['tech', 'superadmin', 'super_admin', 'super admin', 'admin', 'administrator', 'manager'];
            if (!allowedRoles.includes(requesterRole)) {
                return res.status(403).json({ message: 'Access denied. Only Tech, Admin, Super Admin, and Manager can modify status.' });
            }
            teamLeader.status = status;
        }

        await teamLeader.save();

        // Cross-update DepartmentTeam if it exists (by ID or Email) to keep them in sync
        const { DepartmentTeam } = require('../models/sequelizeModels');
        const deptTeam = await DepartmentTeam.findOne({ where: { 
            [Op.or]: [ { id: teamLeader.id }, { email: teamLeader.email } ]
        }});
        if (deptTeam) {
            if (name) deptTeam.name = name;
            if (password) deptTeam.password = teamLeader.password;
            if (phone) deptTeam.phone = phone;
            if (status) deptTeam.status = status;
            if (department && department !== 'N/A' && department !== 'Other') deptTeam.department = department;
            if (role) deptTeam.role = role;
            await deptTeam.save();
        }

        res.status(200).json({
            message: 'TeamLeader updated successfully',
            teamLeader: {
                id: teamLeader.id,
                name: teamLeader.name,
                email: teamLeader.email,
                phone: teamLeader.phone,
                status: teamLeader.status
            }
        });
    } catch (error) {
        console.error('Error updating TeamLeader:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const deleteTeamLeaderWithReassignment = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const { teamLeaderId, newTeamLeaderId } = req.body;

        if (!teamLeaderId || !newTeamLeaderId) {
            return res.status(400).json({ message: 'Both Team Leader IDs are required' });
        }

        const [teamLeaderToDelete, newTeamLeader] = await Promise.all([
            TeamLeader.findByPk(teamLeaderId, { include: [{ model: Admin, as: 'admin' }] }),
            TeamLeader.findByPk(newTeamLeaderId)
        ]);

        if (!teamLeaderToDelete || !newTeamLeader) {
            return res.status(404).json({ message: 'One or both team leaders not found' });
        }

        if (teamLeaderId === newTeamLeaderId) {
            return res.status(400).json({ message: 'Cannot reassign to the same team leader' });
        }

        const employeesToUpdate = await teamLeaderToDelete.getEmployees();

        for (const employee of employeesToUpdate) {
            await employee.removeTeamLeader(teamLeaderToDelete, { transaction: t });
            await employee.addTeamLeader(newTeamLeader, { transaction: t });
        }

        await Task.update(
            { assignedToId: newTeamLeaderId },
            {
                where: {
                    assignedToType: 'TeamLeader',
                    assignedToId: teamLeaderId
                },
                transaction: t
            }
        );

        await Client.update(
            { teamLeaderId: newTeamLeaderId },
            {
                where: { teamLeaderId: teamLeaderId },
                transaction: t
            }
        );

        await teamLeaderToDelete.destroy({ transaction: t });

        // Clean up from DepartmentTeam table
        const { DepartmentTeam } = require('../models/sequelizeModels');
        if (DepartmentTeam) {
            await DepartmentTeam.destroy({
                where: {
                    [Op.or]: [
                        { id: teamLeaderId },
                        { email: teamLeaderToDelete.email }
                    ]
                },
                transaction: t
            });
        }

        try {
            await sendEmail({
                email: newTeamLeader.email,
                name: newTeamLeader.name,
                subject: 'Team Reassignment Notification',
                htmlContent: `
                    <h2>Team Reassignment Notice</h2>
                    <p>You have been assigned the team and responsibilities of ${teamLeaderToDelete.name}.</p>
                    <p>Please review your dashboard for updated team members and tasks.</p>
                `
            });

            for (const employee of employeesToUpdate) {
                await sendEmail({
                    email: employee.email,
                    name: employee.name,
                    subject: 'Team Leader Change Notification',
                    htmlContent: `
                        <h2>Team Leader Change Notice</h2>
                        <p>Your new team leader is ${newTeamLeader.name}.</p>
                        <p>Please reach out to them for any assistance or queries.</p>
                    `
                });
            }
        } catch (emailError) {
            console.error('Error sending notification emails:', emailError);
        }

        await t.commit();

        res.status(200).json({
            message: 'Team Leader deleted and reassigned successfully',
            newTeamLeader: {
                id: newTeamLeader.id,
                name: newTeamLeader.name,
                email: newTeamLeader.email
            }
        });
    } catch (error) {
        await t.rollback();
        console.error('Error in team leader reassignment:', error);
        res.status(500).json({
            message: 'Server error during reassignment',
            error: error.message
        });
    }
};

const deleteTeamLeaderAndPromoteEmployee = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const { oldTeamLeaderId, employeeToPromoteId } = req.body;

        if (!oldTeamLeaderId) {
            return res.status(400).json({ message: 'Team Leader ID is required' });
        }

        const oldTeamLeader = await TeamLeader.findByPk(oldTeamLeaderId, {
            include: [
                { model: Admin, as: 'admin' },
                { model: Employee, as: 'employees' },
                { model: Client, as: 'clients' }
            ]
        });
        
        if (!oldTeamLeader) {
            return res.status(404).json({ message: 'Team leader not found' });
        }

        if (employeeToPromoteId) {
            const employeeToPromote = await Employee.findByPk(employeeToPromoteId);
            if (!employeeToPromote) {
                return res.status(404).json({ message: 'Employee not found' });
            }

            const newTeamLeader = await TeamLeader.create({
                name: employeeToPromote.name,
                email: employeeToPromote.email,
                phone: employeeToPromote.phone,
                password: employeeToPromote.password,
                adminId: oldTeamLeader.adminId
            }, { transaction: t });

            const employees = await oldTeamLeader.getEmployees();
            for (const emp of employees) {
                if (emp.id !== employeeToPromoteId) {
                    await emp.removeTeamLeader(oldTeamLeader, { transaction: t });
                    await emp.addTeamLeader(newTeamLeader, { transaction: t });
                }
            }

            await Task.update(
                { assignedToId: newTeamLeader.id },
                {
                    where: {
                        assignedToType: 'TeamLeader',
                        assignedToId: oldTeamLeaderId
                    },
                    transaction: t
                }
            );

            await Client.update(
                { teamLeaderId: newTeamLeader.id },
                {
                    where: { teamLeaderId: oldTeamLeaderId },
                    transaction: t
                }
            );

            await oldTeamLeader.destroy({ transaction: t });
            await employeeToPromote.destroy({ transaction: t });

            // Clean up from DepartmentTeam table
            const { DepartmentTeam } = require('../models/sequelizeModels');
            if (DepartmentTeam) {
                await DepartmentTeam.destroy({
                    where: {
                        [Op.or]: [
                            { id: oldTeamLeaderId },
                            { email: oldTeamLeader.email }
                        ]
                    },
                    transaction: t
                });
                await DepartmentTeam.destroy({
                    where: {
                        [Op.or]: [
                            { id: employeeToPromoteId },
                            { email: employeeToPromote.email }
                        ]
                    },
                    transaction: t
                });
            }

            await t.commit();

            return res.status(200).json({
                message: 'Team leader successfully deleted and employee promoted',
                newTeamLeader: {
                    id: newTeamLeader.id,
                    name: newTeamLeader.name,
                    email: newTeamLeader.email
                }
            });
        } else {
            const employees = await oldTeamLeader.getEmployees();
            for (const emp of employees) {
                await emp.removeTeamLeader(oldTeamLeader, { transaction: t });
            }

            await Task.update(
                { assignedToType: null, assignedToId: null },
                {
                    where: {
                        assignedToType: 'TeamLeader',
                        assignedToId: oldTeamLeaderId
                    },
                    transaction: t
                }
            );

            await Client.update(
                { teamLeaderId: null },
                {
                    where: { teamLeaderId: oldTeamLeaderId },
                    transaction: t
                }
            );

            await oldTeamLeader.destroy({ transaction: t });

            // Clean up from DepartmentTeam table
            const { DepartmentTeam } = require('../models/sequelizeModels');
            if (DepartmentTeam) {
                await DepartmentTeam.destroy({
                    where: {
                        [Op.or]: [
                            { id: oldTeamLeaderId },
                            { email: oldTeamLeader.email }
                        ]
                    },
                    transaction: t
                });
            }

            await t.commit();

            return res.status(200).json({
                message: 'Team leader successfully deleted and references removed',
                deletedTeamLeader: {
                    id: oldTeamLeader.id,
                    name: oldTeamLeader.name,
                    email: oldTeamLeader.email
                }
            });
        }
    } catch (error) {
        await t.rollback();
        console.error('Error in team leader deletion process:', error);
        res.status(500).json({ message: 'Server error during team leader deletion process' });
    }
};

const getTeamLeaderHierarchy = async (req, res) => {
    try {
        const { teamLeaderId } = req.body;

        if (!teamLeaderId) {
            return res.status(400).json({ message: 'Team Leader ID is required' });
        }

        const teamLeader = await TeamLeader.findByPk(teamLeaderId, {
            attributes: ['id', 'name', 'email', 'status', 'documents'],
            include: [{
                model: Employee,
                as: 'employees',
                attributes: ['id', 'name', 'email', 'phone', 'documents', 'status']
            }]
        });

        if (!teamLeader) {
            return res.status(404).json({ message: 'Team Leader not found' });
        }

        const { DepartmentTeam } = require('../models/sequelizeModels');
        let tlDept = await DepartmentTeam.findOne({ where: { email: teamLeader.email } });
        if (!tlDept && teamLeader.name) {
            tlDept = await DepartmentTeam.findOne({
                where: {
                    name: { [Op.iLike]: teamLeader.name }
                }
            });
        }

        const rawTl = teamLeader.toJSON();
        const enrichedEmployees = await Promise.all(teamLeader.employees.map(async (emp) => {
            let empDept = await DepartmentTeam.findOne({ where: { email: emp.email } });
            if (!empDept && emp.name) {
                empDept = await DepartmentTeam.findOne({
                    where: {
                        name: { [Op.iLike]: emp.name }
                    }
                });
            }
            const rawEmp = emp.toJSON();
            return {
                ...rawEmp,
                documents: rawEmp.documents || {},
                status: rawEmp.status || 'Active',
                avatar: empDept ? (empDept.avatar || rawEmp.avatar || rawEmp.picture) : (rawEmp.avatar || rawEmp.picture || null),
                picture: empDept ? (empDept.avatar || rawEmp.picture || rawEmp.avatar) : (rawEmp.picture || rawEmp.avatar || null)
            };
        }));

        res.status(200).json({
            message: 'Team Leader hierarchy retrieved successfully',
            teamLeader: {
                id: teamLeader.id,
                name: teamLeader.name,
                email: teamLeader.email,
                status: teamLeader.status || 'Active',
                documents: teamLeader.documents || {},
                avatar: tlDept ? (tlDept.avatar || rawTl.avatar || rawTl.picture) : (rawTl.avatar || rawTl.picture || null),
                picture: tlDept ? (tlDept.avatar || rawTl.picture || rawTl.avatar) : (rawTl.picture || rawTl.avatar || null),
                employees: enrichedEmployees
            }
        });
    } catch (error) {
        console.error('Error retrieving Team Leader hierarchy:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getTeamLeaderTasks = async (req, res) => {
    try {
        const { teamLeaderId } = req.body;

        const teamLeader = await TeamLeader.findByPk(teamLeaderId);
        if (!teamLeader) {
            return res.status(404).json({ message: 'Team Leader not found' });
        }

        const tasks = await Task.findAll({
            where: {
                assignedToType: 'TeamLeader',
                assignedToId: teamLeaderId
            },
            include: [{
                model: Client,
                as: 'client',
                attributes: ['id', 'name']
            }]
        });

        res.status(200).json({
            message: 'Tasks fetched successfully',
            tasks
        });
    } catch (error) {
        console.error('Error fetching tasks for team leader:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getTeamLeaderDetails = async (req, res) => {
    try {
        const { teamLeaderId } = req.body;

        if (!teamLeaderId) {
            return res.status(400).json({ message: 'Team Leader ID is required.' });
        }

        const teamLeader = await TeamLeader.findByPk(teamLeaderId, {
            include: [
                {
                    model: Employee,
                    as: 'employees',
                    attributes: ['id', 'name', 'email', 'phone']
                },
                {
                    model: Client,
                    as: 'clients',
                    attributes: ['id', 'name', 'email', 'companyName']
                },
                {
                    model: Admin,
                    as: 'admin',
                    attributes: ['id', 'name', 'email']
                }
            ]
        });

        if (!teamLeader) {
            return res.status(404).json({ message: 'Team Leader not found.' });
        }

        const tasks = await Task.findAll({
            where: {
                [Op.or]: [
                    { assignedToType: 'TeamLeader', assignedToId: teamLeaderId },
                    { clientId: { [Op.in]: teamLeader.clients.map(c => c.id) } }
                ]
            },
            include: [{
                model: Client,
                as: 'client',
                attributes: ['id', 'name', 'email', 'companyName']
            }]
        });

        res.status(200).json({
            message: 'Team Leader details fetched successfully.',
            teamLeader: {
                ...teamLeader.toJSON(),
                tasks
            }
        });
    } catch (error) {
        console.error('Error fetching Team Leader details:', error);
        res.status(500).json({ message: 'Server error while fetching Team Leader details.', error: error.message });
    }
};

const getAllTeamLeaders = async (req, res) => {
    try {
        const teamLeaders = await TeamLeader.findAll({
            attributes: ['id', 'name', 'email', 'phone', 'department'],
            order: [['name', 'ASC']]
        });
        res.status(200).json({
            success: true,
            teamLeaders
        });
    } catch (error) {
        console.error('Error fetching all team leaders:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = {
    createTeamLeader,
    loginTeamLeader,
    editTeamLeader,
    deleteTeamLeaderWithReassignment,
    deleteTeamLeaderAndPromoteEmployee,
    getTeamLeaderHierarchy,
    getTeamLeaderTasks,
    getTeamLeaderDetails,
    getAllTeamLeaders
};

// Backwards-compatible alias matching requested API
exports.getHierarchy = async (req, res) => {
    try {
        const { id } = req.params
        const { role } = req.query
        if (role === 'TeamLeader') {
            const tl = await TeamLeader.findByPk(id)
            const emps = await Employee.findAll({ where: { teamLeaderId: id } })
            return res.json({ success: true, teamLeader: { ...tl?.toJSON(), employees: emps } })
        }
        const admin = await Admin.findByPk(id)
        const tls = await TeamLeader.findAll({ where: { adminId: id } })
        const tlsWithEmps = await Promise.all(tls.map(async (tl) => {
            const emps = await Employee.findAll({ where: { teamLeaderId: tl.id } })
            return { ...tl.toJSON(), employees: emps }
        }))
        res.json({ success: true, adminHierarchy: { ...admin?.toJSON(), teamLeaders: tlsWithEmps } })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
}
