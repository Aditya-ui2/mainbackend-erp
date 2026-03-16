const { sequelize } = require('../models/sequelizeModels');

const dbConnect = async () => {
    try {
        await sequelize.authenticate();
        console.log("Connection established with PostgreSQL database successfully!");
        
        // Sync all models (creates tables if they don't exist)
        // Use { force: true } only in development to drop and recreate tables
        // Use { alter: true } to alter existing tables to match models
        await sequelize.sync({ alter: true });
        console.log("All models synchronized successfully!");
    } catch (error) {
        console.error("Failed to establish connection with database:", error);
    }
}

module.exports = dbConnect;