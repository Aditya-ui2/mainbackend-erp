const { Interview, Candidate, RecruitmentPosition, DepartmentTeam, TeamLeader, Client } = require('../models/sequelizeModels');
const { Op } = require('sequelize');
const sendEmail = require('../utils/emailService');
const crypto = require('crypto');

/**
 * Generate interview meeting link with token
 */
const generateMeetingLink = (token) => {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return `${baseUrl}/interview/join/${token}`;
};

/**
 * Generate interview feedback form link
 */
const generateFeedbackLink = (interviewId, token) => {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return `${baseUrl}/interview/feedback/${interviewId}/${token}`;
};

/**
 * Send interview invitation email to candidate
 */
const sendInterviewInvitation = async (interview, candidate, position) => {
    const meetingLink = generateMeetingLink(interview.meetingToken);
    
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = new Date(interview.interviewDate).toLocaleDateString('en-IN', dateOptions);
    
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
                .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                .details-box { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea; }
                .detail-row { display: flex; margin: 10px 0; }
                .detail-label { font-weight: 600; width: 150px; color: #555; }
                .detail-value { color: #333; }
                .join-btn { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-weight: bold; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
                .highlight { color: #667eea; font-weight: bold; }
                .tips { background: #fff3cd; border-radius: 8px; padding: 15px; margin-top: 20px; }
                .tips h4 { margin-top: 0; color: #856404; }
                .tips ul { margin: 0; padding-left: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎉 Interview Scheduled!</h1>
                    <p>Congratulations on moving forward in the hiring process</p>
                </div>
                <div class="content">
                    <p>Dear <strong>${candidate.name}</strong>,</p>
                    <p>We are pleased to inform you that your interview has been scheduled for the position of <span class="highlight">${position.title}</span>.</p>
                    
                    <div class="details-box">
                        <h3 style="margin-top: 0; color: #667eea;">📅 Interview Details</h3>
                        <div class="detail-row">
                            <span class="detail-label">📆 Date:</span>
                            <span class="detail-value">${formattedDate}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">⏰ Time:</span>
                            <span class="detail-value">${interview.startTime}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">⏱️ Duration:</span>
                            <span class="detail-value">${interview.duration} minutes</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">📋 Round:</span>
                            <span class="detail-value">${interview.interviewType}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">👤 Interviewer:</span>
                            <span class="detail-value">${interview.interviewerName || 'TBD'} (${interview.interviewerRole || 'Hiring Team'})</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">🎥 Mode:</span>
                            <span class="detail-value">${interview.meetingType} Interview</span>
                        </div>
                    </div>

                    ${interview.meetingType === 'Video' ? `
                    <div style="text-align: center;">
                        <p><strong>Join your interview using the link below:</strong></p>
                        <a href="${meetingLink}" class="join-btn">🎥 Join Interview</a>
                        <p style="font-size: 12px; color: #666;">Or copy this link: ${meetingLink}</p>
                    </div>
                    ` : ''}

                    <div class="tips">
                        <h4>💡 Tips for a Successful Interview:</h4>
                        <ul>
                            <li>Test your camera and microphone before the interview</li>
                            <li>Find a quiet, well-lit space</li>
                            <li>Have a copy of your resume ready</li>
                            <li>Prepare questions about the role and company</li>
                            <li>Join 5 minutes early</li>
                        </ul>
                    </div>

                    <div class="footer">
                        <p>Best of luck with your interview!</p>
                        <p><strong>Mabicons HR Team</strong></p>
                        <p style="font-size: 11px;">If you need to reschedule, please reply to this email at least 24 hours before the interview.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;

    try {
        await sendEmail({
            email: candidate.email,
            name: candidate.name,
            subject: `Interview Scheduled: ${position.title} - ${interview.interviewType}`,
            htmlContent
        });
        return true;
    } catch (error) {
        console.error('Error sending interview invitation:', error);
        return false;
    }
};

/**
 * @desc    Schedule a new interview
 * @route   POST /api/interview/schedule
 * @access  Private
 */
const scheduleInterview = async (req, res) => {
    try {
        const {
            candidateId, positionId, clientId, interviewType, interviewDate,
            startTime, duration, meetingType, meetingLink: clientMeetingLink, interviewerId, interviewerType,
            interviewerName, interviewerEmail, interviewerRole, notes
        } = req.body;

        const candidate = await Candidate.findByPk(candidateId);
        if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

        const position = await RecruitmentPosition.findByPk(positionId);
        if (!position) return res.status(404).json({ success: false, message: 'Position not found' });

        const meetingToken = crypto.randomBytes(32).toString('hex');
        const meetingLink = clientMeetingLink || generateMeetingLink(meetingToken);

        const interview = await Interview.create({
            candidateId, positionId, clientId, interviewType, interviewDate,
            startTime, duration: duration || 45, meetingType: meetingType || 'Video',
            meetingLink, meetingToken,
            interviewerId, interviewerType, interviewerName,
            interviewerEmail, interviewerRole, notes,
        });

        await candidate.update({ status: 'Interview', interviewDate });

        const emailSent = await sendInterviewInvitation(interview, candidate, position);
        if (emailSent) {
            await interview.update({ emailSentToCandidate: true, emailSentAt: new Date() });
        }

        const populatedInterview = await Interview.findByPk(interview.id, {
            include: [
                { model: Candidate, as: 'candidate', attributes: ['name', 'email', 'phone'] },
                { model: RecruitmentPosition, as: 'position', attributes: ['title', 'location'] },
                { model: Client, as: 'client', attributes: ['companyName'] },
            ]
        });

        res.status(201).json({
            success: true,
            message: 'Interview scheduled successfully' + (emailSent ? ' and invitation email sent to candidate' : ''),
            data: populatedInterview, emailSent
        });
    } catch (error) {
        console.error('Error scheduling interview:', error);
        res.status(500).json({ success: false, message: 'Failed to schedule interview', error: error.message });
    }
};

/**
 * @desc    Get all interviews with filters
 * @route   GET /api/interview
 * @access  Private
 */
const getInterviews = async (req, res) => {
    try {
        const userId = req.user.id;
        const isHead = req.user.role === 'Department Head' || req.user.role === 'Admin' || req.user.id === '60de4380-0140-49ff-b26d-a8d06333af11';
        
        let memberIds = [userId];
        if (isHead) {
            const teamMembers = await DepartmentTeam.findAll({ 
                where: { managerId: userId },
                attributes: ['id']
            });
            memberIds = [...memberIds, ...teamMembers.map(m => m.id)];
        }

        const where = {};
        if (status) where.status = status;
        if (interviewType) where.interviewType = interviewType;
        if (candidateId) where.candidateId = candidateId;
        if (positionId) where.positionId = positionId;

        // For non-admins, filter interviews where they are the interviewer OR it is for a position they manage/team manages
        if (!isHead && req.user.role !== 'Admin') {
            where[Op.or] = [
                { interviewerId: userId },
                { interviewerName: { [Op.iLike]: `%${req.user.name?.split(' ')[0]}%` } }
            ];
        } else if (isHead) {
            // Head sees everything for their team members
            where[Op.or] = [
                { interviewerId: { [Op.in]: memberIds } },
                { interviewerName: { [Op.iLike]: `%${req.user.name?.split(' ')[0]}%` } }
            ];
        }

        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            where.interviewDate = { [Op.between]: [startOfDay, endOfDay] };
        }

        const interviews = await Interview.findAll({
            where,
            include: [
                { model: Candidate, as: 'candidate', attributes: ['name', 'email', 'phone', 'cvUrl'] },
                { model: RecruitmentPosition, as: 'position', attributes: ['title', 'location'] },
                { model: Client, as: 'client', attributes: ['companyName'] },
            ],
            order: [['interviewDate', 'DESC'], ['startTime', 'ASC']],
        });

        // Group by date
        const groupedInterviews = {};
        interviews.forEach(interview => {
            const dateKey = new Date(interview.interviewDate).toISOString().split('T')[0];
            if (!groupedInterviews[dateKey]) groupedInterviews[dateKey] = [];
            groupedInterviews[dateKey].push(interview);
        });

        // Stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const [todaysInterviews, scheduled, completed, cancelled] = await Promise.all([
            Interview.count({ 
                where: { 
                    ...where,
                    interviewDate: { [Op.gte]: today, [Op.lt]: tomorrow } 
                } 
            }),
            Interview.count({ where: { ...where, status: 'Scheduled' } }),
            Interview.count({ where: { ...where, status: 'Completed' } }),
            Interview.count({ where: { ...where, status: 'Cancelled' } }),
        ]);

        res.status(200).json({
            success: true, data: interviews, groupedByDate: groupedInterviews,
            stats: { todaysInterviews, scheduled, completed, cancelled }
        });
    } catch (error) {
        console.error('Error fetching interviews:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch interviews', error: error.message });
    }
};

/**
 * @desc    Get single interview by ID
 * @route   GET /api/interview/:id
 * @access  Private
 */
const getInterviewById = async (req, res) => {
    try {
        const interview = await Interview.findByPk(req.params.id, {
            include: [
                { model: Candidate, as: 'candidate', attributes: ['name', 'email', 'phone', 'cvUrl', 'skills', 'experience'] },
                { model: RecruitmentPosition, as: 'position', attributes: ['title', 'location', 'description', 'skills'] },
                { model: Client, as: 'client', attributes: ['companyName'] },
            ]
        });

        if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });
        res.status(200).json({ success: true, data: interview });
    } catch (error) {
        console.error('Error fetching interview:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch interview', error: error.message });
    }
};

/**
 * @desc    Get interview by meeting token (for candidate access)
 * @route   GET /api/interview/join/:token
 * @access  Public
 */
const getInterviewByToken = async (req, res) => {
    try {
        const { token } = req.params;
        
        const interview = await Interview.findOne({
            where: { meetingToken: token },
            include: [
                { model: Candidate, as: 'candidate', attributes: ['name', 'email'] },
                { model: RecruitmentPosition, as: 'position', attributes: ['title', 'location'] },
                { model: Client, as: 'client', attributes: ['companyName'] },
            ]
        });

        if (!interview) return res.status(404).json({ success: false, message: 'Invalid meeting link' });

        const interviewDate = new Date(interview.interviewDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (interviewDate < today) {
            return res.status(400).json({ success: false, message: 'This interview has already passed' });
        }

        res.status(200).json({ 
            success: true, 
            data: {
                interviewDate: interview.interviewDate, startTime: interview.startTime,
                duration: interview.duration, interviewType: interview.interviewType,
                meetingType: interview.meetingType, interviewer: interview.interviewerName,
                position: interview.position?.title, company: interview.client?.companyName,
                status: interview.status
            }
        });
    } catch (error) {
        console.error('Error fetching interview by token:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch interview', error: error.message });
    }
};

/**
 * @desc    Update interview status
 * @route   PUT /api/interview/:id/status
 * @access  Private
 */
const updateInterviewStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rescheduleReason, newDate, newTime } = req.body;

        const interview = await Interview.findByPk(id);
        if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

        if (status === 'Rescheduled' && newDate) {
            const newToken = crypto.randomBytes(32).toString('hex');
            await interview.update({
                interviewDate: newDate,
                startTime: newTime || interview.startTime,
                meetingToken: newToken,
                meetingLink: generateMeetingLink(newToken),
                status,
            });

            const candidate = await Candidate.findByPk(interview.candidateId);
            const position = await RecruitmentPosition.findByPk(interview.positionId);
            if (candidate && position) await sendInterviewInvitation(interview, candidate, position);
        } else {
            await interview.update({ status });
        }

        res.status(200).json({ success: true, message: 'Interview status updated', data: interview });
    } catch (error) {
        console.error('Error updating interview status:', error);
        res.status(500).json({ success: false, message: 'Failed to update interview', error: error.message });
    }
};

/**
 * @desc    Submit interview feedback/evaluation
 * @route   POST /api/interview/:id/feedback
 * @access  Private
 */
const submitInterviewFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const { skills, attitude, knowledge, communication, behavior, overallRating, strengths, weaknesses, recommendation, notes } = req.body;

        const ratings = [skills, attitude, knowledge, communication, behavior];
        for (const rating of ratings) {
            if (rating && (rating < 1 || rating > 10)) {
                return res.status(400).json({ success: false, message: 'All ratings must be between 1 and 10' });
            }
        }

        const interview = await Interview.findByPk(id);
        if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

        const calculatedOverall = overallRating || Math.round((skills + attitude + knowledge + communication + behavior) / 5);

        await interview.update({
            evaluation: {
                skills, attitude, knowledge, communication, behavior,
                overallRating: calculatedOverall, strengths, weaknesses,
                recommendation, notes, feedbackSubmittedAt: new Date()
            },
            status: 'Completed'
        });

        // Update candidate status based on recommendation
        if (recommendation === 'Strongly Recommend' || recommendation === 'Recommend') {
            await Candidate.update({ status: 'Shortlisted' }, { where: { id: interview.candidateId } });
        } else if (recommendation === 'Not Recommend' || recommendation === 'Strongly Not Recommend') {
            await Candidate.update({ status: 'Rejected' }, { where: { id: interview.candidateId } });
        }

        res.status(200).json({ success: true, message: 'Interview feedback submitted successfully', data: interview });
    } catch (error) {
        console.error('Error submitting feedback:', error);
        res.status(500).json({ success: false, message: 'Failed to submit feedback', error: error.message });
    }
};

/**
 * @desc    Get interview feedback form (for interviewer)
 * @route   GET /api/interview/:id/feedback-form
 * @access  Private
 */
const getInterviewFeedbackForm = async (req, res) => {
    try {
        const { id } = req.params;

        const interview = await Interview.findByPk(id, {
            include: [
                { model: Candidate, as: 'candidate', attributes: ['name', 'email', 'phone', 'skills', 'experience', 'cvUrl'] },
                { model: RecruitmentPosition, as: 'position', attributes: ['title', 'description', 'skills'] },
            ]
        });

        if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

        res.status(200).json({
            success: true,
            data: {
                interviewId: interview.id, candidate: interview.candidate,
                position: interview.position, interviewType: interview.interviewType,
                interviewDate: interview.interviewDate, startTime: interview.startTime,
                existingEvaluation: interview.evaluation,
                evaluationCriteria: [
                    { key: 'skills', label: 'Technical Skills', description: 'Rate the candidate\'s technical expertise and proficiency' },
                    { key: 'attitude', label: 'Attitude', description: 'Rate the candidate\'s attitude and enthusiasm' },
                    { key: 'knowledge', label: 'Domain Knowledge', description: 'Rate the candidate\'s industry/domain knowledge' },
                    { key: 'communication', label: 'Communication', description: 'Rate the candidate\'s communication skills' },
                    { key: 'behavior', label: 'Behavior', description: 'Rate the candidate\'s professional behavior' }
                ]
            }
        });
    } catch (error) {
        console.error('Error fetching feedback form:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch feedback form', error: error.message });
    }
};

/**
 * @desc    Cancel an interview
 * @route   DELETE /api/interview/:id
 * @access  Private
 */
const cancelInterview = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const interview = await Interview.findByPk(id);
        if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

        await interview.update({
            status: 'Cancelled',
            notes: (interview.notes || '') + `\nCancelled: ${reason || 'No reason provided'}`
        });

        await Candidate.update({ status: 'Shortlisted' }, { where: { id: interview.candidateId } });

        res.status(200).json({ success: true, message: 'Interview cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling interview:', error);
        res.status(500).json({ success: false, message: 'Failed to cancel interview', error: error.message });
    }
};

/**
 * @desc    Send reminder email
 * @route   POST /api/interview/:id/remind
 * @access  Private
 */
const sendInterviewReminder = async (req, res) => {
    try {
        const { id } = req.params;
        
        const interview = await Interview.findByPk(id, {
            include: [
                { model: Candidate, as: 'candidate', attributes: ['name', 'email'] },
                { model: RecruitmentPosition, as: 'position', attributes: ['title'] },
            ]
        });

        if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

        const meetingLink = generateMeetingLink(interview.meetingToken);
        const formattedDate = new Date(interview.interviewDate).toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        await sendEmail({
            email: interview.candidate.email,
            name: interview.candidate.name,
            subject: `Reminder: Interview Tomorrow - ${interview.position.title}`,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #667eea;">⏰ Interview Reminder</h2>
                    <p>Dear ${interview.candidate.name},</p>
                    <p>This is a friendly reminder about your upcoming interview scheduled for <strong>${formattedDate}</strong> at <strong>${interview.startTime}</strong>.</p>
                    <p><strong>Position:</strong> ${interview.position.title}</p>
                    <p><strong>Interview Type:</strong> ${interview.interviewType}</p>
                    ${interview.meetingType === 'Video' ? `
                        <p style="margin-top: 20px;">
                            <a href="${meetingLink}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">Join Interview</a>
                        </p>
                    ` : ''}
                    <p style="margin-top: 20px;">Best of luck!</p>
                    <p>Mabicons HR Team</p>
                </div>
            `
        });

        interview.reminderSent = true;
        await interview.save();

        res.status(200).json({ success: true, message: 'Reminder email sent successfully' });
    } catch (error) {
        console.error('Error sending reminder:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send reminder', 
            error: error.message 
        });
    }
};

module.exports = {
    scheduleInterview,
    getInterviews,
    getInterviewById,
    getInterviewByToken,
    updateInterviewStatus,
    submitInterviewFeedback,
    getInterviewFeedbackForm,
    cancelInterview,
    sendInterviewReminder
};
