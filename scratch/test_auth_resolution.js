require('dotenv').config();
const jwt = require('jsonwebtoken');
const verifyAuthToken = require('../middleware/authMiddleware');
const { sequelize } = require('../models/sequelizeModels');

const JWT_SECRET = process.env.JWT_SECRET;

async function testAuthResolution() {
    try {
        await sequelize.authenticate();
        console.log('Postgres connected.');

        // 1. Generate a valid token with a stale ID ('m1') but correct email ('tech.mabicons@gmail.com')
        const payload = {
            id: 'm1', // Stale ID
            email: 'tech.mabicons@gmail.com',
            name: 'Tech User',
            role: 'tech'
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
        console.log('Generated JWT with stale ID.');

        // 2. Set up mock req, res, and next
        const req = {
            headers: {
                authorization: `Bearer ${token}`
            }
        };

        const res = {
            statusCode: 200,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(data) {
                console.log('Response status:', this.statusCode);
                console.log('Response body:', data);
            }
        };

        const next = () => {
            console.log('\n--- Next middleware called successfully ---');
            console.log('Resolved user info on req.user:');
            console.log('req.user.id:', req.user.id);
            console.log('req.user.email:', req.user.email);
            console.log('req.user.role:', req.user.role);

            // Assert that the stale ID ('m1') was updated to the actual DB ID
            const expectedDbId = '17fd18b2-1634-4e43-a30e-fbda8bce1233';
            if (req.user.id === expectedDbId) {
                console.log('✅ TEST PASSED: Stale ID resolved to active database ID:', req.user.id);
            } else {
                console.error('❌ TEST FAILED: req.user.id is still:', req.user.id);
            }
        };

        console.log('Calling verifyAuthToken middleware...');
        await verifyAuthToken(req, res, next);

    } catch (error) {
        console.error('Test execution failed:', error);
    } finally {
        await sequelize.close();
    }
}

testAuthResolution();
