// controllers/employeeController.js
const { Employee, TeamLeader, Task, Client, sequelize, DepartmentTeam } = require('../models/sequelizeModels');
const { Op } = require('sequelize');
const { hashPassword, comparePasswords } = require('../utils/bcryptUtils');
const sendEmail = require('../utils/emailService');
const { generateToken, generateRefreshToken } = require('../utils/jwtUtils');

const notifyTechTeamOfNewEmployee = async (newEmployee, transaction) => {
    try {
        const { DepartmentTeam, Notification, Employee: EmpModel, TeamLeader: TlModel } = require('../models/sequelizeModels');
        const { Op } = require('sequelize');

        const techUsers = [];

        // 1. Find in DepartmentTeam (department is IT or role/email contains tech)
        const deptTechs = await DepartmentTeam.findAll({
            where: {
                [Op.or]: [
                    { department: 'IT' },
                    { role: { [Op.iLike]: '%tech%' } },
                    { email: { [Op.iLike]: '%tech%' } }
                ]
            },
            transaction
        });
        deptTechs.forEach(u => techUsers.push({ id: u.id, type: 'DepartmentTeam' }));

        // 2. Find in Employee
        const empTechs = await EmpModel.findAll({
            where: {
                email: { [Op.iLike]: '%tech%' }
            },
            transaction
        });
        empTechs.forEach(u => {
            if (!techUsers.some(exist => exist.id === u.id)) {
                techUsers.push({ id: u.id, type: 'Employee' });
            }
        });

        // 3. Find in TeamLeader
        const tlTechs = await TlModel.findAll({
            where: {
                email: { [Op.iLike]: '%tech%' }
            },
            transaction
        });
        tlTechs.forEach(u => {
            if (!techUsers.some(exist => exist.id === u.id)) {
                techUsers.push({ id: u.id, type: 'TeamLeader' });
            }
        });

        // 4. Create Notification for each identified tech user
        for (const user of techUsers) {
            await Notification.create({
                userId: user.id,
                userType: user.type,
                message: `New employee created: ${newEmployee.name} (${newEmployee.email}). Please reset their password to activate their login.`,
                status: 'unread',
                type: 'alert',
                priority: 'high'
            }, { transaction });
        }
        console.log(`Created new employee notifications for ${techUsers.length} tech users.`);
    } catch (err) {
        console.error('Failed to notify Tech team of new employee:', err.message);
    }
};


// Employee Creation with Email
const createEmployee = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const {
            name, email, teamLeaderIds, teamLeaderId, phone, department, role,
            bankAccount, pfNumber, uanNumber,
            basicSalary, hra, otherAllowances, deductions,
            leaveBalance, documents
        } = req.body;
        const defaultPassword = 'mabicons123';

        // Normalize teamLeaderIds to a clean array of values
        let normalizedIds = teamLeaderIds || teamLeaderId;
        if (typeof normalizedIds === 'string') {
            try {
                normalizedIds = JSON.parse(normalizedIds);
            } catch (e) {
                normalizedIds = [normalizedIds];
            }
        }
        if (typeof normalizedIds === 'number' || (normalizedIds && !Array.isArray(normalizedIds))) {
            normalizedIds = [normalizedIds];
        }
        if (!Array.isArray(normalizedIds)) {
            normalizedIds = [];
        }

        // Validate input
        if (!name || !email || !normalizedIds || !normalizedIds.length) {
            await t.rollback();
            return res.status(400).json({ message: 'All required fields are not provided (missing name, email, or teamLeaderIds)' });
        }

        // Check if the email is already in use
        const existingEmployee = await Employee.findOne({ where: { email }, transaction: t });
        if (existingEmployee) {
            await t.rollback();
            return res.status(400).json({ message: 'Email is already taken' });
        }

        // Hash the password
        const hashedPassword = await hashPassword(defaultPassword);

        // Create a new Employee
        const newEmployee = await Employee.create({
            name,
            email,
            password: hashedPassword,
            plainPassword: defaultPassword,
            phone,
            bankAccount,
            pfNumber,
            uanNumber,
            basicSalary: basicSalary !== undefined && basicSalary !== '' ? parseFloat(basicSalary) : null,
            hra: hra !== undefined && hra !== '' ? parseFloat(hra) : null,
            otherAllowances: otherAllowances !== undefined && otherAllowances !== '' ? parseFloat(otherAllowances) : null,
            deductions: deductions !== undefined && deductions !== '' ? parseFloat(deductions) : null,
            leaveBalance: leaveBalance !== undefined && leaveBalance !== '' ? parseInt(leaveBalance) : null,
            documents: documents ? (typeof documents === 'string' ? JSON.parse(documents) : documents) : {}
        }, { transaction: t });

        // Find the team leaders and associate them with the employee
        // Filter out any non-UUID values (e.g. mock fallback IDs) to prevent database type casting errors
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validLeaderIds = normalizedIds.filter(id => typeof id === 'string' && uuidRegex.test(id));

        const teamLeaders = await TeamLeader.findAll({
            where: { id: { [Op.in]: validLeaderIds } }
        });

        await newEmployee.addTeamLeaders(teamLeaders, { transaction: t });

        // If department is provided, also create a DepartmentTeam entry to ensure global visibility across department dashboards
        if (department && department !== 'N/A' && department !== 'Other') {
            // Normalize department to match DepartmentTeam ENUM values
            let normalizedDept = department;
            const deptLower = String(department).toLowerCase().trim();
            if (deptLower === 'recruitment') {
                normalizedDept = 'HR Recruitment';
            } else if (deptLower === 'operations') {
                normalizedDept = 'HR Operations';
            } else if (deptLower === 'tech') {
                normalizedDept = 'IT';
            } else if (deptLower === 'crm') {
                normalizedDept = 'CRM';
            } else if (deptLower === 'sales') {
                normalizedDept = 'Sales';
            } else if (deptLower === 'hr') {
                normalizedDept = 'HR';
            } else if (deptLower === 'accounts' || deptLower === 'finance') {
                normalizedDept = 'Finance';
            }

            const sachinId = '1e2cfcc6-a91d-4037-95db-88cb7b04d376'; // default fallback manager
            let managerId = null;

            // 1. Resolve manager via the assigned Team Leader
            if (validLeaderIds && validLeaderIds.length > 0) {
                const leader = await TeamLeader.findByPk(validLeaderIds[0], { transaction: t });
                if (leader) {
                    const searchDept = (leader.department === 'Both') ? 'HR Recruitment' : leader.department;
                    const deptHead = await DepartmentTeam.findOne({
                        where: {
                            department: searchDept,
                            role: { [Op.or]: ['Department Head', 'Manager', 'DepartmentHead', 'manager'] }
                        },
                        transaction: t
                    });
                    if (deptHead) {
                        managerId = deptHead.id;
                    }
                }
            }

            // 2. Check if validLeaderIds[0] directly points to a valid DepartmentTeam manager/head
            if (!managerId && validLeaderIds && validLeaderIds.length > 0) {
                const leaderExists = await DepartmentTeam.findByPk(validLeaderIds[0], { transaction: t });
                if (leaderExists) {
                    managerId = validLeaderIds[0];
                }
            }

            // 3. Check if the requester (req.user) is in DepartmentTeam
            if (!managerId && req.user && req.user.id) {
                const requesterExists = await DepartmentTeam.findByPk(req.user.id, { transaction: t });
                if (requesterExists) {
                    managerId = req.user.id;
                }
            }

            // 4. Check department head based on employee's normalized department
            if (!managerId && normalizedDept) {
                const deptHead = await DepartmentTeam.findOne({
                    where: {
                        department: normalizedDept,
                        role: { [Op.or]: ['Department Head', 'Manager', 'DepartmentHead', 'manager'] }
                    },
                    transaction: t
                });
                if (deptHead) {
                    managerId = deptHead.id;
                }
            }

            // 5. Search if Ashwin exists in the DB (highly likely manager for CRM/Sales)
            if (!managerId) {
                const ashwin = await DepartmentTeam.findOne({
                    where: { name: { [Op.iLike]: '%Ashwin%' } },
                    transaction: t
                });
                if (ashwin) {
                    managerId = ashwin.id;
                }
            }

            // 6. Fallback to the default manager (Sachin) if still null or invalid
            if (!managerId) {
                const sachinExists = await DepartmentTeam.findByPk(sachinId, { transaction: t });
                if (sachinExists) {
                    managerId = sachinId;
                } else {
                    // Find any existing manager to avoid constraint failure, or leave as null if DB is empty
                    const anyManager = await DepartmentTeam.findOne({
                        where: { role: { [Op.or]: ['Manager', 'Department Head', 'manager', 'department head'] } },
                        transaction: t
                    });
                    managerId = anyManager ? anyManager.id : null;
                }
            }

            // Check if it already exists to avoid unique constraint on email
            const existingDeptTeam = await DepartmentTeam.findOne({ where: { email }, transaction: t });
            if (!existingDeptTeam) {
                await DepartmentTeam.create({
                    id: newEmployee.id,
                    name,
                    email,
                    password: hashedPassword,
                    phone,
                    department: normalizedDept,
                    role: role || 'Team Member',
                    managerId,
                    documents: documents ? (typeof documents === 'string' ? JSON.parse(documents) : documents) : {}
                }, { transaction: t });
            }
        }

        await notifyTechTeamOfNewEmployee(newEmployee, t);
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

        if (employee.status && employee.status !== 'Active') {
            return res.status(401).json({ message: 'Account is blocked/disabled. Please contact administrator.' });
        }

        const isPasswordValid = await comparePasswords(password, employee.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const payload = {
            id: employee.id,
            email: employee.email,
            role: 'Employee',
            pwdSig: employee.password ? employee.password.slice(-10) : ''
        };
        const token = generateToken(payload);
        const refreshToken = generateRefreshToken(payload);

        // Silently log attendance check-in
        const { recordSilentLoginAttendance } = require('../utils/attendanceHelper');
        await recordSilentLoginAttendance(employee.id, employee.name, 'HR Operations');

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
        const { id, name, email, password, phone, status, department, role, documents, basicSalary, leaveBalance, bankAccount, pfNumber, uanNumber } = req.body;

        if (!id) {
            return res.status(400).json({ message: 'Employee ID is required' });
        }

        let userInstance = await Employee.findByPk(id);
        let userModelType = 'Employee';

        if (!userInstance) {
            const { TeamLeader, DepartmentTeam } = require('../models/sequelizeModels');
            userInstance = await TeamLeader.findByPk(id);
            userModelType = 'TeamLeader';

            if (!userInstance) {
                userInstance = await DepartmentTeam.findByPk(id);
                userModelType = 'DepartmentTeam';
            }
        }

        if (!userInstance) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 1. Email ID Change Constraint
        if (email && email.toLowerCase().trim() !== userInstance.email.toLowerCase().trim()) {
            const isRequesterTech = req.user && (
                String(req.user.email || '').toLowerCase().includes('tech') ||
                String(req.user.role || req.user.userType || '').toLowerCase().includes('tech')
            );
            if (!isRequesterTech) {
                return res.status(403).json({ message: 'Access denied. Email ID cannot be changed except by a tech person.' });
            }
            userInstance.email = email;
        }

        // 2. Tech Password Change Constraint
        const isTargetTech = (
            String(userInstance.email || '').toLowerCase().includes('tech') ||
            String(userInstance.role || userInstance.userType || '').toLowerCase().includes('tech')
        );

        if (name) userInstance.name = name;
        if (password) {
            const requesterRole = String(req.user?.role || req.user?.userType || '').trim().toLowerCase();
            const requesterEmail = String(req.user?.email || '').trim().toLowerCase();
            const requesterName = String(req.user?.name || '').trim().toLowerCase();

            const isRequesterTech = requesterRole.includes('tech') || requesterEmail.includes('tech');
            const isRequesterAshish = requesterEmail.includes('ashish') || requesterName.includes('ashish') || requesterEmail === 'mabicons@gmail.com';
            const isSelf = req.user && req.user.id === userInstance.id;

            if (!isRequesterTech && !isRequesterAshish && !isSelf) {
                return res.status(403).json({ message: 'Access denied. Only Tech users and Ashish can reset passwords.' });
            }
            userInstance.password = await hashPassword(password);
            userInstance.plainPassword = password;
        }
        if (phone) userInstance.phone = phone;
        if (status) {
            const requesterRole = String(req.user?.role || req.user?.userType || '').trim().toLowerCase();
            const allowedRoles = ['tech', 'superadmin', 'super_admin', 'super admin', 'admin', 'administrator', 'manager'];
            if (!allowedRoles.includes(requesterRole)) {
                return res.status(403).json({ message: 'Access denied. Only Tech, Admin, Super Admin, and Manager can modify status.' });
            }
            userInstance.status = status;
        }
        if (documents !== undefined) {
            userInstance.documents = typeof documents === 'string' ? JSON.parse(documents) : documents;
        }

        if (userModelType === 'Employee') {
            if (basicSalary !== undefined) {
                userInstance.basicSalary = (basicSalary === '' || basicSalary === null) ? null : parseFloat(basicSalary);
            }
            if (leaveBalance !== undefined) {
                userInstance.leaveBalance = (leaveBalance === '' || leaveBalance === null) ? null : parseInt(leaveBalance, 10);
            }
            if (bankAccount !== undefined) {
                userInstance.bankAccount = bankAccount;
            }
            if (pfNumber !== undefined) {
                userInstance.pfNumber = pfNumber;
            }
            if (uanNumber !== undefined) {
                userInstance.uanNumber = uanNumber;
            }
        }

        await userInstance.save();

        // Cross-update DepartmentTeam if it exists (by ID or Email) to keep them in sync
        const { DepartmentTeam } = require('../models/sequelizeModels');
        const deptTeam = await DepartmentTeam.findOne({
            where: {
                [Op.or]: [{ id: userInstance.id }, { email: userInstance.email }]
            }
        });
        if (deptTeam) {
            if (name) deptTeam.name = name;
            if (password) deptTeam.password = userInstance.password;
            if (phone) deptTeam.phone = phone;
            if (status) deptTeam.status = status;
            if (department && department !== 'N/A' && department !== 'Other') deptTeam.department = department;
            if (role) deptTeam.role = role;
            if (documents !== undefined) {
                deptTeam.documents = typeof documents === 'string' ? JSON.parse(documents) : documents;
            }
            await deptTeam.save();
        }

        res.status(200).json({
            message: 'Employee updated successfully',
            employee: {
                id: userInstance.id,
                name: userInstance.name,
                email: userInstance.email,
                status: userInstance.status,
                modelType: userModelType
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

        const { DepartmentTeam } = require('../models/sequelizeModels');
        const { Op } = require('sequelize');

        // Find the employee to delete
        const employee = await Employee.findByPk(employeeId);
        if (!employee) {
            // Check if they only exist in DepartmentTeam table
            const deptMember = await DepartmentTeam.findByPk(employeeId);
            if (deptMember) {
                await deptMember.destroy();
                return res.status(200).json({ message: 'Employee deleted from DepartmentTeam successfully' });
            }
            return res.status(404).json({ message: 'Employee not found' });
        }

        const email = employee.email;

        // Delete from Employee table
        await employee.destroy();

        // Delete from DepartmentTeam table if exists
        await DepartmentTeam.destroy({
            where: {
                [Op.or]: [
                    { id: employeeId },
                    { email: email }
                ]
            }
        });

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

// Reset password handler (also available via routes)
exports.resetPassword = async (req, res) => {
    try {
        const { password } = req.body
        const bcrypt = require('bcrypt')
        const emp = await Employee.findByPk(req.params.id)
        if (!emp) return res.status(404).json({ success: false, error: 'Employee not found' })

        const isTargetTech = (
            String(emp.email || '').toLowerCase().includes('tech') ||
            String(emp.role || emp.userType || '').toLowerCase().includes('tech')
        );

        const requesterRole = String(req.user?.role || req.user?.userType || '').trim().toLowerCase();
        const requesterEmail = String(req.user?.email || '').trim().toLowerCase();
        const requesterName = String(req.user?.name || '').trim().toLowerCase();

        const isRequesterTech = requesterRole.includes('tech') || requesterEmail.includes('tech');
        const isRequesterAshish = requesterEmail.includes('ashish') || requesterName.includes('ashish') || requesterEmail === 'mabicons@gmail.com';
        const isSelf = req.user && req.user.id === emp.id;

        if (!isRequesterTech && !isRequesterAshish && !isSelf) {
            return res.status(403).json({ success: false, error: 'Access denied. Only Tech users and Ashish can reset passwords.' });
        }

        const hashed = await bcrypt.hash(password, 10)
        emp.password = hashed
        emp.plainPassword = password
        await emp.save()
        res.json({ success: true, message: 'Password updated' })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
}
