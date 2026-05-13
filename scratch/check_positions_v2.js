const { RecruitmentPosition } = require('../models/sequelizeModels');

async function check() {
  try {
    const positions = await RecruitmentPosition.findAll();
    console.log(`Found ${positions.length} positions`);
    positions.forEach(p => {
      console.log(`ID: ${p.id}, Title: ${p.title}, ClientId: ${p.clientId}, Status: ${p.status}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
