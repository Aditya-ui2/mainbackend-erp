// routes/authRoutes.js
const express = require('express');
const { forgotPassword, resetPassword } = require('../controllers/authControllers');
const { verifyRefreshToken, generateToken } = require('../utils/jwtUtils');
const router = express.Router(); 

// Forgot password route
router.post('/forgot-password', forgotPassword);

// Reset password route
router.post('/reset-password', resetPassword);

// Refresh token endpoint — exchange refresh token for new access token
router.post('/refresh-token', (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ success: false, message: 'Refresh token is required' });
        }

        const decoded = verifyRefreshToken(refreshToken);
        // Issue new short-lived access token
        const newAccessToken = generateToken({ id: decoded.id, role: decoded.role });

        res.status(200).json({ success: true, token: newAccessToken });
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid or expired refresh token. Please login again.' });
    }
});

module.exports = router;