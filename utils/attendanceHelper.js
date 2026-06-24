const { Attendance } = require('../models/sequelizeModels');

const recordSilentLoginAttendance = async (userId, userName, userDepartment) => {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Check if attendance already recorded for today
        const existing = await Attendance.findOne({
            where: {
                memberId: userId,
                date: todayStr
            }
        });
        
        if (!existing) {
            // Determine clean enum values for department
            let deptEnum = 'HR';
            const validDepts = ['HR Operations', 'HR Recruitment', 'HR', 'Management', 'CRM'];
            if (validDepts.includes(userDepartment)) {
                deptEnum = userDepartment;
            } else if (userDepartment) {
                const depLower = userDepartment.toLowerCase();
                if (depLower.includes('operation')) deptEnum = 'HR Operations';
                else if (depLower.includes('recruitment')) deptEnum = 'HR Recruitment';
                else if (depLower.includes('management')) deptEnum = 'Management';
                else if (depLower.includes('crm') || depLower.includes('finance')) deptEnum = 'CRM';
                else deptEnum = 'HR';
            }
            
            await Attendance.create({
                memberId: userId,
                memberName: userName || 'Employee',
                department: deptEnum,
                date: todayStr,
                checkIn: new Date(),
                status: 'Present',
                workHours: 8.0,
                notes: 'Silent login attendance'
            });
            console.log(`[Attendance] Silent present marked for user ${userName} (${userId})`);
        }
    } catch (err) {
        console.error('[Attendance] Error recording silent attendance:', err.message);
    }
};

module.exports = { recordSilentLoginAttendance };
