require('dotenv').config();
const { 
    DepartmentTeam, Employee, Attendance, 
    DepartmentTask, Candidate, RecruitmentPosition, 
    Payslip, ActivityLog, sequelize 
} = require('./models/sequelizeModels');
const { Op } = require('sequelize');

async function testAndSeed() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to DB');

        const department = 'HR Operations';

        // 1. Test failing queries
        console.log('\n--- Testing Failing Queries ---');
        try {
            const members = await DepartmentTeam.findAll({ where: { department } });
            console.log('✅ members query: SUCCESS, count:', members.length);
        } catch (e) {
            console.error('❌ members query: FAILED', e.message);
        }

        try {
            const offboarding = await DepartmentTeam.findAll({ 
                where: { 
                    department, 
                    status: { [Op.in]: ['Resigned', 'Notice Period', 'Inactive'] } 
                } 
            });
            console.log('✅ offboarding query: SUCCESS, count:', offboarding.length);
        } catch (e) {
            console.error('❌ offboarding query: FAILED', e.message);
        }

        // 2. Seeding Data
        console.log('\n--- Seeding Data ---');

        // Create some employees
        const employees = await Employee.bulkCreate([
            { name: 'John Doe', email: 'john@example.com', password: 'hashedpassword', phone: '1234567890' },
            { name: 'Jane Smith', email: 'jane@example.com', password: 'hashedpassword', phone: '0987654321' },
            { name: 'Alice Brown', email: 'alice@example.com', password: 'hashedpassword', phone: '1122334455' },
            { name: 'Bob Wilson', email: 'bob@example.com', password: 'hashedpassword', phone: '5544332211' }
        ], { ignoreDuplicates: true });
        console.log('✅ Seeded Employees');

        // Attendance for today
        const today = new Date().toISOString().split('T')[0];
        const empList = await Employee.findAll({ limit: 4 });
        await Attendance.bulkCreate(empList.map((emp, i) => ({
            memberId: emp.id,
            memberName: emp.name,
            department: 'HR Operations',
            date: today,
            status: i === 0 ? 'On Leave' : 'Present',
            checkIn: new Date(),
        })), { ignoreDuplicates: true });
        console.log('✅ Seeded Attendance');

        // Recruitment Positions
        await RecruitmentPosition.bulkCreate([
            { title: 'Senior Developer', client: 'TechCorp', status: 'Open' },
            { title: 'HR Manager', client: 'HRPlus', status: 'Open' }
        ], { ignoreDuplicates: true });
        console.log('✅ Seeded Positions');

        // Candidates (Joined)
        await Candidate.bulkCreate([
            { name: 'Charlie New', email: 'charlie@example.com', stage: 'Joined' },
            { name: 'Diana Joined', email: 'diana@example.com', stage: 'Joined' }
        ], { ignoreDuplicates: true });
        console.log('✅ Seeded Candidates');

        // Tasks
        await DepartmentTask.bulkCreate([
            { title: 'Verify Documents', department: 'HR Operations', status: 'Pending', assignedBy: empList[0].id, assignedTo: empList[1].id, assignedToName: empList[1].name },
            { title: 'Run Payroll', department: 'HR Operations', status: 'In Progress', assignedBy: empList[0].id, assignedTo: empList[2].id, assignedToName: empList[2].name }
        ], { ignoreDuplicates: true });
        console.log('✅ Seeded Tasks');

        console.log('\n--- SEEDING COMPLETE ---');
        process.exit(0);
    } catch (error) {
        console.error('❌ CRITICAL ERROR:', error);
        process.exit(1);
    }
}

testAndSeed();
