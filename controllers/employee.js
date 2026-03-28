// controllers/employeeController.js
const { Employee, TeamLeader, Task, Client, sequelize } = require('../models/sequelizeModels');
const { Op } = require('sequelize');
const { hashPassword, comparePasswords } = require('../utils/bcryptUtils');
const sendEmail = require('../utils/emailService');
const { generateToken, generateRefreshToken } = require('../utils/jwtUtils');


// Employee Creation with Email
const createEmployee = async (req, res) => {
    const t = await sequelize.transaction();
    
    try {
        const { name, email, teamLeaderIds, phone } = req.body;
        const defaultPassword = 'mabicons123';

        // Validate input
        if (!name || !email || !teamLeaderIds || !teamLeaderIds.length) {
            return res.status(400).json({ message: 'All required fields are not provided' });
        }

        // Check if the email is already in use
        const existingEmployee = await Employee.findOne({ where: { email } });
        if (existingEmployee) {
            return res.status(400).json({ message: 'Email is already taken' });
        }

        // Hash the password
        const hashedPassword = await hashPassword(defaultPassword);

        // Create a new Employee
        const newEmployee = await Employee.create({
            name,
            email,
            password: hashedPassword,
            phone
        }, { transaction: t });

        // Find the team leaders and associate them with the employee
        const teamLeaders = await TeamLeader.findAll({
            where: { id: { [Op.in]: teamLeaderIds } }
        });

        await newEmployee.addTeamLeaders(teamLeaders, { transaction: t });

        await t.commit();

        // Send welcome email to employee
        const emailContent = `
            <h2>Welcome to MabiconsERP!</h2>
            <p>Dear ${name},</p>
            <p>Your employee account has been created successfully. Here are your login credentials:</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Default Password:</strong> ${defaultPassword}</p>
            <p>For security reasons, please change your password after your first login.</p>
            <p>You can access your dashboard at: <a href="[YOUR_DASHBOARD_URL]">[YOUR_DASHBOARD_URL]</a></p>
            <p>If you have any questions, please contact your team leader or the admin.</p>
            <p>Best regards,<br>MabiconsERP Team</p>
        `;

        try {
            await sendEmail({
                email: email,
                name: name,
                subject: 'Welcome to MabiconsERP - Employee Account Created',
                htmlContent: emailContent
            });
        } catch (emailError) {
            console.error('Error sending employee welcome email:', emailError);
        }

        res.status(201).json({
            message: 'Employee created successfully',
            employee: {
                id: newEmployee.id,
                name: newEmployee.name,
                email: newEmployee.email
            }
        });
    } catch (error) {
        await t.rollback();
        console.error('Error creating Employee:', error);
        res.status(500).json({ message: 'Server error' });
    }
};


const loginEmployee = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const employee = await Employee.findOne({ where: { email } });
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const isPasswordValid = await comparePasswords(password, employee.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const payload = { id: employee.id, email: employee.email, role: 'Employee' };
        const token = generateToken(payload);
        const refreshToken = generateRefreshToken(payload);

        res.status(200).json({
            message: 'Login successful',
            token,
            refreshToken,
            employee: {
                id: employee.id,
                name: employee.name,
                email: employee.email
            }
        });
    } catch (error) {
        console.error('Error logging in Employee:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Function to edit an Employee
const editEmployee = async (req, res) => {
    try {
        const { id, name, password, phone } = req.body;

        if (!id) {
            return res.status(400).json({ message: 'Employee ID is required' });
        }

        const employee = await Employee.findByPk(id);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        if (name) employee.name = name;
        if (password) employee.password = await hashPassword(password);
        if (phone) employee.phone = phone;

        await employee.save();

        res.status(200).json({
            message: 'Employee updated successfully',
            employee: {
                id: employee.id,
                name: employee.name,
                email: employee.email
            }
        });
    } catch (error) {
        console.error('Error updating Employee:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Function to delete an Employee
const deleteEmployee = async (req, res) => {
    try {
        const { employeeId } = req.body;

        if (!employeeId) {
            return res.status(400).json({ message: 'Employee ID is required' });
        }

        // Find the employee to delete
        const employee = await Employee.findByPk(employeeId);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Delete the employee (associations will be handled automatically)
        await employee.destroy();

        res.status(200).json({ message: 'Employee deleted successfully' });
    } catch (error) {
        console.error('Error deleting employee:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get employee tasks
const getEmployeeTasks = async (req, res) => {
    try {
        const { employeeId } = req.body;

        // Check if the employee exists
        const employee = await Employee.findByPk(employeeId);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Fetch tasks where the employee is assigned
        const tasks = await Task.findAll({
            where: {
                assignedToType: 'Employee',
                assignedToId: employeeId
            },
            include: [{
                model: Client,
                as: 'client',
                attributes: ['id', 'name']
            }],
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            success: true,
            message: 'Tasks fetched successfully',
            count: tasks.length,
            tasks
        });

    } catch (error) {
        console.error('Error fetching tasks for employee:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching tasks',
            error: error.message 
        });
    }
};
 

module.exports = {
    createEmployee,
    loginEmployee,
    editEmployee,
    deleteEmployee,
    getEmployeeTasks
};
