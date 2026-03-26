const { Interview, Candidate, RecruitmentPosition, DepartmentTeam, TeamLeader } = require('../models/models');
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
                            <span class="detail-value">${interview.interviewer.name} (${interview.interviewer.role || 'Hiring Team'})</span>
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
            candidateId,
            positionId,
            clientId,
            interviewType,
            interviewDate,
            startTime,
            duration,
            meetingType,
            interviewerId,
            interviewerType,
            interviewerName,
            interviewerEmail,
            interviewerRole,
            notes
        } = req.body;

        // Validate candidate exists
        const candidate = await Candidate.findById(candidateId);
        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        // Get position details
        const position = await RecruitmentPosition.findById(positionId);
        if (!position) {
            return res.status(404).json({ success: false, message: 'Position not found' });
        }

        // Generate meeting token
        const meetingToken = crypto.randomBytes(32).toString('hex');
        const meetingLink = generateMeetingLink(meetingToken);

        // Create interview
        const interview = new Interview({
            candidate: candidateId,
            position: positionId,
            client: clientId,
            interviewType,
            interviewDate,
            startTime,
            duration: duration || 45,
            meetingType: meetingType || 'Video',
            meetingLink,
            meetingToken,
            interviewer: {
                id: interviewerId,
                type: interviewerType,
                name: interviewerName,
                email: interviewerEmail,
                role: interviewerRole
            },
            notes,
            createdBy: {
                id: req.user?.userId,
                type: req.user?.role === 'teamLeader' ? 'TeamLeader' : 'DepartmentTeam',
                name: req.user?.name || 'System'
            }
        });

        await interview.save();

        // Update candidate status to Interview
        await Candidate.findByIdAndUpdate(candidateId, { 
            status: 'Interview', 
            interviewDate 
        });

        // Send automated email to candidate
        const emailSent = await sendInterviewInvitation(interview, candidate, position);
        
        if (emailSent) {
            interview.emailSentToCandidate = true;
            interview.emailSentAt = new Date();
            await interview.save();
        }

        // Populate the response
        const populatedInterview = await Interview.findById(interview._id)
            .populate('candidate', 'name email phone')
            .populate('position', 'title location')
            .populate('client', 'companyName');

        res.status(201).json({
            success: true,
            message: 'Interview scheduled successfully' + (emailSent ? ' and invitation email sent to candidate' : ''),
            data: populatedInterview,
            emailSent
        });
    } catch (error) {
        console.error('Error scheduling interview:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to schedule interview', 
            error: error.message 
        });
    }
};

/**
 * @desc    Get all interviews with filters
 * @route   GET /api/interview
 * @access  Private
 */
const getInterviews = async (req, res) => {
    try {
        const { status, date, interviewType, candidateId, positionId } = req.query;
        
        let query = {};
        
        if (status) query.status = status;
        if (interviewType) query.interviewType = interviewType;
        if (candidateId) query.candidate = candidateId;
        if (positionId) query.position = positionId;
        
        // Filter by date if provided
        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            query.interviewDate = { $gte: startOfDay, $lte: endOfDay };
        }

        const interviews = await Interview.find(query)
            .populate('candidate', 'name email phone cvUrl')
            .populate('position', 'title location')
            .populate('client', 'companyName')
            .sort({ interviewDate: -1, startTime: 1 });

        // Group interviews by date
        const groupedInterviews = {};
        interviews.forEach(interview => {
            const dateKey = new Date(interview.interviewDate).toISOString().split('T')[0];
            if (!groupedInterviews[dateKey]) {
                groupedInterviews[dateKey] = [];
            }
            groupedInterviews[dateKey].push(interview);
        });

        // Calculate stats using single aggregation instead of 4 separate queries
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const statsAgg = await Interview.aggregate([
            {
                $facet: {
                    todaysInterviews: [
                        { $match: { interviewDate: { $gte: today, $lt: tomorrow } } },
                        { $count: 'count' }
                    ],
                    scheduled: [
                        { $match: { status: 'Scheduled' } },
                        { $count: 'count' }
                    ],
                    completed: [
                        { $match: { status: 'Completed' } },
                        { $count: 'count' }
                    ],
                    cancelled: [
                        { $match: { status: 'Cancelled' } },
                        { $count: 'count' }
                    ]
                }
            }
        ]);

        const facets = statsAgg[0] || {};
        const stats = {
            todaysInterviews: facets.todaysInterviews?.[0]?.count || 0,
            scheduled: facets.scheduled?.[0]?.count || 0,
            completed: facets.completed?.[0]?.count || 0,
            cancelled: facets.cancelled?.[0]?.count || 0
        };

        res.status(200).json({
            success: true,
            data: interviews,
            groupedByDate: groupedInterviews,
            stats
        });
    } catch (error) {
        console.error('Error fetching interviews:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch interviews', 
            error: error.message 
        });
    }
};

/**
 * @desc    Get single interview by ID
 * @route   GET /api/interview/:id
 * @access  Private
 */
const getInterviewById = async (req, res) => {
    try {
        const interview = await Interview.findById(req.params.id)
            .populate('candidate', 'name email phone cvUrl skills experience')
            .populate('position', 'title location description skills')
            .populate('client', 'companyName');

        if (!interview) {
            return res.status(404).json({ success: false, message: 'Interview not found' });
        }

        res.status(200).json({ success: true, data: interview });
    } catch (error) {
        console.error('Error fetching interview:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch interview', 
            error: error.message 
        });
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
        
        const interview = await Interview.findOne({ meetingToken: token })
            .populate('candidate', 'name email')
            .populate('position', 'title location')
            .populate('client', 'companyName');

        if (!interview) {
            return res.status(404).json({ success: false, message: 'Invalid meeting link' });
        }

        // Check if interview is today or upcoming
        const interviewDate = new Date(interview.interviewDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (interviewDate < today) {
            return res.status(400).json({ 
                success: false, 
                message: 'This interview has already passed' 
            });
        }

        res.status(200).json({ 
            success: true, 
            data: {
                interviewDate: interview.interviewDate,
                startTime: interview.startTime,
                duration: interview.duration,
                interviewType: interview.interviewType,
                meetingType: interview.meetingType,
                interviewer: interview.interviewer.name,
                position: interview.position?.title,
                company: interview.client?.companyName,
                status: interview.status
            }
        });
    } catch (error) {
        console.error('Error fetching interview by token:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch interview', 
            error: error.message 
        });
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

        const interview = await Interview.findById(id);
        if (!interview) {
            return res.status(404).json({ success: false, message: 'Interview not found' });
        }

        // Handle rescheduling
        if (status === 'Rescheduled' && newDate) {
            interview.rescheduledFrom = interview.interviewDate;
            interview.interviewDate = newDate;
            if (newTime) interview.startTime = newTime;
            interview.rescheduleReason = rescheduleReason;
            
            // Regenerate meeting token for new link
            interview.meetingToken = crypto.randomBytes(32).toString('hex');
            interview.meetingLink = generateMeetingLink(interview.meetingToken);
            
            // Send updated email
            const candidate = await Candidate.findById(interview.candidate);
            const position = await RecruitmentPosition.findById(interview.position);
            if (candidate && position) {
                await sendInterviewInvitation(interview, candidate, position);
            }
        }

        interview.status = status;
        await interview.save();

        res.status(200).json({
            success: true,
            message: 'Interview status updated',
            data: interview
        });
    } catch (error) {
        console.error('Error updating interview status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update interview', 
            error: error.message 
        });
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
        const {
            skills,
            attitude,
            knowledge,
            communication,
            behavior,
            overallRating,
            strengths,
            weaknesses,
            recommendation,
            notes
        } = req.body;

        // Validate ratings
        const ratings = [skills, attitude, knowledge, communication, behavior];
        for (const rating of ratings) {
            if (rating && (rating < 1 || rating > 10)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'All ratings must be between 1 and 10' 
                });
            }
        }

        const interview = await Interview.findById(id);
        if (!interview) {
            return res.status(404).json({ success: false, message: 'Interview not found' });
        }

        // Calculate overall rating if not provided
        const calculatedOverall = overallRating || 
            Math.round((skills + attitude + knowledge + communication + behavior) / 5);

        interview.evaluation = {
            skills,
            attitude,
            knowledge,
            communication,
            behavior,
            overallRating: calculatedOverall,
            strengths,
            weaknesses,
            recommendation,
            notes,
            feedbackSubmittedAt: new Date()
        };
        interview.status = 'Completed';
        
        await interview.save();

        // Update candidate status based on recommendation
        if (recommendation === 'Strongly Recommend' || recommendation === 'Recommend') {
            await Candidate.findByIdAndUpdate(interview.candidate, { status: 'Shortlisted' });
        } else if (recommendation === 'Not Recommend' || recommendation === 'Strongly Not Recommend') {
            await Candidate.findByIdAndUpdate(interview.candidate, { status: 'Rejected' });
        }

        res.status(200).json({
            success: true,
            message: 'Interview feedback submitted successfully',
            data: interview
        });
    } catch (error) {
        console.error('Error submitting feedback:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to submit feedback', 
            error: error.message 
        });
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

        const interview = await Interview.findById(id)
            .populate('candidate', 'name email phone skills experience cvUrl')
            .populate('position', 'title description skills requirements');

        if (!interview) {
            return res.status(404).json({ success: false, message: 'Interview not found' });
        }

        res.status(200).json({
            success: true,
            data: {
                interviewId: interview._id,
                candidate: interview.candidate,
                position: interview.position,
                interviewType: interview.interviewType,
                interviewDate: interview.interviewDate,
                startTime: interview.startTime,
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
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch feedback form', 
            error: error.message 
        });
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

        const interview = await Interview.findById(id);
        if (!interview) {
            return res.status(404).json({ success: false, message: 'Interview not found' });
        }

        interview.status = 'Cancelled';
        interview.notes = (interview.notes || '') + `\nCancelled: ${reason || 'No reason provided'}`;
        await interview.save();

        // Update candidate status
        await Candidate.findByIdAndUpdate(interview.candidate, { status: 'Shortlisted' });

        res.status(200).json({
            success: true,
            message: 'Interview cancelled successfully'
        });
    } catch (error) {
        console.error('Error cancelling interview:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to cancel interview', 
            error: error.message 
        });
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
        
        const interview = await Interview.findById(id)
            .populate('candidate', 'name email')
            .populate('position', 'title');

        if (!interview) {
            return res.status(404).json({ success: false, message: 'Interview not found' });
        }

        // Send reminder email
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

        res.status(200).json({
            success: true,
            message: 'Reminder email sent successfully'
        });
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
