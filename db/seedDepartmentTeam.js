require('dotenv').config();
const { DepartmentTeam, sequelize } = require('../models/sequelizeModels');
const { hashPassword } = require('../utils/bcryptUtils');

const seedDepartmentTeam = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connected to PostgreSQL');

        // Sync the DepartmentTeam table
        await DepartmentTeam.sync({ alter: true });
        console.log('DepartmentTeam table synced');

        const users = [
            {
                name: 'Sachin (HR Recruitment Head)',
                email: 'recruitment.mabicons@gmail.com',
                password: 'Recruitment@123',
                phone: '+91 9876543210',
                role: 'Department Head',
                department: 'HR Recruitment',
                status: 'Active',
                skills: ['Recruitment', 'Interviewing', 'Talent Acquisition']
            },
            {
                name: 'Ramesh (HR Operations Head)',
                email: 'operation.mabicons@gmail.com',
                password: 'Operation@123',
                phone: '+91 9876543211',
                role: 'Department Head',
                department: 'HR Operations',
                status: 'Active',
                skills: ['HR Operations', 'Payroll', 'Compliance']
            }
        ];

        for (const userData of users) {
            const existing = await DepartmentTeam.findOne({ where: { email: userData.email } });
            
            if (existing) {
                // Update existing user with new password
                const hashedPassword = await hashPassword(userData.password);
                await existing.update({
                    password: hashedPassword,
                    name: userData.name,
                    role: userData.role,
                    status: userData.status,
                    skills: userData.skills
                });
                console.log(`Updated user: ${userData.email}`);
            } else {
                // Create new user
                const hashedPassword = await hashPassword(userData.password);
                await DepartmentTeam.create({
                    ...userData,
                    password: hashedPassword
                });
                console.log(`Created user: ${userData.email}`);
            }
        }

        console.log('Department team users seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding department team:', error);
        process.exit(1);
    }
};

seedDepartmentTeam();
