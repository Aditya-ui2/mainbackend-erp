const dotenv = require('dotenv');
dotenv.config();
const { sequelize } = require('./models/sequelizeModels');

async function listConstraints() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected.');

        // Get all constraints for the DepartmentTeams table
        const [results] = await sequelize.query(`
            SELECT 
                conname AS constraint_name, 
                pg_get_constraintdef(c.oid) AS constraint_definition
            FROM 
                pg_constraint c
            JOIN 
                pg_class t ON c.conrelid = t.oid
            WHERE 
                t.relname = 'DepartmentTeams';
        `);

        console.log('Current Constraints on DepartmentTeams:');
        console.table(results);

        if (results.length > 0) {
            for (const row of results) {
                if (row.constraint_name.includes('managerId')) {
                    console.log(`Dropping: ${row.constraint_name}`);
                    await sequelize.query(`ALTER TABLE "DepartmentTeams" DROP CONSTRAINT IF EXISTS "${row.constraint_name}";`);
                    console.log(`✅ Dropped ${row.constraint_name}`);
                }
            }
        } else {
            console.log('No constraints found for DepartmentTeams.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

listConstraints();
