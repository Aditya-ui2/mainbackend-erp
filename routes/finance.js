const express = require('express');
const router = express.Router();
const financeController = require('../controllers/finance_sequelize');

// GET /finance/accounts
router.get('/accounts', financeController.getClientAccounts);

// GET /finance/account/:clientId
router.get('/account/:clientId', financeController.getAccountDetails);

// POST /finance/invoice/create
router.post('/invoice/create', financeController.createInvoice);

// POST /finance/seed (internal use or one-time)
router.post('/seed', financeController.seedFinanceData);

module.exports = router;
