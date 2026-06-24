const axios = require('axios');

async function testGetAllClients() {
    try {
        const response = await axios.get('http://localhost:3000/client/all', {
            headers: {
                // We might need a token here since it has verifyAuthToken
                // But let's see if it gives 401 or 500
            }
        });
        console.log('Status:', response.status);
        console.log('Data:', response.data);
    } catch (error) {
        if (error.response) {
            console.error('Error Status:', error.response.status);
            console.error('Error Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testGetAllClients();
