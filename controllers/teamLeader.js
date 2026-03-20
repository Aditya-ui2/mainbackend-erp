// controllers/teamLeaderController.js

const { TeamLeader, Task, Employee, Client, Admin, sequelize } = require('../models/sequelizeModels');
const { Op } = require('sequelize');
const { hashPassword, comparePasswords } = require('../utils/bcryptUtils');
const { generateToken } = require('../utils/jwtUtils');
const { getOrCreateFolder, uploadFileToDrive, getFileLink, deleteFile } = require('../utils/googleDriveServices');
const formidable = require("formidable");
const fs = require("fs/promises");
const sendEmail = require('../utils/emailService');

// TeamLeader Creation with Email
const createTeamLeader = async (req, res) => {
    try {
        const { name, email, adminId, phone } = req.body;
        const defaultPassword = 'mabicons123';

        // Check if all required fields are present
        if (!name || !email || !adminId) {
            return res.status(400).json({ message: 'All fields are required (name, email, adminId)' });
        }

        // Find the Admin by ID
        const admin = await Admin.findByPk(adminId);
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        // Check if the email is already taken
        const existingTeamLeader = await TeamLeader.findOne({ where: { email } });
        if (existingTeamLeader) {
            return res.status(409).json({ message: 'Email already in use' });
        }

        // Hash the password
        const hashedPassword = await hashPassword(defaultPassword);

        // Create the new TeamLeader
        const teamLeader = await TeamLeader.create({
            name,
            email,
            password: hashedPassword,
            adminId: adminId,
            phone
        });

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

        const isPasswordValid = await comparePasswords(password, teamLeader.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = generateToken({ id: teamLeader.id, email: teamLeader.email, role: 'TeamLeader', department: teamLeader.department || 'Both' });

        res.status(200).json({
            message: 'Login successful',
            token,
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
        const { id, name, phone, password } = req.body;

        if (!id) {
            return res.status(400).json({ message: 'TeamLeader ID is required' });
        }

        const teamLeader = await TeamLeader.findByPk(id);
        if (!teamLeader) {
            return res.status(404).json({ message: 'TeamLeader not found' });
        }

        if (name) teamLeader.name = name;
        if (phone) teamLeader.phone = phone;
        if (password) {
            teamLeader.password = await hashPassword(password);
        }

        await teamLeader.save();

        res.status(200).json({
            message: 'TeamLeader updated successfully',
            teamLeader: {
                id: teamLeader.id,
                name: teamLeader.name,
                email: teamLeader.email,
                phone: teamLeader.phone
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
            attributes: ['id', 'name', 'email'],
            include: [{
                model: Employee,
                as: 'employees',
                attributes: ['id', 'name', 'email', 'phone']
            }]
        });

        if (!teamLeader) {
            return res.status(404).json({ message: 'Team Leader not found' });
        }

        res.status(200).json({
            message: 'Team Leader hierarchy retrieved successfully',
            teamLeader: {
                id: teamLeader.id,
                name: teamLeader.name,
                email: teamLeader.email,
                employees: teamLeader.employees
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

module.exports = {
    createTeamLeader,
    loginTeamLeader,
    editTeamLeader,
    deleteTeamLeaderWithReassignment,
    deleteTeamLeaderAndPromoteEmployee,
    getTeamLeaderHierarchy,
    getTeamLeaderTasks,
    getTeamLeaderDetails
};
