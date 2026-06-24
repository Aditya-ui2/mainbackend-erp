const axios = require('axios');

async function test() {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(JSON.stringify({
        id: '99999999-9999-9999-9999-999999999999',
        role: 'bd',
        email: 'random_nonexistent_email_12345@test.com',
        name: 'CRM Executive',
        department: 'CRM',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
    })).toString('base64');
    const token = `${header}.${payload}.mock-signature`;

    try {
        const response = await axios.post('http://localhost:3000/client/create', {
            companyName: 'Test Company 3 LLC',
            ownerName: 'Test Owner 3',
            ownerEmail: 'test.owner3@testcompany.com',
            spocName: 'Test SPOC 3',
            spocEmail: 'test.spoc3@testcompany.com',
            industry: 'IT',
            agreementType: 'Recruitment',
            feeAmount: 5000,
            paymentTerms: '30 Days'
        }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Response Status:', response.status);
        console.log('Response Data:', response.data);
    } catch (error) {
        console.log('Error Status:', error.response?.status);
        console.log('Error Data:', error.response?.data);
    }
}

test();
