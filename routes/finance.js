const express = require('express');
const router = express.Router();
const financeController = require('../controllers/finance_sequelize');
const multer = require('multer');
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

// GET /finance/accounts
router.get('/accounts', financeController.getClientAccounts);

// GET /finance/account/:clientId
router.get('/account/:clientId', financeController.getAccountDetails);

// POST /finance/invoice/create
router.post('/invoice/create', financeController.createInvoice);

// PUT /finance/invoice/:invoiceId/status
router.put('/invoice/:invoiceId/status', financeController.updateInvoiceStatus);

// PUT /finance/account/:clientId/record-payment
router.put('/account/:clientId/record-payment', financeController.recordPayment);

// GET /finance/invoices
router.get('/invoices', financeController.getAllInvoices);

// GET /finance/expenses
router.get('/expenses', financeController.getExpenses);

// POST /finance/expense/create
router.post('/expense/create', financeController.createExpense);

// PUT /finance/expense/:expenseId/status
router.put('/expense/:expenseId/status', financeController.updateExpenseStatus);

// PUT /finance/expense/:expenseId
router.put('/expense/:expenseId', financeController.updateExpense);

// GET /finance/payments
router.get('/payments', financeController.getPayments);

// GET /finance/payment-requests
router.get('/payment-requests', financeController.getPaymentRequests);

// POST /finance/payment-request/create
router.post('/payment-request/create', upload.single('bill'), financeController.createPaymentRequest);

// PUT /finance/payment-request/:requestId
router.put('/payment-request/:requestId', upload.single('bill'), financeController.updatePaymentRequest);

// POST /finance/payment-request/:requestId/remind
router.post('/payment-request/:requestId/remind', financeController.sendPaymentReminder);

// GET /finance/employees-payroll
router.get('/employees-payroll', financeController.getEmployeesPayroll);

// GET /finance/profitability-reports
router.get('/profitability-reports', financeController.getProfitabilityReports);

// POST /finance/profitability-reports/generate
router.post('/profitability-reports/generate', financeController.generateProfitabilityReport);

// PUT /finance/profitability-reports/:id/status
router.put('/profitability-reports/:id/status', financeController.updateProfitabilityReportStatus);

// POST /finance/seed (internal use or one-time)
router.post('/seed', financeController.seedFinanceData);

module.exports = router;
