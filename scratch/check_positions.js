const { RecruitmentPosition, Client } = require('../models/sequelizeModels');

async function checkPositions() {
    try {
        const count = await RecruitmentPosition.count();
        console.log(`Total Positions: ${count}`);
        
        const positions = await RecruitmentPosition.findAll({
            include: [{ model: Client, as: 'client', attributes: ['name', 'companyName'] }],
            limit: 5
        });
        
        positions.forEach(p => {
            console.log(`- ${p.title} (ID: ${p.id}, Client: ${p.client?.companyName || p.client?.name})`);
        });
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkPositions();
