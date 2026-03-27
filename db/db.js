const { sequelize, DepartmentTeam } = require('../models/sequelizeModels');
const { hashPassword } = require('../utils/bcryptUtils');

const seedDepartmentTeamUsers = async () => {
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
        try {
            const existing = await DepartmentTeam.findOne({ where: { email: userData.email } });
            
            if (!existing) {
                const hashedPassword = await hashPassword(userData.password);
                await DepartmentTeam.create({
                    ...userData,
                    password: hashedPassword
                });
                console.log(`Created department user: ${userData.email}`);
            }
        } catch (error) {
            console.error(`Error creating user ${userData.email}:`, error.message);
        }
    }
};

const dbConnect = async () => {
    try {
        await sequelize.authenticate();
        console.log("Connection established with PostgreSQL database successfully!");
        
        // Sync all models (creates tables if they don't exist)
        // Use { force: true } only in development to drop and recreate tables
        // Use { alter: true } to alter existing tables to match models
        await sequelize.sync({ alter: true });
        console.log("All models synchronized successfully!");
        
        // Seed default department team users
        await seedDepartmentTeamUsers();
    } catch (error) {
        console.error("Failed to establish connection with database:", error);
    }
}

module.exports = dbConnect;