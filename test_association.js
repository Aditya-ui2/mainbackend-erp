const { ResumeBank, RecruitmentPosition, sequelize } = require('./models/sequelizeModels');

async function test() {
    try {
        console.log('Testing ResumeBank associations...');
        const resumeCount = await ResumeBank.count({
            include: [{
                model: RecruitmentPosition,
                as: 'position'
            }]
        });
        console.log('Resume count with join:', resumeCount);
        process.exit(0);
    } catch (err) {
        console.error('Error in ResumeBank association:', err);
        process.exit(1);
    }
}

test();
