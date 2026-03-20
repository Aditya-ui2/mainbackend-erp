// controllers/adminController.js

const { Admin, TeamLeader, Employee } = require('../models/sequelizeModels');
const { Op } = require('sequelize');
const { hashPassword, comparePasswords } = require('../utils/bcryptUtils');
const { generateToken } = require('../utils/jwtUtils');
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

        // Compare the provided password with the stored hashed password
        const isPasswordValid = await comparePasswords(password, admin.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate a JWT token
        const token = generateToken({ id: admin.id, email: admin.email, role: 'Admin' });

        res.status(200).json({
            message: 'Login successful',
            token,
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

// Function to edit an existing Admin
const editAdmin = async (req, res) => {
    try {
        const { adminId, name, password } = req.body; // Admin details

        // Check if the Admin ID is provided
        if (!adminId) {
            return res.status(400).json({ message: 'Admin ID is required' });
        }

        // Find the Admin by ID
        const admin = await Admin.findByPk(adminId);
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        // Update Admin fields if they are provided
        if (name) admin.name = name;
        if (password) {
            // Hash the new password before saving
            admin.password = await hashPassword(password);
        }

        // Save the updated Admin
        await admin.save();

        res.status(200).json({
            message: 'Admin updated successfully',
            admin: {
                id: admin.id,
                name: admin.name,
                email: admin.email
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

// Function to get the hierarchy from Admin -> TeamLeaders -> Employees
const getAdminHierarchy = async (req, res) => {
    try {
        const { adminId } = req.body; // Get adminId from request body

        // Check if adminId is provided
        if (!adminId) {
            return res.status(400).json({ message: 'Admin ID is required' });
        }

        // Find the admin by ID and include their team leaders and their employees
        const adminHierarchy = await Admin.findByPk(adminId, {
            attributes: ['id', 'name', 'email'],
            include: [{
                model: TeamLeader,
                as: 'teamLeaders',
                attributes: ['id', 'name', 'email'],
                include: [{
                    model: Employee,
                    as: 'employees',
                    attributes: ['id', 'name', 'email']
                }]
            }]
        });

        // Check if admin exists
        if (!adminHierarchy) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        res.status(200).json({
            message: 'Admin hierarchy retrieved successfully',
            adminHierarchy
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
            role: 'Admin'
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



module.exports = {
    createAdmin,
    loginAdmin,
    editAdmin,
    deleteAdmin,
    getAdminHierarchy,
    updateAdminPassword,
    forgotPassword,
    resetPassword,
    getAllAdmins
};
