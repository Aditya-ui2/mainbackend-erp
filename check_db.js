require('dotenv').config();
const { Candidate, ResumeBank, sequelize } = require('./models/sequelizeModels');

async function check() {
    try {
        await sequelize.authenticate();
        console.log('Database connected successfully.');

        console.log('\n--- LATEST 5 CANDIDATES ---');
        const candidates = await Candidate.findAll({ 
            limit: 5, 
            order: [['createdAt', 'DESC']] 
        });
        console.log(JSON.stringify(candidates.map(c => ({ 
            id: c.id, 
            name: c.name, 
            cvFileName: c.cvFileName, 
            createdAt: c.createdAt 
        })), null, 2));

        console.log('\n--- LATEST 5 RESUME BANK ENTRIES ---');
        const resumes = await ResumeBank.findAll({ 
            limit: 5, 
            order: [['createdAt', 'DESC']] 
        });
        console.log(JSON.stringify(resumes.map(r => ({ 
            id: r.id, 
            candidateName: r.candidateName, 
            fileName: r.fileName, 
            createdAt: r.createdAt 
        })), null, 2));

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await sequelize.close();
    }
}

check();
