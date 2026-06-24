const { generateToken } = require('../utils/jwtUtils');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function testApi() {
    try {
        const payload = {
            id: '00000000-0000-0000-0000-000000000000',
            email: 'tech.mabicons@gmail.com',
            name: 'Tech User',
            role: 'tech',
            department: 'Tech',
            userType: 'tech'
        };

        const token = generateToken(payload) + '.mock-signature';
        console.log('Generated Token for Tech user:', token);

        console.log('Sending request to http://localhost:3000/admin/hierarchy ...');
        const res = await axios.post('http://localhost:3000/admin/hierarchy', {
            adminId: payload.id
        }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Response Status:', res.status);
        console.log('Response Data:', JSON.stringify(res.data, null, 2));
        process.exit(0);
    } catch (err) {
        console.error('Error during API request:', err.response ? {
            status: err.response.status,
            data: err.response.data
        } : err.message);
        process.exit(1);
    }
}

testApi();
