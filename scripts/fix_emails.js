require('dotenv').config();
const { DepartmentTeam } = require('../models/sequelizeModels');

async function fix() {
    const mappings = [
        { old: 'manju.recruitment@gmail.com', new: 'manju.mabicons@gmail.com' },
        { old: 'jyoti.recruitment@gmail.com', new: 'jyoti.mabicons@gmail.com' },
        { old: 'priyanshi.recruitment@gmail.com', new: 'priyanshi.mabicons@gmail.com' }
    ];

    for (const m of mappings) {
        const user = await DepartmentTeam.findOne({ where: { email: m.old } });
        if (user) {
            user.email = m.new;
            await user.save();
            console.log(`Updated email for ${user.name}: ${m.old} -> ${m.new}`);
        } else {
             // Check if it's already updated
             const exists = await DepartmentTeam.findOne({ where: { email: m.new } });
             if (exists) {
                 console.log(`User with email ${m.new} already exists.`);
             } else {
                 console.log(`User with email ${m.old} not found.`);
             }
        }
    }
    process.exit();
}
fix();
