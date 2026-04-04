const { RecruitmentPosition, Client } = require('./models/sequelizeModels');
const dbConnect = require('./db/db');

async function testFetch() {
    try {
        await dbConnect();
        const positions = await RecruitmentPosition.findAll({
            include: [{ model: Client, as: 'client', attributes: ['name', 'companyName'] }]
        });
        console.log('--- POSITIONS FOUND ---');
        console.log(`Count: ${positions.length}`);
        positions.forEach(p => {
            console.log(`- ID: ${p.id}, Title: ${p.title}, Client: ${p.client?.companyName || p.client?.name || 'N/A'}`);
        });
        process.exit(0);
    } catch (err) {
        console.error('Fetch error:', err);
        process.exit(1);
    }
}

testFetch();
