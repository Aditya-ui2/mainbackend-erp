// scratch/test_api_http.js
const axios = require('axios');
const { SuperAdmin } = require('../models/sequelizeModels');

async function run() {
    try {
        // Find a superadmin to get their email
        const sa = await SuperAdmin.findOne();
        if (!sa) {
            console.error("No superadmin found in DB!");
            process.exit(1);
        }
        
        console.log(`Found SuperAdmin: ${sa.name} (${sa.email})`);
        
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
        
        const types = [
            'clients',
            'employees',
            'total_monthly_billing',
            'total_yearly_revenue',
            'operations_billing',
            'recruitment_billing',
            'sales_revenue',
            'salary_payout',
            'office_rent',
            'net_profit',
            'pending_collections'
        ];
        
        for (const type of types) {
            try {
                const res = await instance.get(`/superAdmin/dashboard-kpi-details?type=${type}`);
                console.log(`TYPE: ${type} -> SUCCESS: ${res.data.success}, COUNT: ${res.data.data ? res.data.data.length : 0}`);
                if (res.data.data && res.data.data.length > 0) {
                    console.log(`Preview:`, res.data.data[0]);
                }
            } catch (err) {
                console.error(`TYPE: ${type} -> ERROR:`, err.response ? err.response.status : err.message, err.response ? err.response.data : '');
            }
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
