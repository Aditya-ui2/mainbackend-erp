const { DepartmentTeam } = require('../models/sequelizeModels');
const { hashPassword } = require('../utils/bcryptUtils');
const dotenv = require('dotenv');
dotenv.config();

async function runSeed() {
    try {
        const users = [
            {
                id: 'ffd606f2-459c-4bc1-8f4b-52b88663fed3',
                name: 'Priyanshi Sharma',
                email: 'priyanshi.recruitment@gmail.com',
                password: 'Priyanshi@123',
                phone: '+91 9876543214',
                role: 'kamRecruitment',
                department: 'HR Recruitment',
                managerId: '1e2cfcc6-a91d-4037-95db-88cb7b04d376', // Sachin
                status: 'Active',
                skills: ['Resume Screening', 'Job Posting', 'Offer Management']
            },
            {
                id: 'bdcdd80c-4812-45f0-9862-39594bfe7475',
                name: 'Manju',
                email: 'manju.recruitment@gmail.com',
                password: 'Manju@123',
                phone: '+91 9876543212',
                role: 'kamRecruitment',
                department: 'HR Recruitment',
                managerId: '1e2cfcc6-a91d-4037-95db-88cb7b04d376', // Sachin
                status: 'Active',
                skills: ['Sourcing', 'Screening', 'LinkedIn Recruiting']
            },
            {
                id: '13b9f804-91ea-4d5a-afc0-8a9da6e27e0f',
                name: 'Jyoti',
                email: 'jyoti.recruitment@gmail.com',
                password: 'Jyoti@123',
                phone: '+91 9876543213',
                role: 'kamRecruitment',
                department: 'HR Recruitment',
                managerId: '1e2cfcc6-a91d-4037-95db-88cb7b04d376', // Sachin
                status: 'Active',
                skills: ['Interviewing', 'Candidate Assessment', 'Onboarding']
            }
        ];

        for (const u of users) {
            const existing = await DepartmentTeam.findOne({ where: { email: u.email } });
            if (existing) {
                console.log(`User ${u.email} already exists in DepartmentTeams. Updating...`);
                const hp = await hashPassword(u.password);
                await existing.update({
                    id: u.id,
                    name: u.name,
                    password: hp,
                    role: u.role,
                    department: u.department,
                    managerId: u.managerId,
                    status: u.status,
                    skills: u.skills
                });
            } else {
                console.log(`User ${u.email} not found in DepartmentTeams. Creating...`);
                const hp = await hashPassword(u.password);
                await DepartmentTeam.create({
                    ...u,
                    password: hp
                });
            }
        }
        console.log('Seeding completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding database:', err);
        process.exit(1);
    }
}

runSeed();
