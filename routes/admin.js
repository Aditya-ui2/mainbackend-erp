const express = require('express');
const { createAdmin, editAdmin, loginAdmin, deleteAdmin, getAdminHierarchy, updateAdminPassword, forgotPassword, resetPassword, getAllAdmins } = require('../controllers/admin');
const verifyAuthToken = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authMiddleware');
const router = express.Router();

// Route to get all admins (requires SuperAdmin, Admin, or TeamLeader authentication)
router.get('/all', verifyAuthToken, authorize('superadmin', 'admin', 'teamleader'), getAllAdmins);

// Route to create a new Admin (requires SuperAdmin authentication)
router.post('/create', verifyAuthToken, authorize('superadmin'), createAdmin);

// Route to edit an existing Admin (requires SuperAdmin authentication)
router.put('/edit', verifyAuthToken, authorize('superadmin', 'admin'), editAdmin);

// Route to login an Admin
router.post('/login', loginAdmin);

router.delete('/delete', verifyAuthToken, authorize('superadmin'), deleteAdmin);

router.post('/hierarchy', verifyAuthToken, getAdminHierarchy);

router.post('/update-password', verifyAuthToken, updateAdminPassword); 

router.post('/forgot-password', forgotPassword);

router.post('/reset-password/:token', resetPassword);

module.exports = router;