const { DailyReport } = require('../models/sequelizeModels');
const { fn, col } = require('sequelize');

async function check() {
    try {
        const counts = await DailyReport.findAll({
            attributes: ['department', [fn('COUNT', col('id')), 'count']],
            group: ['department']
        });
        console.log('--- REPORT COUNTS BY DEPARTMENT ---');
        console.log(JSON.stringify(counts, null, 2));
        
        const latest = await DailyReport.findAll({
            limit: 10,
            order: [['createdAt', 'DESC']],
            attributes: ['id', 'memberName', 'department', 'date', 'createdAt']
        });
        console.log('--- LATEST 10 REPORTS ---');
        console.log(JSON.stringify(latest, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

check();
