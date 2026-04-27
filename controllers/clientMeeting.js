const { ClientMeeting, Client } = require('../models/sequelizeModels');

// Get all meetings
exports.getAllMeetings = async (req, res) => {
    try {
        const meetings = await ClientMeeting.findAll({
            order: [['meetingDate', 'ASC'], ['meetingTime', 'ASC']]
        });
        res.status(200).json({ success: true, data: meetings });
    } catch (error) {
        console.error('Error fetching meetings:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch meetings' });
    }
};

// Create a meeting
exports.createMeeting = async (req, res) => {
    try {
        const { title, clientId, meetingDate, meetingTime, meetingType, platform, attendees } = req.body;
        
        const client = await Client.findByPk(clientId);
        if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

        const meeting = await ClientMeeting.create({
            title,
            clientId,
            companyName: client.companyName || client.name,
            meetingDate,
            meetingTime,
            meetingType: meetingType || 'Virtual',
            platform,
            attendees: attendees || 1,
            status: 'Scheduled'
        });

        res.status(201).json({ success: true, data: meeting });
    } catch (error) {
        console.error('Error creating meeting:', error);
        res.status(500).json({ success: false, message: 'Failed to create meeting' });
    }
};

// Seed initial meetings
exports.seedMeetings = async (req, res) => {
    try {
        const clients = await Client.findAll({ limit: 5 });
        if (clients.length === 0) return res.status(400).json({ message: 'No clients found to seed meetings' });

        const meetingTitles = [
            'Q1 Review & Renewal', 'Onboarding Follow-up', 'Proposal Discussion', 'Quarterly Sync', 'Tech Alignment'
        ];

        const baseDate = new Date();
        
        for (let i = 0; i < meetingTitles.length; i++) {
            const client = clients[i % clients.length];
            const date = new Date();
            date.setDate(baseDate.getDate() + (i + 1));
            
            await ClientMeeting.create({
                title: meetingTitles[i],
                clientId: client.id,
                companyName: client.companyName || client.name,
                meetingDate: date.toISOString().split('T')[0],
                meetingTime: `${10 + i}:00 AM`,
                meetingType: i % 2 === 0 ? 'Virtual' : 'In-Person',
                platform: i % 2 === 0 ? 'Zoom Meeting' : 'Client HQ',
                attendees: Math.floor(Math.random() * 5) + 2,
                status: 'Scheduled'
            });
        }
        res.status(200).json({ success: true, message: 'Meetings seeded successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Update meeting status
exports.updateMeetingStatus = async (req, res) => {
    try {
        const { meetingId, status } = req.body;
        const meeting = await ClientMeeting.findByPk(meetingId);
        if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found' });

        meeting.status = status;
        await meeting.save();

        res.status(200).json({ success: true, data: meeting });
    } catch (error) {
        console.error('Error updating meeting status:', error);
        res.status(500).json({ success: false, message: 'Failed to update meeting status' });
    }
};

// Delete meeting
exports.deleteMeeting = async (req, res) => {
    try {
        const { meetingId } = req.body;
        const meeting = await ClientMeeting.findByPk(meetingId);
        if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found' });

        await meeting.destroy();
        res.status(200).json({ success: true, message: 'Meeting deleted successfully' });
    } catch (error) {
        console.error('Error deleting meeting:', error);
        res.status(500).json({ success: false, message: 'Failed to delete meeting' });
    }
};
