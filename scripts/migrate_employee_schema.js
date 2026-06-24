const { sequelize } = require('../models/sequelizeModels');

async function runMigration() {
    try {
        console.log('--- Migrating Employees Table Schema ---');
        const queryInterface = sequelize.getQueryInterface();

        const columns = [
            { name: 'bankAccount', type: 'VARCHAR(255)' },
            { name: 'pfNumber', type: 'VARCHAR(255)' },
            { name: 'uanNumber', type: 'VARCHAR(255)' },
            { name: 'basicSalary', type: 'NUMERIC(15, 2)' },
            { name: 'hra', type: 'NUMERIC(15, 2)' },
            { name: 'otherAllowances', type: 'NUMERIC(15, 2)' },
            { name: 'deductions', type: 'NUMERIC(15, 2)' },
            { name: 'leaveBalance', type: 'INTEGER' }
        ];

        for (const col of columns) {
            try {
                // Safe migration query for PostgreSQL
                await sequelize.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type};`);
                console.log(`Column "${col.name}" has been verified or added successfully.`);
            } catch (columnError) {
                console.error(`Failed to add column "${col.name}":`, columnError.message);
            }
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

runMigration();
