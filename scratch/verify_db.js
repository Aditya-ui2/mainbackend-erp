const { sequelize, Notification, PaymentRequest } = require('../models/sequelizeModels');

async function verifyDB() {
  try {
    console.log('1. Checking connection to database...');
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    console.log('2. Finding latest payment requests...');
    const payments = await PaymentRequest.findAll({
      order: [['createdAt', 'DESC']],
      limit: 5
    });
    console.log(`Found ${payments.length} payment requests in DB.`);
    
    for (const p of payments) {
      console.log(`- Request ID: ${p.id}, Payee: ${p.payee}, Client ID: ${p.clientId}, Amount: ${p.amount}, Status: ${p.status}`);
    }

    console.log('3. Fetching latest 5 notifications...');
    const notifications = await Notification.findAll({
      order: [['createdAt', 'DESC']],
      limit: 5
    });
    console.log(`Found ${notifications.length} notifications in DB.`);
    for (const n of notifications) {
      console.log(`- Notification ID: ${n.id}, User ID: ${n.userId}, User Type: ${n.userType}, Message: "${n.message}", Status: ${n.status}, CreatedAt: ${n.createdAt}`);
    }

  } catch (error) {
    console.error('Database query error:', error);
  } finally {
    await sequelize.close();
  }
}

verifyDB();
