const express = require('express');
const { loginSuperAdmin, editSuperAdmin} = require('../controllers/superAdmin');
const verifyAuthToken = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authMiddleware');
const router = express.Router();

// Route to login SuperAdmin
router.post('/login', loginSuperAdmin);

// Route to edit SuperAdmin (requires SuperAdmin authentication)
router.put('/edit', verifyAuthToken, authorize('superadmin'), editSuperAdmin);
 



module.exports = router;