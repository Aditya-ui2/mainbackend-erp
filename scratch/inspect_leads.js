const { Lead } = require('../models/sequelizeModels');
require('dotenv').config();

async function run() {
    try {
        // Find or create test lead
        const [lead, created] = await Lead.findOrCreate({
            where: { companyName: 'Antigravity Test Company' },
            defaults: {
                contactPerson: 'Antigravity Robot',
                email: 'test@antigravity.com',
                phone: '1234567890',
                value: 50000,
                strengthOfEmployees: '45'
            }
        });
        console.log('Lead strengthOfEmployees:', lead.strengthOfEmployees);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
