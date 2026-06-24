const express = require('express');
const router = express.Router();
const verifyAuthToken = require('../middleware/authMiddleware');
const { DepartmentTeam } = require('../models/sequelizeModels');
const { Op } = require('sequelize');

router.get('/executives', verifyAuthToken, async (req, res) => {
  try {
    const executives = await DepartmentTeam.findAll({
      where: {
        department: {
          [Op.in]: ['Sales', 'BD', 'CRM']
        }
      },
      attributes: ['id', 'name', 'role', 'department']
    });
    
    res.json({ success: true, executives });
  } catch (error) {
    console.error('Error fetching BD executives:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
