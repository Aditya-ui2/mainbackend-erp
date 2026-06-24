const axios = require('axios');

async function test() {
    try {
        const response = await axios.post('http://localhost:3000/recruitment/candidate/generate-credentials', {
            candidateId: 'SOME_VALID_UUID' // I need a real UUID
        });
        console.log(response.data);
    } catch (error) {
        console.error(error.response ? error.response.data : error.message);
    }
}

test();
