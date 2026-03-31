require('dotenv').config();
const { DepartmentTeam } = require('../models/sequelizeModels');

async function setupHierarchy() {
    try {
        const sachinId = '60de4380-0140-49ff-b26d-a8d06333af11';
        const teamMemberIds = [
            'bdcdd80c-4812-45f0-9862-39594bfe7475', // Manju
            '13b9f804-91ea-4d5a-afc0-8a9da6e27e0f', // Jyoti
            'ffd606f2-459c-4bc1-8f4b-52b88663fed3'  // Priyanshi
        ];

        console.log('Setting up recruitment hierarchy...');

        // 1. Ensure Sachin is marked as a Head/Manager
        await DepartmentTeam.update(
            { role: 'Department Head' },
            { where: { id: sachinId } }
        );
        console.log('Sachin role updated to Department Head.');

        // 2. Link KAMs to Sachin
        const [updatedCount] = await DepartmentTeam.update(
            { managerId: sachinId },
            { 
                where: { 
                    id: teamMemberIds
                } 
            }
        );

        console.log(`Successfully linked ${updatedCount} KAMs to Sachin.`);
        process.exit(0);
    } catch (error) {
        console.error('Error setting up hierarchy:', error);
        process.exit(1);
    }
}

setupHierarchy();
