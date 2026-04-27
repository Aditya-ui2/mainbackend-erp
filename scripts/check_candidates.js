require('dotenv').config();
const { Candidate, RecruitmentPosition } = require('../models/sequelizeModels');

async function check() {
    const total = await Candidate.count();
    console.log(`Total Candidates in DB: ${total}`);
    
    const withPosition = await Candidate.count({ where: { positionId: { [require('sequelize').Op.ne]: null } } });
    console.log(`Candidates with PositionId: ${withPosition}`);
    
    const samples = await Candidate.findAll({ limit: 5, include: [{ model: RecruitmentPosition, as: 'position' }] });
    samples.forEach(c => {
        console.log(`- ${c.name} (${c.email}): Stage=${c.stage}, Position=${c.position?.title || 'NONE'}`);
    });
    process.exit();
}
check();
