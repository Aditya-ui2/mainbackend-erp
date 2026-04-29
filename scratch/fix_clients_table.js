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
        dialectOptions: {
            ssl: process.env.DB_SSL === 'false' ? false : {
                require: true,
                rejectUnauthorized: false
            }
        }
    }
);

async function addMissingColumns() {
    try {
        await sequelize.authenticate();
        console.log('Connected to database.');

        const queryInterface = sequelize.getQueryInterface();
        
        // Check for industry
        try {
            await queryInterface.addColumn('clients', 'industry', {
                type: Sequelize.STRING,
                allowNull: true
            });
            console.log('Added column: industry');
        } catch (e) {
            console.log('Industry column might already exist or error:', e.message);
        }

        // Check for probability
        try {
            await queryInterface.addColumn('clients', 'probability', {
                type: Sequelize.INTEGER,
                defaultValue: 25
            });
            console.log('Added column: probability');
        } catch (e) {
            console.log('Probability column might already exist or error:', e.message);
        }

        // Check for stage
        // Note: For ENUMs, we might need to create the type first if it doesn't exist
        try {
            // First try adding as string to avoid enum issues, then we can convert or keep as is
            // because the error specifically said it's missing.
            await queryInterface.addColumn('clients', 'stage', {
                type: Sequelize.STRING,
                defaultValue: 'Onboarding Complete'
            });
            console.log('Added column: stage');
        } catch (e) {
            console.log('Stage column might already exist or error:', e.message);
        }

        console.log('Migration completed.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

addMissingColumns();
