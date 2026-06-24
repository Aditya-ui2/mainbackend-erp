// scratch/verify.js
const axios = require('axios');
const { SuperAdmin } = require('../models/sequelizeModels');

async function run() {
    try {
        const sa = await SuperAdmin.findOne();
        if (!sa) {
            console.error("No superadmin found");
            process.exit(1);
        }
        
        // Use the exact JWT signing/mocking method that is configured in the environment
        const payload = {
            id: sa.id,
            email: sa.email,
            role: 'SuperAdmin'
        };
        const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
        const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${base64Payload}.mock-signature`;
        
        const instance = axios.create({
            baseURL: 'http://localhost:3000',
            headers: { 'Authorization': `Bearer ${token}` }
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
        
        console.log("Starting KPI details endpoint verification...");
        for (const type of types) {
            try {
                const res = await instance.get(`/superAdmin/dashboard-kpi-details?type=${type}`);
                const count = res.data.data ? res.data.data.length : 0;
                console.log(`- KPI: ${type} -> success: ${res.data.success}, count: ${count}`);
                if (count > 0) {
                    const first = res.data.data[0];
                    console.log(`  Preview field keys: ${Object.keys(first).join(', ')}`);
                    console.log(`  Preview sample: name="${first.name || first.client}", total/amount="${first.total || first.amount}", dept="${first.dept}"`);
                }
            } catch (err) {
                console.error(`- KPI: ${type} -> ERROR:`, err.response ? err.response.status : err.message);
            }
        }
        
        console.log("\nChecking overall dashboard stats...");
        try {
            const statsRes = await instance.get('/superAdmin/dashboard-stats');
            console.log(`- Stats -> success: ${statsRes.data.success}`);
            console.log(`  recentInvoices count: ${statsRes.data.data.recentInvoices?.length || 0}`);
            if (statsRes.data.data.recentInvoices?.length > 0) {
                const firstInv = statsRes.data.data.recentInvoices[0];
                console.log(`  Recent invoice sample keys: ${Object.keys(firstInv).join(', ')}`);
                console.log(`  Recent invoice details: id="${firstInv.id}", client="${firstInv.client}", total/amount="${firstInv.total || firstInv.amount}", dept="${firstInv.dept}", invoiceFileName="${firstInv.invoiceFileName}"`);
            }
        } catch (err) {
            console.error(`- Stats -> ERROR:`, err.response ? err.response.status : err.message);
        }
        
        process.exit(0);
    } catch (e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}
run();
