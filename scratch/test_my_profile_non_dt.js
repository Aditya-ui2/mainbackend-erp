const axios = require('axios');
const { generateToken } = require('../utils/jwtUtils');
const { SuperAdmin } = require('../models/sequelizeModels');
require('dotenv').config();

async function run() {
    try {
        const sa = await SuperAdmin.findOne();
        if (!sa) {
            console.error('SuperAdmin not found in database');
            process.exit(1);
        }

        // Generate token
        const payload = {
            id: sa.id,
            email: sa.email,
            role: 'SuperAdmin',
            name: sa.name
        };
        const token = generateToken(payload);
        console.log('Generated token for SuperAdmin:', token);

        const url = 'http://localhost:3000/department/my-profile';
        console.log('Sending GET to:', url);
        try {
            const getRes = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log('GET Response:', getRes.status, getRes.data);
        } catch (getErr) {
            console.error('GET Error:', getErr.response ? { status: getErr.response.status, data: getErr.response.data } : getErr.message);
        }

        console.log('Sending PUT to:', url);
        try {
            const putRes = await axios.put(url, {
                name: 'SuperAdmin NewName',
                phone: '1234567890'
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log('PUT Response:', putRes.status, putRes.data);
        } catch (putErr) {
            console.error('PUT Error:', putErr.response ? { status: putErr.response.status, data: putErr.response.data } : putErr.message);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
