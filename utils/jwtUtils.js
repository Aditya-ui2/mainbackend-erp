const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET is not set in environment variables');
    process.exit(1);
}

const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!REFRESH_SECRET) {
    console.error('FATAL: JWT_REFRESH_SECRET is not set in environment variables');
    process.exit(1);
}
const ACCESS_EXPIRES = '1h';       // short-lived access token
const REFRESH_EXPIRES = '7d';      // long-lived refresh token

// Generate short-lived access token (1 hour)
const generateToken = (payload) => {
    try {
        return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
    } catch (error) {
        console.error("Error generating token:", error);
        throw new Error('Error generating token');
    }
};

// Generate long-lived refresh token (7 days)
const generateRefreshToken = (payload) => {
    try {
        // Only store minimal info in refresh token
        const refreshPayload = { id: payload.id, role: payload.role || payload.userType };
        return jwt.sign(refreshPayload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
    } catch (error) {
        console.error("Error generating refresh token:", error);
        throw new Error('Error generating refresh token');
    }
};

// Function to verify a JWT token
const verifyToken = (token) => {
    try {
        // Dev bypass for mock tokens
        if (token.endsWith('.mock-signature') && process.env.NODE_ENV !== 'production') {
            try {
                const base64Payload = token.split('.')[1];
                return JSON.parse(Buffer.from(base64Payload, 'base64').toString());
            } catch (e) {
                return null;
            }
        }
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        // Reduced logging for common expired/invalid cases to prevent console spam
        if (error.name !== 'TokenExpiredError' && error.name !== 'JsonWebTokenError') {
            console.error("JWT Verification error:", error.message);
        }
        return null; // Return null instead of throwing to let middleware handle it cleanly
    }
};

// Verify refresh token
const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, REFRESH_SECRET);
    } catch (error) {
        // Reduced logging for common expired/invalid cases to prevent console spam
        if (error.name !== 'TokenExpiredError' && error.name !== 'JsonWebTokenError') {
            console.error("JWT Refresh Verification error:", error.message);
        }
        return null; // Return null instead of throwing to let middleware handle it cleanly
    }
};

module.exports = {
    generateToken,
    generateRefreshToken,
    verifyToken,
    verifyRefreshToken
};
