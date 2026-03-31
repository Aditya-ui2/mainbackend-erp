require('dotenv').config();
const { sequelize } = require('./models/sequelizeModels');

async function test() {
    try {
        const clientId = 'a8789c86-e5a4-4966-979f-6096ca3fc7f8';
        
        // Get a position and candidate
        const [positions] = await sequelize.query(
            `SELECT id, title FROM recruitment_positions WHERE "clientId" = '${clientId}' LIMIT 1`
        );
        const [candidates] = await sequelize.query(
            `SELECT id, name FROM candidates WHERE "clientId" = '${clientId}' LIMIT 1`
        );
        
        console.log('Position:', positions[0]);
        console.log('Candidate:', candidates[0]);
        
        if (positions[0] && candidates[0]) {
            // Create interview for tomorrow
            const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
            
            // Check if interview exists
            const [existing] = await sequelize.query(
                `SELECT id FROM interviews WHERE "positionId" = '${positions[0].id}' AND "candidateId" = '${candidates[0].id}'`
            );
            
            if (existing.length === 0) {
                await sequelize.query(`
                    INSERT INTO interviews (id, "positionId", "candidateId", "clientId", "interviewDate", "startTime", "interviewType", status, "createdAt", "updatedAt")
                    VALUES (gen_random_uuid(), '${positions[0].id}', '${candidates[0].id}', '${clientId}', '${tomorrow}', '10:00 AM', 'Technical Round', 'Scheduled', NOW(), NOW())
                `);
                console.log('Interview created for', tomorrow);
            } else {
                console.log('Interview already exists');
            }
        }
        
        // Check interviews count
        const [interviews] = await sequelize.query(
            `SELECT COUNT(*) as count FROM interviews WHERE "positionId" IN (SELECT id FROM recruitment_positions WHERE "clientId" = '${clientId}')`
        );
        console.log('Total interviews for client:', interviews[0]);
        
    } catch (error) {
        console.error('Error:', error.message);
    }
    process.exit();
}

test();
