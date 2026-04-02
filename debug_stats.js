require('dotenv').config();
const { 
    DepartmentTeam, TeamLeader, DepartmentTask, ActivityLog,
    RecruitmentPosition, Candidate, Interview,
    Employee, Attendance, Payslip, LeaveRequest, sequelize
} = require('./models/sequelizeModels');
const { Op } = require('sequelize');

async function debug() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to DB');

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const todayStr = new Date().toISOString().split('T')[0];

        console.log('--- Testing HR Operations Live Stats ---');
        
        const totalEmployees = await Employee.count();
        console.log('Total Employees (New Logic):', totalEmployees);
        
        const attendanceToday = await Attendance.count({ where: { date: todayStr, status: 'Present' } });
        console.log('Attendance Today (Present):', attendanceToday);

        const openPositions = await RecruitmentPosition.count({ where: { status: 'Open' } });
        console.log('Open Positions:', openPositions);

        const recentActivities = await ActivityLog.findAll({
            where: { department: 'HR Operations' },
            order: [['createdAt', 'DESC']],
            limit: 5
        });
        console.log('Recent Activities Cleaned:', recentActivities.length);

        console.log('✅ ALL QUERIES EXECUTED SUCCESSFULLY');
        process.exit(0);
    } catch (error) {
        console.error('❌ ERROR DETECTED:', error);
        process.exit(1);
    }
}

debug();
