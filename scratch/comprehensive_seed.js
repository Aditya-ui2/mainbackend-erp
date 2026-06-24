const { 
    SuperAdmin, Admin, TeamLeader, DepartmentTeam, 
    Client, RecruitmentPosition, Candidate, sequelize 
} = require('../models/sequelizeModels');
const bcrypt = require('bcrypt');

async function seed() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to DB');

        // 1. Fix Schema (Add missing columns to candidates)
        console.log('--- Fixing Schema ---');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS city VARCHAR(255)');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS state VARCHAR(255)');
        console.log('✅ Schema fixed');

        // 2. Clear existing data (optional, but good for fresh start)
        // For safety, let's just add data if not exists

        const hashedPassword = await bcrypt.hash('password123', 10);

        // 3. Create SuperAdmin
        const [superAdmin] = await SuperAdmin.findOrCreate({
            where: { email: 'superadmin@mabicons.com' },
            defaults: {
                name: 'Super Admin',
                password: hashedPassword,
                companyName: 'Mabicons'
            }
        });
        console.log('✅ SuperAdmin ready');

        // 4. Create Admin
        const [admin] = await Admin.findOrCreate({
            where: { email: 'admin@mabicons.com' },
            defaults: {
                name: 'Main Admin',
                password: hashedPassword
            }
        });
        console.log('✅ Admin ready');

        // 5. Create TeamLeader
        const [tl] = await TeamLeader.findOrCreate({
            where: { email: 'tl@mabicons.com' },
            defaults: {
                name: 'Team Leader One',
                password: hashedPassword,
                adminId: admin.id,
                department: 'Both'
            }
        });
        console.log('✅ TeamLeader ready');

        // 6. Create DepartmentTeam
        const [deptMember] = await DepartmentTeam.findOrCreate({
            where: { email: 'dept@mabicons.com' },
            defaults: {
                name: 'Dept Member',
                password: hashedPassword,
                department: 'HR Recruitment',
                role: 'Recruiter'
            }
        });
        console.log('✅ DepartmentTeam ready');

        // 7. Create Client
        const [client] = await Client.findOrCreate({
            where: { email: 'client@example.com' },
            defaults: {
                name: 'Test Client',
                password: hashedPassword,
                companyName: 'Example Corp',
                contactNumber: '1234567890',
                status: 'Active',
                teamLeaderId: tl.id
            }
        });
        console.log('✅ Client ready');

        // 8. Create Recruitment Position
        const [position] = await RecruitmentPosition.findOrCreate({
            where: { title: 'Software Engineer', clientId: client.id },
            defaults: {
                description: 'Full stack developer role',
                location: 'Remote',
                type: 'Full-time',
                salary: '10-15 LPA',
                status: 'Open',
                openings: 2,
                teamLeaderId: tl.id
            }
        });
        console.log('✅ Position ready');

        // 9. Create Candidate
        const [candidate] = await Candidate.findOrCreate({
            where: { email: 'candidate@example.com' },
            defaults: {
                name: 'John Doe',
                phone: '9876543210',
                positionId: position.id,
                clientId: client.id,
                status: 'Shortlisted',
                stage: 'Technical Round',
                city: 'Mumbai',
                state: 'Maharashtra'
            }
        });
        console.log('✅ Candidate ready');

        console.log('\n--- SEEDING COMPLETE ---');
        process.exit(0);
    } catch (error) {
        console.error('❌ ERROR:', error);
        process.exit(1);
    }
}

seed();
