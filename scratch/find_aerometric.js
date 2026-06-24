// scratch/find_aerometric.js
const { sequelize } = require('../models/sequelizeModels');

async function run() {
    try {
        await sequelize.authenticate();
        console.log("Connected.");
        
        // Find all tables containing Aerometric
        const tables = [
            'clients', 'invoices', 'recruitment_positions', 'candidates', 
            'DepartmentTasks', 'ActivityLogs', 'DailyReports', 'Announcements'
        ];
        
        for (const table of tables) {
            try {
                const [results] = await sequelize.query(`SELECT * FROM "${table}" WHERE 
                    JSON_STRIP_NULLS(to_jsonb(row_to_json(r))) ? 'Aerometric' 
                    OR CAST(row_to_json(r) AS TEXT) LIKE '%Aerometric%'`, {
                    bind: [],
                    type: sequelize.QueryTypes.SELECT,
                    plain: false,
                    raw: true,
                    table: table,
                    model: null,
                    mapToModel: false,
                    nest: false,
                    hasJoin: false,
                    instance: null,
                    query: `SELECT * FROM "${table}" AS r`
                });
                if (results && results.length > 0) {
                    console.log(`\nFound in table "${table}":`, results.length, "records");
                    console.log(results[0]);
                }
            } catch (err) {
                // Try without quotes
                try {
                    const results = await sequelize.query(`SELECT * FROM ${table} WHERE CAST(row_to_json(t) AS TEXT) LIKE '%Aerometric%'`, {
                        type: sequelize.QueryTypes.SELECT
                    });
                    if (results && results.length > 0) {
                        console.log(`\nFound in table "${table}":`, results.length, "records");
                        console.log(results[0]);
                    }
                } catch (inner) {
                    // Ignore
                }
            }
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
