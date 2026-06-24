// scratch/test_stats_http.js
const axios = require('axios');
const { SuperAdmin } = require('../models/sequelizeModels');

async function run() {
    try {
        const sa = await SuperAdmin.findOne();
        if (!sa) {
            console.error("No superadmin found in DB!");
            process.exit(1);
        }
        
        const payload = {
            id: sa.id,
            email: sa.email,
            role: 'SuperAdmin'
        };
        const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
        const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${base64Payload}.mock-signature`;
        
        const instance = axios.create({
            baseURL: 'http://localhost:3000',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const res = await instance.get('/superAdmin/dashboard-stats');
        console.log("STATS RESPONSE:", res.data);
        process.exit(0);
    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
        process.exit(1);
    }
}
run();
