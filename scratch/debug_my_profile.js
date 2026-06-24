const { getMyProfile, updateMyProfile } = require('../controllers/memberFeatures');
const { DepartmentTeam } = require('../models/sequelizeModels');
require('dotenv').config();

async function run() {
    try {
        const testEmail = 'mysongsd24@gmail.com';
        
        // Clean up any existing test record first
        await DepartmentTeam.destroy({ where: { email: testEmail } });
        console.log('Cleaned up existing test record.');

        // 1. Simulating getMyProfile request
        const reqGet = {
            user: {
                id: '12345678-1234-1234-1234-123456789abc',
                email: testEmail,
                role: 'CLIENT',
                name: 'Test Client'
            }
        };

        let resultData = null;
        const resGet = {
            status: function(code) { this.statusCode = code; return this; },
            json: function(data) {
                resultData = data;
            }
        };

        console.log('\n--- 1. Calling getMyProfile (should auto-create) ---');
        await getMyProfile(reqGet, resGet);

        // Verify it was created in the DB
        const dbRecord = await DepartmentTeam.findOne({ where: { email: testEmail } });
        if (dbRecord) {
            console.log('SUCCESS: Record created in database.');
        } else {
            console.error('FAILURE: Record not found in database!');
        }

        // A mock base64 profile image string
        const testBase64Image = 'data:image/jpeg;base64,' + 'A'.repeat(5000); // 5000 chars

        // 2. Simulating updateMyProfile request
        const reqUpdate = {
            user: {
                id: dbRecord.id,
                email: testEmail,
                role: 'CLIENT'
            },
            body: {
                name: 'Updated Test Client Name',
                phone: '9876543210',
                address: '123 Test Office Road',
                picture: testBase64Image
            }
        };

        let updateResult = null;
        const resUpdate = {
            status: function(code) { this.statusCode = code; return this; },
            json: function(data) {
                updateResult = data;
            }
        };

        console.log('\n--- 2. Calling updateMyProfile with a long base64 image ---');
        await updateMyProfile(reqUpdate, resUpdate);

        // 3. Simulating getMyProfile request again
        let finalData = null;
        const resGetFinal = {
            status: function(code) { this.statusCode = code; return this; },
            json: function(data) {
                finalData = data;
            }
        };

        console.log('\n--- 3. Calling getMyProfile again (should retrieve updated data) ---');
        await getMyProfile(reqGet, resGetFinal);
        
        const avatarSaved = finalData.member.avatar || finalData.member.picture;
        console.log('Saved avatar length:', avatarSaved.length);
        
        if (finalData.member.name === 'Updated Test Client Name' && avatarSaved === testBase64Image) {
            console.log('\nSUCCESS: Long base64 profile picture saved and persisted correctly!');
        } else {
            console.error('\nFAILURE: Values did not persist correctly!');
        }

        // Clean up test record
        await DepartmentTeam.destroy({ where: { email: testEmail } });
        console.log('\nCleaned up test record.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
