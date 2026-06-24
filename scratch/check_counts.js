// scratch/check_counts.js
const { sequelize, Client, Employee, Admin, DepartmentTeam, Invoice, TeamLeader, Expense } = require('../models/sequelizeModels');

async function run() {
    try {
        console.log("Connecting...");
        await sequelize.authenticate();
        console.log("Connected. Counting records...");
        
        const counts = {
            Client: await Client.count().catch(e => e.message),
            Employee: await Employee.count().catch(e => e.message),
            Admin: await Admin.count().catch(e => e.message),
            DepartmentTeam: await DepartmentTeam.count().catch(e => e.message),
            Invoice: await Invoice.count().catch(e => e.message),
            TeamLeader: await TeamLeader.count().catch(e => e.message),
            Expense: await Expense.count().catch(e => e.message)
        };
        
        console.log("COUNTS:", counts);
        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}
run();
