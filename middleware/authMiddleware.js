const { verifyToken } = require("../utils/jwtUtils");

const normalizeRole = (value = '') =>
    String(value)
        .toLowerCase()
        .replace(/[\s_-]+/g, '');

const roleMapping = {
    superadmin: ['superadmin', 'super_admin'],
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
    kam: ['kam', 'key_account_manager', 'keyaccountmanager', 'kamrecruitment', 'kam_recruitment', 'kam recruitment', 'crm'],
    teamleader: ['teamleader', 'team_leader', 'tl', 'recruitmenthead', 'recruitment head', 'recruitment_head'],
    employee: [
        'employee',
        'user',
        'staff',
        'hr executive',
        'hrexecutive',
        'recruiter',
        'team member',
        'teammember',
        'departmentteam'
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

        // Add fallback for missing ID if email is present
        decoded = await resolveUserId(decoded);

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

        // Add fallback for missing ID if email is present
        decoded = await resolveUserId(decoded);

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
