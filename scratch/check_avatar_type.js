const { sequelize } = require('../models/sequelizeModels');

async function checkAvatarType() {
    try {
        const [results] = await sequelize.query(`
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns 
            WHERE table_name = 'DepartmentTeams' AND column_name = 'avatar'
        `);
        console.log(results);
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

checkAvatarType();
