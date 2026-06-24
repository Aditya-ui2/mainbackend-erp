require('dotenv').config();
const { sequelize } = require('../models/sequelizeModels');

async function fixClientsTable() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected.');

        const queryInterface = sequelize.getQueryInterface();

        console.log('Adding missing columns to clients table...');

        // Add stage column
        try {
            await sequelize.query(`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_clients_stage') THEN
                        CREATE TYPE "enum_clients_stage" AS ENUM('Onboarding Complete', 'Finalize', 'Lead Stage');
                    END IF;
                END $$;
            `);
            await queryInterface.addColumn('clients', 'stage', {
                type: 'enum_clients_stage',
                defaultValue: 'Lead Stage'
            });
            console.log('✅ Added stage');
        } catch (e) { console.log('Stage column might already exist or error:', e.message); }

        // Add probability column
        try {
            await queryInterface.addColumn('clients', 'probability', {
                type: 'INTEGER',
                defaultValue: 25
            });
            console.log('✅ Added probability');
        } catch (e) { console.log('Probability column might already exist or error:', e.message); }

        // Add industry column
        try {
            await queryInterface.addColumn('clients', 'industry', {
                type: 'VARCHAR(255)',
                allowNull: true
            });
            console.log('✅ Added industry');
        } catch (e) { console.log('Industry column might already exist or error:', e.message); }

        console.log('Done!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

fixClientsTable();
