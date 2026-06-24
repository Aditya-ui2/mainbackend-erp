require('dotenv').config();
const { sequelize } = require('../models/sequelizeModels');

async function check() {
    try {
        await sequelize.authenticate();
        const [results] = await sequelize.query(`
            SELECT 
                conname AS constraint_name, 
                pg_get_constraintdef(c.oid) AS constraint_definition
            FROM 
                pg_constraint c
            JOIN 
                pg_class t ON c.conrelid = t.oid
            WHERE 
                t.relname = 'candidates';
        `);
        console.table(results);
    } catch (error) {
        console.error(error);
    } finally {
        await sequelize.close();
    }
}
check();
