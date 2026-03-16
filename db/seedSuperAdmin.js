// superAdminSeeder.js
const { hashPassword } = require('../utils/bcryptUtils');
const { SuperAdmin } = require('../models/sequelizeModels');

// SuperAdmin details
const superAdminData = {
    name: 'Ashish Tondon',
    email: 'mabicons@gmail.com',
    password: 'mabicons123',
    companyName: 'Mabicons Technosoft Pvt. Ltd.',
};

// Function to seed SuperAdmin
async function seedSuperAdmin() {
    try {
        // Check if a SuperAdmin already exists
        const existingSuperAdmin = await SuperAdmin.findOne({ where: { email: superAdminData.email } });

        if (existingSuperAdmin) {
            console.log('SuperAdmin already exists in the database.');
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
    } catch (error) {
        console.error('Error seeding SuperAdmin:', error);
    }
}

// Export the seeding function
module.exports = seedSuperAdmin;
