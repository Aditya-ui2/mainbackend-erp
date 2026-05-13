const { sequelize } = require('../models/sequelizeModels');
const dotenv = require('dotenv');
dotenv.config();

async function standardizeDepartmentEnums() {
    try {
        const departments = [
            'HR Operations', 'HR Recruitment', 'Operations', 'KAM Operations', 
            'HR', 'Management', 'CRM', 'Finance', 'Sales', 'IT', 'BD', 'Marketing'
        ];

        const tablesToFix = [
            'DepartmentTeams', 'DepartmentTasks', 'ActivityLogs', 
            'Announcements', 'Attendances', 'DepartmentNotes', 
            'DeptChats', 'DeptDocuments', 'LeaveRequests', 
            'Payslips', 'RegularizationRequests', 'Trainings'
        ];

        for (const table of tablesToFix) {
            console.log(`Fixing department ENUM for table: ${table}...`);
            const typeName = `enum_${table}_department`;
            
            for (const dept of departments) {
                try {
                    // Try to add each value to the ENUM type
                    // Note: ALTER TYPE ... ADD VALUE cannot be executed inside a transaction block in some Postgres versions,
                    // but sequelize.query usually handles this if not explicitly in a transaction.
                    await sequelize.query(`ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS '${dept}'`);
                } catch (err) {
                    // If it already exists or there's an error, skip
                    if (!err.message.includes('already exists')) {
                        console.warn(`Warning adding '${dept}' to ${typeName}:`, err.message);
                    }
                }
            }
        }

        console.log('ENUM standardization complete!');
        process.exit(0);
    } catch (err) {
        console.error('CRITICAL ERROR:', err.message);
        process.exit(1);
    }
}

standardizeDepartmentEnums();
