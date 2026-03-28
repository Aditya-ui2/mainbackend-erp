const { verifyToken } = require("../utils/jwtUtils");

/**
 * Legacy middleware - kept for backward compatibility
 */
const verifyAuthToken = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];

        // Check if the authorization header is present
        if (!authHeader) {
            return res.status(401).json({ message: 'Authorization header is missing' });
        }

        // Extract the token from the header (usually "Bearer <token>")
        let token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Token is missing' });
        }

        // Handle accidental quoted token in Authorization header.
        token = token.replace(/^"|"$/g, '');

        // Verify the token
        const decoded = verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }

        // Attach the decoded data to the request object (e.g., req.user)
        req.user = decoded;

        // Proceed to the next middleware or route handler
        next();
    } catch (error) {
        console.error('Error verifying token:', error);
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

/**
 * @desc    Protect routes - Verify JWT token
 */
const protect = (req, res, next) => {
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
            : authHeader;

        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Not authorized, token missing' 
            });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ 
                success: false, 
                message: 'Not authorized, invalid token' 
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
        const userRole = (req.user.role || req.user.userType || '').toLowerCase();
        const allowedRoles = roles.map(r => r.toLowerCase());

        // Role mapping for flexibility
        const roleMapping = {
            'superadmin': ['superadmin', 'super_admin'],
            'admin': ['admin', 'administrator'],
            'kam': ['kam', 'key_account_manager', 'keyaccountmanager'],
            'teamleader': ['teamleader', 'team_leader', 'tl'],
            'employee': ['employee', 'user', 'staff', 'department head', 'departmenthead'],
            'client': ['client', 'customer']
        };

        // Check if user role matches any allowed role
        const isAuthorized = allowedRoles.some(allowedRole => {
            const mappedRoles = roleMapping[allowedRole] || [allowedRole];
            return mappedRoles.includes(userRole) || userRole === allowedRole;
        });

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

    const userRole = (req.user.role || req.user.userType || '').toLowerCase();

    // Staff roles can access any client data
    if (['superadmin', 'admin', 'teamleader', 'kam', 'employee'].includes(userRole)) {
        return next();
    }

    // For clients — ensure they only access their own data
    if (userRole === 'client') {
        const requestedClientId = req.params.clientId || req.body.clientId || req.query.clientId;
        if (requestedClientId && requestedClientId !== req.user.id) {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied. You can only access your own data.' 
            });
        }
    }

    next();
};

// Export both styles for compatibility
module.exports = verifyAuthToken;
module.exports.protect = protect;
module.exports.authorize = authorize;
module.exports.verifyAuthToken = verifyAuthToken;
module.exports.clientIsolation = clientIsolation;