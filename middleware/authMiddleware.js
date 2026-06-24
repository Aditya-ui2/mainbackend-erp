const { verifyToken } = require("../utils/jwtUtils");

const normalizeRole = (value = '') =>
    String(value)
        .toLowerCase()
        .replace(/[\s_-]+/g, '');

const roleMapping = {
    superadmin: ['superadmin', 'super_admin', 'super admin'],
    tech: ['tech', 'techperson', 'tech_person', 'tech person'],
    admin: [
        'admin',
        'administrator',
        'hrrecruitment',
        'hroperations',
        'department head',
        'departmenthead',
        'hr head',
        'hrhead',
        'manager'
    ],
    kam: ['kam', 'key_account_manager', 'keyaccountmanager', 'kamrecruitment', 'kam_recruitment', 'kam recruitment', 'recruitment_kam', 'recruitmentkam', 'recruitment kam', 'crm', 'departmentteam', 'recruiter', 'sales', 'saleskam', 'sales_kam', 'bd', 'bdexecutive', 'bd_executive', 'bd executive'],
    teamleader: ['teamleader', 'team_leader', 'tl', 'recruitmenthead', 'recruitment head', 'recruitment_head'],
    employee: [
        'employee',
        'user',
        'staff',
        'hr executive',
        'hrexecutive',
        'team member',
        'teammember'
    ],
    client: ['client', 'customer']
};

const hasRoleAccess = (userRole, allowedRoles = []) => {
    const normalizedUserRole = normalizeRole(userRole);

    return allowedRoles.some((allowedRole) => {
        const mappedRoles = roleMapping[allowedRole] || [allowedRole];
        return mappedRoles.some((role) => normalizeRole(role) === normalizedUserRole);
    });
};

/**
 * Shared logic to resolve missing ID from email
 */
const resolveUserId = async (decoded) => {
    if (!decoded || decoded.id || !decoded.email) return decoded;

    try {
        const { DepartmentTeam, Admin, SuperAdmin, TeamLeader, Employee } = require('../models/sequelizeModels');
        
        // Try DepartmentTeam first
        const member = await DepartmentTeam.findOne({ where: { email: decoded.email } });
        if (member) {
            decoded.id = member.id;
        } else {
            const otherModels = [Admin, SuperAdmin, TeamLeader, Employee];
            for (const Model of otherModels) {
                const user = await Model.findOne({ where: { email: decoded.email } });
                if (user) {
                    decoded.id = user.id;
                    break;
                }
            }
        }
    } catch (err) {
        console.error('Error resolving user ID in middleware:', err);
    }
    return decoded;
};

const verifyPasswordSignature = async (decoded) => {
    if (!decoded || !decoded.id) return true;
    const userRole = String(decoded.role || decoded.userType || '').trim().toLowerCase();
    
    if (userRole === 'employee') {
        try {
            const { Employee } = require('../models/sequelizeModels');
            const employee = await Employee.findByPk(decoded.id);
            if (!employee) return false;
            if (employee.status && employee.status !== 'Active') return false;
            
            // Verify password signature if present in the token
            if (decoded.pwdSig) {
                const dbSig = employee.password ? employee.password.slice(-10) : '';
                if (decoded.pwdSig !== dbSig) {
                    return false;
                }
            }
        } catch (err) {
            console.error('Error verifying employee signature in middleware:', err);
        }
    }
    return true;
};

/**
 * Check if the user is active and if their password hasn't been changed since the token was issued
 */
const checkUserStatusAndPW = async (decoded) => {
    if (!decoded || !decoded.email) return { valid: true };
    try {
        const { DepartmentTeam, Admin, SuperAdmin, TeamLeader, Employee, Client } = require('../models/sequelizeModels');
        const emailLower = decoded.email.toLowerCase().trim();
        const models = [SuperAdmin, Admin, TeamLeader, Employee, DepartmentTeam, Client];
        
        let dbUser = null;
        for (const Model of models) {
            dbUser = await Model.findOne({ where: { email: emailLower } });
            if (dbUser) break;
        }

        if (!dbUser) {
            if (process.env.NODE_ENV !== 'production') {
                return {
                    valid: true,
                    user: {
                        id: decoded.id || '00000000-0000-0000-0000-000000000000',
                        name: decoded.name || 'Mock User',
                        email: decoded.email,
                        role: decoded.role || 'employee',
                        status: 'Active'
                    }
                };
            }
            return { valid: false, message: 'User not found' };
        }

        // Check active status
        if (dbUser.status && dbUser.status !== 'Active' && dbUser.status !== 'Accepted') {
            return { valid: false, message: 'Account is blocked/disabled. Please contact administrator.' };
        }

        // Check password changed
        if (decoded.passwordHash && dbUser.password) {
            const currentHashPrefix = dbUser.password.substring(0, 10);
            if (decoded.passwordHash !== currentHashPrefix) {
                return { valid: false, message: 'Not authorized, password has changed. Please log in again.' };
            }
        }

        // Always align decoded.id with the actual database record ID
        decoded.id = dbUser.id;

        // Enrich decoded token fields from DB record
        decoded.name = dbUser.name;
        decoded.department = dbUser.department;
        if (dbUser.companyName) {
            decoded.companyName = dbUser.companyName;
        }

        return { valid: true, user: dbUser };
    } catch (err) {
        console.error('Error in checkUserStatusAndPW:', err);
        return { valid: true };
    }
};

/**
 * Legacy middleware - kept for backward compatibility
 */
const verifyAuthToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        let token;

        if (authHeader) {
            token = authHeader.split(' ')[1];
        } else if (req.query.token) {
            token = req.query.token;
        }

        if (!token) {
            return res.status(401).json({ message: 'Authorization token is missing' });
        }

        token = token.replace(/^"|"$/g, '');

        let decoded = verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }

        const isMockToken = token && token.endsWith('.mock-signature');
        if (isMockToken && process.env.NODE_ENV !== 'production') {
            req.user = decoded;
            return next();
        }

        const statusCheck = await checkUserStatusAndPW(decoded);
        if (!statusCheck.valid) {
            return res.status(401).json({ message: statusCheck.message });
        }

        // Verify password signature for session invalidation on password change
        const isSigValid = await verifyPasswordSignature(decoded);
        if (!isSigValid) {
            return res.status(401).json({ message: 'Session expired, password has changed. Please log in again.' });
        }

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

/**
 * @desc    Protect routes - Verify JWT token
 */
const protect = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];

        if (!authHeader) {
            return res.status(401).json({ 
                success: false, 
                message: 'Not authorized, no token provided' 
            });
        }

        const token = authHeader.startsWith('Bearer ') 
            ? authHeader.split(' ')[1] 
            : authHeader.replace(/^"|"$/g, '');

        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Not authorized, token missing' 
            });
        }

        let decoded = verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ 
                success: false, 
                message: 'Not authorized, invalid token' 
            });
        }

        const isMockToken = token && token.endsWith('.mock-signature');
        if (isMockToken && process.env.NODE_ENV !== 'production') {
            req.user = decoded;
            return next();
        }

        const statusCheck = await checkUserStatusAndPW(decoded);
        if (!statusCheck.valid) {
            return res.status(401).json({
                success: false,
                message: statusCheck.message
            });
        }

        // Verify password signature for session invalidation on password change
        const isSigValid = await verifyPasswordSignature(decoded);
        if (!isSigValid) {
            return res.status(401).json({ 
                success: false, 
                message: 'Session expired, password has changed. Please log in again.' 
            });
        }

        req.user = decoded;
        next();
    } catch (error) {
        console.error('Auth Error:', error);
        return res.status(401).json({ 
            success: false, 
            message: 'Not authorized' 
        });
    }
};

/**
 * @desc    Authorize specific roles
 * @param   {...string} roles - Allowed roles (admin, kam, employee, superadmin, teamleader, client)
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Not authorized' 
            });
        }

        // Normalize role names for comparison
        const userRole = req.user.role || req.user.userType || '';
        const allowedRoles = roles.map(r => String(r).toLowerCase());
        const isAuthorized = hasRoleAccess(userRole, allowedRoles);

        if (!isAuthorized) {
            return res.status(403).json({ 
                success: false, 
                message: `Access denied. Required roles: ${roles.join(', ')}` 
            });
        }

        next();
    };
};

/**
 * @desc    Client data isolation — clients can only access their own data
 *          Checks req.params.clientId or req.body.clientId against req.user.id
 *          Admins/SuperAdmins/TeamLeaders bypass this check
 */
const clientIsolation = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const userRole = req.user.role || req.user.userType || '';

    // Staff roles can access any client data
    if (hasRoleAccess(userRole, ['superadmin', 'admin', 'teamleader', 'kam', 'employee'])) {
        return next();
    }

    // For clients — ensure they only access their own data
    if (hasRoleAccess(userRole, ['client'])) {
        const userId = req.user.id;
        const requestedClientId = req.params.clientId || req.body.clientId || req.query.clientId || req.query.client;
        
        if (requestedClientId && requestedClientId !== userId) {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied. You can only access your own data.' 
            });
        }
        
        // Ensure controllers use the logged-in client's ID
        // Even if the frontend didn't send it, we force it for clients
        req.query.clientId = userId;
        req.query.client = userId;
        req.body.clientId = userId;
    }

    next();
};

// Export both styles for compatibility
module.exports = verifyAuthToken;
module.exports.protect = protect;
module.exports.authorize = authorize;
module.exports.verifyAuthToken = verifyAuthToken;
module.exports.clientIsolation = clientIsolation;
