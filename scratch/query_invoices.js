// scratch/query_invoices.js
const { sequelize, Invoice } = require('../models/sequelizeModels');

async function run() {
    try {
        await sequelize.authenticate();
        console.log("Connected.");
        const invoices = await Invoice.findAll();
        console.log(`Found ${invoices.length} invoices:`);
        invoices.forEach(inv => {
            console.log("\n------------------------------------");
            console.log("ID:", inv.id);
            console.log("Invoice Number:", inv.invoiceNumber);
            console.log("Company Name:", inv.companyName);
            console.log("Amount:", inv.amount);
            console.log("Total Amount:", inv.totalAmount);
            console.log("Status:", inv.status);
            console.log("Due Date:", inv.dueDate);
            console.log("Items:", JSON.stringify(inv.items));
            console.log("Notes:", inv.notes);
            console.log("Created At:", inv.createdAt);
        });
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
