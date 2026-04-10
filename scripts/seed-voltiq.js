require('dotenv').config();
const { Client } = require('../models/sequelizeModels');
const { hashPassword } = require('../utils/bcryptUtils');

(async () => {
  try {
    const existing = await Client.findOne({ 
      where: { companyName: 'Voltiq Energy' } 
    });

    if (existing) {
      console.log('Voltiq Energy already exists');
      process.exit(0);
    }

    const hashedPassword = await hashPassword('Mabicons@123');
    
    await Client.create({
      name: 'Voltiq Admin',
      email: 'voltiq@mabicons.com',
      password: hashedPassword,
      companyName: 'Voltiq Energy',
      status: 'Accepted'
    });

    console.log('✅ Voltiq Energy client created successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding client:', err.message);
    process.exit(1);
  }
})();
