require('dotenv').config();
const { ClientMeeting, sequelize } = require('../models/sequelizeModels');

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');
    const meetings = await ClientMeeting.findAll();
    console.log('Meetings count:', meetings.length);
    console.log(JSON.stringify(meetings.map(m => ({
      id: m.id,
      title: m.title,
      companyName: m.companyName,
      meetingDate: m.meetingDate,
      meetingTime: m.meetingTime,
      platform: m.platform,
      status: m.status
    })), null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}
run();
