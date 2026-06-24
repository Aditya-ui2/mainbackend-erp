const axios = require('axios');

async function test() {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(JSON.stringify({
        id: '00000000-0000-0000-0000-000000000000',
        role: 'accounts',
        email: 'accounts.mabicons@gmail.com',
        name: 'Accounts Manager',
        department: 'Accounts',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
    })).toString('base64');
    const token = `${header}.${payload}.mock-signature`;

    try {
        const response = await axios.get('http://localhost:3000/client/all', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Response Status:', response.status);
        console.log('Clients count:', response.data?.data?.count);
        console.log('Clients list:', response.data?.data?.clients?.map(c => c.companyName));
    } catch (error) {
        console.log('Error Status:', error.response?.status);
        console.log('Error Data:', error.response?.data);
    }
}

test();
