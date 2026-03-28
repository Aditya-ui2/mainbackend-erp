const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET is not set in environment variables');
    process.exit(1);
}

const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET + '_refresh';
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
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        console.error("Invalid or expired token:", error.message);
        throw new Error('Invalid or expired token');
    }
};

// Verify refresh token
const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, REFRESH_SECRET);
    } catch (error) {
        console.error("Invalid or expired refresh token:", error.message);
        throw new Error('Invalid or expired refresh token');
    }
};

module.exports = {
    generateToken,
    generateRefreshToken,
    verifyToken,
    verifyRefreshToken
};
