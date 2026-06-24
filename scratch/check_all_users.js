const { DepartmentTeam } = require('../models/sequelizeModels');
require('dotenv').config();

async function checkHierarchy() {
    try {
        const rows = await DepartmentTeam.findAll();
        console.log(`\n=== DepartmentTeam Hierarchy (${rows.length} rows) ===`);
        rows.forEach(r => {
            const raw = r.toJSON ? r.toJSON() : r;
            console.log(`ID: ${raw.id} | Name: ${raw.name} | Email: ${raw.email} | Role: ${raw.role} | ManagerID: ${raw.managerId} | Dept: ${raw.department}`);
        });
        process.exit(0);
    } catch (err) {
        console.error('Fatal error:', err.message);
        process.exit(1);
    }
}

checkHierarchy();
