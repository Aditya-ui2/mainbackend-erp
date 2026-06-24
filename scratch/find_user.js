const { SuperAdmin, Admin, TeamLeader, Employee, Client, DepartmentTeam } = require('../models/sequelizeModels');

async function findUser() {
    const email = 'mysongsd24@gmail.com';
    console.log('Searching for email:', email);
    
    const models = { SuperAdmin, Admin, TeamLeader, Employee, Client, DepartmentTeam };
    for (const [name, Model] of Object.entries(models)) {
        try {
            const found = await Model.findOne({ where: { email: email } });
            if (found) {
                console.log(`FOUND in ${name}:`, found.toJSON());
            } else {
                console.log(`Not found in ${name}`);
            }
        } catch (err) {
            console.error(`Error querying ${name}:`, err.message);
        }
    }
    process.exit(0);
}

findUser();
