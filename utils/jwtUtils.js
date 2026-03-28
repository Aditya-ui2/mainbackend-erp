const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET is not set in environment variables');
    process.exit(1);
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Function to generate a JWT token
const generateToken = (payload) => {
    try {
        return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    } catch (error) {
        console.error("Error generating token:", error);
        throw new Error('Error generating token');
    }
};

// Function to verify a JWT token
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        console.error("Invalid or expired token:", error);
        throw new Error('Invalid or expired token');
    }
};

module.exports = {
    generateToken,
    verifyToken
};
