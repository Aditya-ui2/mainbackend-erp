require('dotenv').config();
const { ClientMeeting, Client, sequelize } = require('../models/sequelizeModels');

async function test() {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB.');
    const client = await Client.findOne();
    if (!client) {
      console.log('No clients in DB!');
      return;
    }
    console.log('Using client:', client.id, client.companyName);
    const meeting = await ClientMeeting.create({
      title: 'Test Meeting',
      clientId: client.id,
      companyName: client.companyName,
      meetingDate: '2026-06-11',
      meetingTime: '16:12',
      meetingType: 'Virtual',
      platform: 'https://meet.google.com/ssa-oynn-hsg',
      attendees: 2,
      status: 'Scheduled'
    });
    console.log('Success! Meeting created:', meeting.id);
  } catch (error) {
    console.error('Error creating meeting:', error);
  } finally {
    await sequelize.close();
  }
}
test();
