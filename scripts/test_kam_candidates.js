require('dotenv').config();
const { DepartmentTeam } = require('../models/sequelizeModels');
const jwt = require('jsonwebtoken');
const axios = require('axios');

async function test() {
    const manju = await DepartmentTeam.findOne({ where: { email: 'manju.mabicons@gmail.com' } });
    if (!manju) {
        console.log('Manju not found');
        return;
    }

    const token = jwt.sign({
        id: manju.id,
        email: manju.email,
        name: manju.name,
        role: manju.role,
        department: manju.department,
        userType: 'departmentTeam'
    }, process.env.JWT_SECRET, { expiresIn: '24h' });

    try {
        const res = await axios.get('http://localhost:3000/recruitment/candidates', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`Success: ${res.data.success}`);
        console.log(`Candidate count: ${res.data.data.length}`);
        if (res.data.data.length > 0) {
            console.log('Sample Candidate:', res.data.data[0].name);
        }
    } catch (err) {
        console.error('Error:', err.response?.data || err.message);
    }
    process.exit();
}
test();
