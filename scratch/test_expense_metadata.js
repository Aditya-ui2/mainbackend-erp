require('dotenv').config();
const { Expense, sequelize } = require('../models/sequelizeModels');
const { v4: uuidv4 } = require('uuid');

async function testExpenseMetadata() {
    try {
        await sequelize.authenticate();
        console.log('Database connected successfully.');

        // 1. Create a pending expense
        const expenseId = uuidv4();
        console.log(`Creating test pending expense with ID: ${expenseId}`);
        const newExpense = await Expense.create({
            id: expenseId,
            category: 'Office Rent',
            vendor: 'Test DLF Vendor',
            amount: 45000.00,
            status: 'Pending',
            date: '2026-06-03',
            notes: 'Test initial notes'
        });
        console.log('Test expense created: ID =', newExpense.id, ', Status =', newExpense.status);

        // 2. Call the update logic (simulating req.body from the controller)
        const updatePayload = {
            status: 'Paid',
            paymentMethod: 'Bank Transfer',
            transactionRef: 'UTR-TEST-MABICONS-9901',
            paymentDate: '2026-06-03',
            receiptFileName: 'test_dlf_invoice.pdf',
            notes: 'Paying rent for Gurugram office'
        };

        console.log('Simulating status update with payload:', updatePayload);

        // Mimic the controller logic:
        let updatedFields = { status: updatePayload.status };
        if (updatePayload.status === 'Paid') {
            const paymentDetails = {
                paymentMethod: updatePayload.paymentMethod || 'Bank Transfer',
                transactionRef: updatePayload.transactionRef || '',
                paymentDate: updatePayload.paymentDate || new Date().toISOString().split('T')[0],
                receiptFileName: updatePayload.receiptFileName || '',
                additionalNotes: updatePayload.notes || ''
            };
            updatedFields.notes = JSON.stringify(paymentDetails);
        }

        const expenseToUpdate = await Expense.findByPk(expenseId);
        if (!expenseToUpdate) {
            throw new Error('Expense not found for update!');
        }

        await expenseToUpdate.update(updatedFields);
        console.log('Test expense updated in database.');

        // 3. Fetch from DB again to verify persistence and serialization
        const fetchedExpense = await Expense.findByPk(expenseId);
        console.log('\n--- VERIFICATION FROM DATABASE ---');
        console.log('Fetched Status:', fetchedExpense.status);
        console.log('Raw Notes Column Content:', fetchedExpense.notes);

        // Check if JSON parses correctly
        try {
            const parsed = JSON.parse(fetchedExpense.notes);
            console.log('Successfully parsed payment details JSON:', parsed);
            if (
                parsed.paymentMethod === updatePayload.paymentMethod &&
                parsed.transactionRef === updatePayload.transactionRef &&
                parsed.receiptFileName === updatePayload.receiptFileName &&
                parsed.additionalNotes === updatePayload.notes
            ) {
                console.log('SUCCESS: All payment details verified matches payload!');
            } else {
                console.log('FAILED: Fields do not match payload.');
            }
        } catch (jsonErr) {
            console.error('FAILED: Notes column is not a valid JSON string:', jsonErr.message);
        }

        // 4. Cleanup test data
        console.log('\nCleaning up test expense...');
        await fetchedExpense.destroy();
        console.log('Test expense deleted successfully.');

    } catch (error) {
        console.error('Test execution failed:', error);
    } finally {
        await sequelize.close();
    }
}

testExpenseMetadata();
