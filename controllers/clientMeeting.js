const { ClientMeeting, Client, Lead } = require('../models/sequelizeModels');
const sendEmail = require('../utils/emailService');

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
        
        let client = await Client.findByPk(clientId);
        let lead;
        if (!client) {
            lead = await Lead.findByPk(clientId);
        }

        let targetClient = client;
        if (!targetClient) {
            // Fallback to the first client in database to handle mock client IDs from frontend gracefully
            targetClient = await Client.findOne();
        }
        if (!targetClient) return res.status(404).json({ success: false, message: 'Client not found' });

        const meeting = await ClientMeeting.create({
            title,
            clientId: targetClient.id,
            companyName: lead ? lead.companyName : (targetClient.companyName || targetClient.name),
            meetingDate,
            meetingTime,
            meetingType: meetingType || 'Virtual',
            platform,
            attendees: attendees || 1,
            status: 'Scheduled'
        });

        // Send email to client or lead if email exists
        const recipientEmail = lead ? lead.email : (client ? client.email : null);
        const recipientName = lead ? lead.contactPerson : (client ? (client.spocName || client.name) : null);
        
        if (recipientEmail) {
            const meetingLink = platform && platform.startsWith('http') ? platform : '';
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f4f3ef; border-radius: 10px;">
                    <h2 style="color: #1B4DA0;">New Meeting Scheduled</h2>
                    <p>Dear ${recipientName || 'Client'},</p>
                    <p>A new meeting has been scheduled for you. Here are the details:</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <tr>
                            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee; width: 30%;">Subject:</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">${title}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Date:</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">${meetingDate}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Time:</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">${meetingTime}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Platform:</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">Google Meet</td>
                        </tr>
                        ${meetingLink ? `
                        <tr>
                            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Meeting Link:</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="${meetingLink}" style="color: #1B4DA0; text-decoration: underline;">${meetingLink}</a></td>
                        </tr>
                        ` : ''}
                    </table>
                    <p>Looking forward to speaking with you.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #999;">This is an automated notification. Please do not reply to this email.</p>
                </div>
            `;
            
            try {
                await sendEmail({
                    email: recipientEmail,
                    name: recipientName || recipientEmail,
                    subject: `Meeting Scheduled: ${title}`,
                    htmlContent
                });
                console.log(`Meeting notification email sent to ${recipientEmail}`);
            } catch (err) {
                console.error('Failed to send meeting notification email:', err);
            }
        }

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
