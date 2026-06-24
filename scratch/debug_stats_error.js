// scratch/debug_stats_error.js
const { getDashboardStats } = require('../controllers/superAdmin');
const { sequelize } = require('../models/sequelizeModels');

async function run() {
    try {
        await sequelize.authenticate();
        console.log("DB connected.");
        
        const mockReq = {
            user: { role: 'superadmin' }
        };
        let responseData = null;
        const mockRes = {
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                responseData = data;
                return this;
            }
        };

        await getDashboardStats(mockReq, mockRes);
        console.log("RESPONSE:", responseData);
        process.exit(0);
    } catch (e) {
        console.error("STACK TRACE:", e);
        process.exit(1);
    }
}
run();
