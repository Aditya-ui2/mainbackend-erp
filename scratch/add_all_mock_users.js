const { SuperAdmin, Admin, TeamLeader, Employee, DepartmentTeam } = require('../models/sequelizeModels');
const bcrypt = require('bcrypt');

const mockUsers = [
    {
        email: 'superadmin.mabicons@gmail.com',
        type: 'SuperAdmin',
        data: { name: 'Ashish Tondon (Super Admin)', companyName: 'Mabicons' }
    },
    {
        email: 'ashish.mabicons@gmail.com',
        type: 'SuperAdmin',
        data: { name: 'Ashish Tondon (Super Admin)', companyName: 'Mabicons' }
    },
    {
        email: 'admin.mabicons@gmail.com',
        type: 'Admin',
        data: { name: 'Admin' }
    },
    {
        email: 'employee.mabicons@gmail.com',
        type: 'Employee',
        data: { name: 'Employee' }
    },
    {
        email: 'teamleader.mabicons@gmail.com',
        type: 'TeamLeader',
        data: { name: 'Team Leader', department: 'Both' }
    },
    {
        email: 'bd.mabicons@gmail.com',
        type: 'DepartmentTeam',
        data: { name: 'BD Executive', role: 'kam', department: 'BD' }
    },
    {
        email: 'accounts.mabicons@gmail.com',
        type: 'DepartmentTeam',
        data: { name: 'Accounts Manager', role: 'kam', department: 'Finance' }
    },
    {
        email: 'tech.mabicons@gmail.com',
        type: 'DepartmentTeam',
        data: { name: 'Tech User', role: 'kam', department: 'IT' }
    },
    {
        email: 'sales.mabicons@gmail.com',
        type: 'DepartmentTeam',
        data: { name: 'Sales User', role: 'kam', department: 'Sales' }
    },
    {
        email: 'saleskam.mabicons@gmail.com',
        type: 'DepartmentTeam',
        data: { name: 'Sales KAM', role: 'kam', department: 'Sales' }
    },
    {
        email: 'priyanshi.mabicons@gmail.com',
        type: 'DepartmentTeam',
        data: { name: 'Priyanshi Sharma', role: 'kam', department: 'HR Recruitment' }
    },
    {
        email: 'manju.mabicons@gmail.com',
        type: 'DepartmentTeam',
        data: { name: 'Manju', role: 'kam', department: 'HR Recruitment' }
    },
    {
        email: 'jyoti.mabicons@gmail.com',
        type: 'DepartmentTeam',
        data: { name: 'Jyoti', role: 'kam', department: 'HR Recruitment' }
    }
];

async function run() {
    try {
        // 1. Ensure at least one Admin exists to associate with TeamLeaders
        let defaultAdmin = await Admin.findOne({ where: { email: 'admin.mabicons@gmail.com' } });
        if (!defaultAdmin) {
            const hashedAdminPassword = await bcrypt.hash('Mabicons@123', 10);
            defaultAdmin = await Admin.create({
                name: 'Admin',
                email: 'admin.mabicons@gmail.com',
                password: hashedAdminPassword,
                status: 'Active'
            });
            console.log('Created Admin user admin.mabicons@gmail.com');
        }

        // 2. Insert all other mock users
        for (const user of mockUsers) {
            const emailLower = user.email.toLowerCase().trim();
            let dbUser = null;

            // Search across models
            const models = [SuperAdmin, Admin, TeamLeader, Employee, DepartmentTeam];
            for (const Model of models) {
                dbUser = await Model.findOne({ where: { email: emailLower } });
                if (dbUser) break;
            }

            if (dbUser) {
                console.log(`User ${emailLower} already exists.`);
                continue;
            }

            // Create user
            const defaultPassword = user.email.includes('ashish') ? 'Ashish@123'
                                  : user.email.includes('superadmin') ? 'Mabicons@123'
                                  : user.email.includes('priyanshi') ? 'Priyanshi@123'
                                  : user.email.includes('manju') ? 'Manju@123'
                                  : user.email.includes('jyoti') ? 'Jyoti@123'
                                  : user.email.includes('employee') ? 'Employee@123'
                                  : user.email.includes('teamleader') ? 'TeamLeader@123'
                                  : user.email.includes('bd') ? 'BD@123'
                                  : user.email.includes('accounts') ? 'Accounts@123'
                                  : user.email.includes('tech') ? 'Tech@123'
                                  : user.email.includes('sales') ? 'Sales@123'
                                  : 'Mabicons@123';

            const hashedPassword = await bcrypt.hash(defaultPassword, 10);

            if (user.type === 'SuperAdmin') {
                await SuperAdmin.create({
                    ...user.data,
                    email: emailLower,
                    password: hashedPassword,
                    status: 'Active'
                });
            } else if (user.type === 'Admin') {
                // Already checked/created above
            } else if (user.type === 'Employee') {
                await Employee.create({
                    ...user.data,
                    email: emailLower,
                    password: hashedPassword,
                    plainPassword: defaultPassword,
                    status: 'Active'
                });
            } else if (user.type === 'TeamLeader') {
                await TeamLeader.create({
                    ...user.data,
                    email: emailLower,
                    password: hashedPassword,
                    adminId: defaultAdmin.id,
                    status: 'Active'
                });
            } else if (user.type === 'DepartmentTeam') {
                await DepartmentTeam.create({
                    ...user.data,
                    email: emailLower,
                    password: hashedPassword,
                    status: 'Active'
                });
            }
            console.log(`Successfully created user: ${emailLower} (${user.type})`);
        }
        console.log('Mock database seeding completed successfully!');
    } catch (error) {
        console.error('Seeding error:', error);
    }
    process.exit(0);
}

run();
