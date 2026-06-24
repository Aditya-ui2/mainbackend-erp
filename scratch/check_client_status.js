const { Client } = require('../models/sequelizeModels');
const dotenv = require('dotenv');
dotenv.config();

async function checkClient() {
    try {
        const client = await Client.findOne({ where: { email: 'client.mabicons@gmail.com' } });
        if (client) {
            console.log('Client found:');
            console.log('ID:', client.id);
            console.log('Name:', client.name);
            console.log('Status:', client.status);
        } else {
            console.log('Client not found');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

checkClient();
