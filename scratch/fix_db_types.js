const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: console.log,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        }
    }
);

async function fixDatabaseTypes() {
    try {
        console.log('--- Starting Database Type Fix ---');
        
        // List of tables that have clientId columns that need to be VARCHAR
        const tables = [
            { name: 'requested_tasks', column: 'clientId' },
            { name: 'recruitment_positions', column: 'clientId' },
            { name: 'candidates', column: 'clientId' },
            { name: 'tasks', column: 'clientId' },
            { name: 'recurring_tasks', column: 'clientId' },
            { name: 'client_accounts', column: 'clientId' },
            { name: 'invoices', column: 'clientId' },
            { name: 'client_reports', column: 'clientId' },
            { name: 'client_meetings', column: 'clientId' }
        ];

        for (const table of tables) {
            console.log(`Fixing table: ${table.name}, column: ${table.column}`);
            
            // 1. Drop the foreign key constraint first (Sequelize naming convention)
            // Note: We use a generic drop if it exists approach
            try {
                // Find the constraint name first
                const [constraints] = await sequelize.query(`
                    SELECT constraint_name 
                    FROM information_schema.key_column_usage 
                    WHERE table_name = '${table.name}' AND column_name = '${table.column}'
                    AND constraint_name LIKE '%fkey%';
                `);

                for (const c of constraints) {
                    console.log(`Dropping constraint: ${c.constraint_name}`);
                    await sequelize.query(`ALTER TABLE "${table.name}" DROP CONSTRAINT IF EXISTS "${c.constraint_name}" CASCADE;`);
                }

                // 2. Change column type from UUID to VARCHAR
                // Using USING clause to cast correctly
                await sequelize.query(`
                    ALTER TABLE "${table.name}" 
                    ALTER COLUMN "${table.column}" TYPE VARCHAR(255) 
                    USING "${table.column}"::text;
                `);
                
                console.log(`Successfully converted ${table.name}.${table.column} to VARCHAR`);
            } catch (err) {
                console.error(`Error fixing ${table.name}:`, err.message);
            }
        }

        console.log('--- Database Type Fix Completed ---');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

fixDatabaseTypes();
