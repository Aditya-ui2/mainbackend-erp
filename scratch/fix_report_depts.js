const { DailyReport } = require('../models/sequelizeModels');

async function fix() {
    try {
        console.log('--- FIXING MIS REPORT DEPARTMENTS ---');
        
        // Fix Priyanshi Sharma's reports for today
        const [count] = await DailyReport.update(
            { department: 'HR Recruitment' },
            { 
                where: { 
                    memberName: 'Priyanshi Sharma',
                    department: 'CRM'
                } 
            }
        );
        console.log(`Updated ${count} reports for Priyanshi Sharma to HR Recruitment`);

        // Also check for Manju and Jyoti
        const [count2] = await DailyReport.update(
            { department: 'HR Recruitment' },
            { 
                where: { 
                    memberName: ['Manju', 'Manju Sharma', 'Jyoti', 'Jyoti Sharma'],
                    department: 'CRM'
                } 
            }
        );
        console.log(`Updated ${count2} reports for Manju/Jyoti to HR Recruitment`);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

fix();
