const dotenv = require('dotenv');
dotenv.config();
// Set SSL to false for seeding script to prevent connection errors
process.env.DB_SSL = 'false';

const { Client, ClientAccount, sequelize } = require('./models/sequelizeModels');
const { v4: uuidv4 } = require('uuid');

async function seedData() {
    try {
        const clients = await Client.findAll();
        console.log(`Found ${clients.length} clients. Seeding account data...`);

        for (const client of clients) {
            const [account, created] = await ClientAccount.findOrCreate({
                where: { clientId: client.id },
                defaults: {
                    id: uuidv4(),
                    companyName: client.companyName || client.name,
                    totalOutstanding: 0,
                    clearedAmount: 0,
                    overdueAmount: 0,
                    pendingInvoicesCount: 0,
                    status: 'Cleared',
                    accountType: Math.random() > 0.5 ? 'Premium' : 'Standard',
                    lastInvoiceNumber: `INV-2024-${Math.floor(Math.random() * 100).toString().padStart(3, '0')}`
                }
            });

            // Randomize numbers to make it look real
            const totalOutstanding = Math.floor(Math.random() * 450000) + 50000;
            const clearedAmount = Math.floor(Math.random() * (totalOutstanding * 0.8));
            const pendingInvoices = Math.floor(Math.random() * 5) + 1;
            const isOverdue = Math.random() > 0.4;
            const overdueAmount = isOverdue ? Math.floor(Math.random() * (totalOutstanding - clearedAmount) * 0.5) : 0;
            const status = isOverdue ? 'Overdue' : (Math.random() > 0.5 ? 'Pending' : 'Cleared');

            await account.update({
                totalOutstanding,
                clearedAmount,
                overdueAmount,
                pendingInvoicesCount: pendingInvoices,
                status,
                companyName: client.companyName || client.name
            });

            console.log(`Updated account for ${client.companyName || client.name}: Outstanding: ₹${totalOutstanding}, Status: ${status}`);
        }

        console.log('Seeding completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding data:', err);
        process.exit(1);
    }
}

seedData();
