// superAdminSeeder.js
const { hashPassword } = require('../utils/bcryptUtils');
const { SuperAdmin, Client } = require('../models/sequelizeModels');

// SuperAdmin details
const superAdminData = {
    name: 'Ashish Tondon',
    email: 'mabicons@gmail.com',
    password: process.env.SUPERADMIN_PASSWORD || 'ChangeMeImmediately!2026',
    companyName: 'Mabicons Technosoft Pvt. Ltd.',
};

async function seedClients() {
    try {
        const clientCount = await Client.count();
        if (clientCount > 0) {
            console.log('Clients already exist in the database.');
            return;
        }

        const defaultPassword = await hashPassword('Client@123');

        const mockClients = [
            { name: 'Acme Corp SPOC', email: 'spoc@acmecorp.com', password: defaultPassword, companyName: 'Acme Corp', contactNumber: '9876543210' },
            { name: 'Stark Industries SPOC', email: 'spoc@starkindustries.com', password: defaultPassword, companyName: 'Stark Industries', contactNumber: '9876543211' },
            { name: 'Wayne Enterprises SPOC', email: 'spoc@wayneenterprises.com', password: defaultPassword, companyName: 'Wayne Enterprises', contactNumber: '9876543212' },
            { name: 'Cyberdyne Systems SPOC', email: 'spoc@cyberdynesystems.com', password: defaultPassword, companyName: 'Cyberdyne Systems', contactNumber: '9876543213' }
        ];

        await Client.bulkCreate(mockClients);
        console.log('Mock clients seeded successfully.');
    } catch (error) {
        console.error('Error seeding mock clients:', error);
    }
}

// Function to seed SuperAdmin
async function seedSuperAdmin() {
    try {
        // Check if a SuperAdmin already exists
        const existingSuperAdmin = await SuperAdmin.findOne({ where: { email: superAdminData.email } });

        if (existingSuperAdmin) {
            console.log('SuperAdmin already exists in the database. Seeding clients check...');
            // await seedClients();
            return;
        }
 
        // Hash the password before saving
        const hashedPassword = await hashPassword(superAdminData.password);

        // Create a new SuperAdmin
        const newSuperAdmin = await SuperAdmin.create({
            ...superAdminData,
            password: hashedPassword,
        });

        console.log('SuperAdmin seeded successfully.');
        // await seedClients();
    } catch (error) {
        console.error('Error seeding SuperAdmin:', error);
    }
}

// Export the seeding function
module.exports = seedSuperAdmin;
