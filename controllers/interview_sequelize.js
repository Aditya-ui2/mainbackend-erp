const { Op } = require('sequelize');
const crypto = require('crypto');

const {
    sequelize,
    Interview,
    Candidate,
    RecruitmentPosition,
    DepartmentTeam,
    TeamLeader,
    Client,
    Notification
} = require('../models/sequelizeModels');

const sendEmail = require('../utils/emailService');

// ============ HELPER: resolveInterviewIds ============
const resolveInterviewIds = async (data) => {
    let { candidateId, positionId, clientId, candidateEmail, candidateName, positionTitle, clientName } = data;

    // 1. Resolve or Create Client
    if (!clientId && clientName) {
        const foundClient = await Client.findOne({
            where: {
                [Op.or]: [
                    { companyName: { [Op.iLike]: clientName.trim() } },
                    { name: { [Op.iLike]: clientName.trim() } }
                ]
            }
        });
        if (foundClient) {
            clientId = foundClient.id;
        } else {
            const newClient = await Client.create({
                name: clientName.trim(),
                companyName: clientName.trim(),
                email: `client_${Date.now()}@placeholder.com`,
                password: crypto.randomBytes(8).toString('hex')
            });
            clientId = newClient.id;
        }
    }

    // 2. Resolve or Create Position
    if (!positionId && positionTitle) {
        const foundPosition = await RecruitmentPosition.findOne({
            where: {
                title: { [Op.iLike]: positionTitle.trim() },
                clientId: clientId || null
            }
        });
        if (foundPosition) {
            positionId = foundPosition.id;
            if (!clientId) clientId = foundPosition.clientId;
        } else if (clientId) {
            const newPosition = await RecruitmentPosition.create({
                title: positionTitle.trim(),
                clientId: clientId,
                location: 'Remote',
                status: 'Open'
            });
            positionId = newPosition.id;
        }
    }

    // 3. Resolve or Create Candidate
    if (!candidateId && (candidateEmail || candidateName)) {
        const orConditions = [];
        if (candidateEmail) orConditions.push({ email: { [Op.iLike]: candidateEmail.trim() } });
        if (candidateName) orConditions.push({ name: { [Op.iLike]: candidateName.trim() } });

        const foundCandidate = await Candidate.findOne({ where: { [Op.or]: orConditions } });

        if (foundCandidate) {
            candidateId = foundCandidate.id;
            if (!positionId) positionId = foundCandidate.positionId;
            if (!clientId) clientId = foundCandidate.clientId;
        } else if (positionId && clientId) {
            const newCandidate = await Candidate.create({
                name: candidateName || 'New Candidate',
                email: candidateEmail || `cand_${Date.now()}@placeholder.com`,
                positionId: positionId,
                clientId: clientId,
                status: 'Interview',
                stage: 'Technical Round'
            });
            candidateId = newCandidate.id;
        }
    }

    return { candidateId, positionId, clientId };
};

const generateMeetingLink = (token) => {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return `${baseUrl}/interview/join/${token}`;
};

const buildInterviewer = (interview) => ({
    name: interview.interviewerName,
    role: interview.interviewerRole || 'Hiring Team'
});

const normalizeInterviewerType = (value) => {
    if (!value) return 'DepartmentTeam';
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'departmentteam' || normalized === 'department_team') return 'DepartmentTeam';
    if (normalized === 'teamleader' || normalized === 'team_leader') return 'TeamLeader';
    if (normalized === 'client') return 'Client';
    return 'DepartmentTeam';
};

const sendInterviewReminderNotification = async (interview) => {
    if (!interview.interviewerId) return;

    try {
        await Notification.create({
            userId: interview.interviewerId,
            userType: interview.interviewerType === 'TeamLeader' ? 'TeamLeader' : 'Employee',
            message: `Interview with ${interview.candidate?.name || 'candidate'} starts in 10 minutes.`,
            type: 'alert',
            priority: 'high'
        });
    } catch (error) {
        console.error('Failed to create interview reminder notification:', error.message);
    }
};

const processInterviewReminder = async (interview) => {
    const meetingLink = interview.meetingLink;
    const formattedDate = new Date(interview.interviewDate).toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    await sendEmail({
        email: interview.candidate.email,
        name: interview.candidate.name,
        subject: `Reminder: Interview in 10 Minutes - ${interview.position.title}`,
        htmlContent: `
            <div>
                <h2>⏰ Interview Reminder</h2>
                <p>Dear ${interview.candidate.name},</p>
                <p>Your interview is scheduled for <strong>${formattedDate}</strong> at <strong>${interview.startTime}</strong>.</p>
                <p><strong>Position:</strong> ${interview.position.title}</p>
                <p><strong>Interview Type:</strong> ${interview.interviewType}</p>
                ${interview.meetingType === 'Video' ? `<p><a href="${meetingLink}">Join Interview</a></p>` : ''}
                <p>Please be ready 5-10 minutes before the scheduled slot.</p>
                <p>Mabicons HR Team</p>
            </div>
        `
    });

    interview.reminderSent = true;
    await interview.save();
    await sendInterviewReminderNotification(interview);
};

const runAutomaticInterviewReminders = async () => {
    try {
        const now = new Date();
        const windowStart = new Date(now.getTime() + 9 * 60 * 1000);
        const windowEnd = new Date(now.getTime() + 11 * 60 * 1000);

        const interviews = await Interview.findAll({
            where: {
                status: 'Scheduled',
                reminderSent: false,
                interviewDate: {
                    [Op.between]: [windowStart, windowEnd]
                }
            },
            include: [
                { model: Candidate, as: 'candidate' },
                { model: RecruitmentPosition, as: 'position' }
            ]
        });

        for (const interview of interviews) {
            if (!interview.candidate?.email || !interview.position?.title) {
                continue;
            }

            try {
                await processInterviewReminder(interview);
            } catch (error) {
                console.error(`Failed to send automatic reminder for interview ${interview.id}:`, error.response?.data || error.message);
            }
        }
    } catch (error) {
        console.error('Automatic interview reminder scheduler failed:', error.message);
    }
};

const sendInterviewInvitation = async (interview, candidate, position) => {
    const meetingLink = generateMeetingLink(interview.meetingToken);
    const formattedDate = new Date(interview.interviewDate).toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const interviewer = buildInterviewer(interview);

    const htmlContent = `
        <div>
            <h1>🎉 Interview Scheduled!</h1>
            <p>Dear <strong>${candidate.name}</strong>,</p>
            <p>Your interview is scheduled for <span>${position.title}</span>.</p>
            <ul>
                <li>📆 Date: ${formattedDate}</li>
                <li>⏰ Time: ${interview.startTime}</li>
                <li>📋 Round: ${interview.interviewType}</li>
                <li>👤 Interviewer: ${interviewer.name} (${interviewer.role})</li>
                <li>🎥 Mode: ${interview.meetingType} Interview</li>
            </ul>
            ${interview.meetingType === 'Video' ? `<a href="${meetingLink}">🎥 Join Interview</a>` : ''}
        </div>
    `;

    await sendEmail({
        email: candidate.email,
        name: candidate.name,
        subject: `Interview Scheduled: ${position.title} - ${interview.interviewType}`,
        htmlContent
    });
};

// ============ scheduleInterview (POST /interview/schedule) ============
const scheduleInterview = async (req, res) => {
    try {
        const {
            interviewType,
            interviewDate,
            startTime,
            duration,
            meetingType,
            candidateEmail,
            candidateName,
            positionTitle,
            clientName,
            interviewerId,
            interviewerType,
            interviewerName,
            interviewerEmail,
            interviewerRole,
            notes
        } = req.body;

        // --- FULLY RESILIENT ID RESOLUTION / AUTO-CREATION ---
        const resolvedIds = await resolveInterviewIds(req.body);
        const { candidateId, positionId, clientId } = resolvedIds;

        if (!candidateId || !positionId || !clientId || !interviewType || !interviewDate || !startTime) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields. Even auto-creation failed.',
                missingFields: {
                    candidate: !candidateId,
                    position: !positionId,
                    client: !clientId,
                    type: !interviewType,
                    date: !interviewDate,
                    time: !startTime
                },
                debug: { candidateId, positionId, clientId, candidateEmail, candidateName, positionTitle, clientName }
            });
        }

        const candidate = await Candidate.findByPk(candidateId);
        if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

        const position = await RecruitmentPosition.findByPk(positionId);
        if (!position) return res.status(404).json({ success: false, message: 'Position not found' });

        const interview = await Interview.create({
            candidateId,
            positionId,
            clientId,
            interviewType,
            interviewDate: new Date(interviewDate),
            startTime,
            duration: duration || 45,
            meetingType: meetingType || 'Video',
            meetingLink: null,
            meetingToken: crypto.randomBytes(32).toString('hex'),
            meetingPassword: null,
            interviewerId: interviewerId || req.user?.id || null,
            interviewerType: normalizeInterviewerType(interviewerType || req.user?.userType),
            interviewerName: interviewerName || req.user?.name || 'Hiring Team',
            interviewerEmail: interviewerEmail || req.user?.email || null,
            interviewerRole: interviewerRole || req.user?.role || null,
            status: 'Scheduled',
            notes: notes || null
        });

        // Store generated meeting link
        interview.meetingLink = generateMeetingLink(interview.meetingToken);
        await interview.save();

        // Update candidate status + interview date
        await Candidate.update(
            { status: 'Interview', interviewDate: new Date(interviewDate) },
            { where: { id: candidateId } }
        );

        // Send invitation email (best-effort)
        try {
            await sendInterviewInvitation(interview, candidate, position);
            await Interview.update(
                { emailSentToCandidate: true, emailSentAt: new Date() },
                { where: { id: interview.id } }
            );
        } catch (e) {
            // Email failure shouldn't break scheduling
            console.error('Error sending interview invitation:', e);
        }

        const populated = await Interview.findByPk(interview.id, {
            include: [
                { model: Candidate, as: 'candidate' },
                { model: RecruitmentPosition, as: 'position' },
                { model: Client, as: 'client' }
            ]
        });

        return res.status(201).json({
            success: true,
            message: 'Interview scheduled successfully',
            data: populated
        });
    } catch (error) {
        console.error('Error scheduling interview:', error);
        return res.status(500).json({ success: false, message: 'Failed to schedule interview', error: error.message });
    }
};

// ============ getInterviews (GET /interview?...) ============
const getInterviews = async (req, res) => {
    try {
        const { status, date, interviewType, candidateId, positionId } = req.query;

        const where = {};
        // Normalize status to Title Case to match DB enum (e.g. 'scheduled' → 'Scheduled')
        if (status) where.status = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
        if (interviewType) where.interviewType = interviewType;
        if (candidateId) where.candidateId = candidateId;
        if (positionId) where.positionId = positionId;

        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            where.interviewDate = { [Op.gte]: startOfDay, [Op.lte]: endOfDay };
        }

        const interviews = await Interview.findAll({
            where,
            include: [
                { model: Candidate, as: 'candidate' },
                { model: RecruitmentPosition, as: 'position' },
                { model: Client, as: 'client' }
            ],
            order: [
                ['interviewDate', 'DESC'],
                ['startTime', 'ASC']
            ]
        });

        const groupedByDate = {};
        interviews.forEach((interview) => {
            const dateKey = interview.interviewDate ? new Date(interview.interviewDate).toISOString().split('T')[0] : null;
            if (!dateKey) return;
            if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
            groupedByDate[dateKey].push(interview);
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const [todaysInterviews, scheduled, completed, cancelled] = await Promise.all([
            Interview.count({ where: { interviewDate: { [Op.gte]: today, [Op.lt]: tomorrow } } }),
            Interview.count({ where: { status: 'Scheduled' } }),
            Interview.count({ where: { status: 'Completed' } }),
            Interview.count({ where: { status: 'Cancelled' } })
        ]);

        return res.status(200).json({
            success: true,
            data: interviews,
            groupedByDate,
            stats: {
                todaysInterviews,
                scheduled,
                completed,
                cancelled
            }
        });
    } catch (error) {
        console.error('Error fetching interviews:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch interviews', error: error.message });
    }
};

const getInterviewById = async (req, res) => {
    try {
        const interview = await Interview.findByPk(req.params.id, {
            include: [
                { model: Candidate, as: 'candidate' },
                { model: RecruitmentPosition, as: 'position' },
                { model: Client, as: 'client' }
            ]
        });

        if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });
        return res.status(200).json({ success: true, data: interview });
    } catch (error) {
        console.error('Error fetching interview:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch interview', error: error.message });
    }
};

const getInterviewByToken = async (req, res) => {
    try {
        const { token } = req.params;
        const interview = await Interview.findOne({
            where: { meetingToken: token },
            include: [
                { model: Candidate, as: 'candidate' },
                { model: RecruitmentPosition, as: 'position' },
                { model: Client, as: 'client' }
            ]
        });

        if (!interview) return res.status(404).json({ success: false, message: 'Invalid meeting link' });

        const interviewDate = interview.interviewDate ? new Date(interview.interviewDate) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (interviewDate && interviewDate < today) {
            return res.status(400).json({ success: false, message: 'This interview has already passed' });
        }

        return res.status(200).json({
            success: true,
            data: {
                interviewDate: interview.interviewDate,
                startTime: interview.startTime,
                duration: interview.duration,
                interviewType: interview.interviewType,
                meetingType: interview.meetingType,
                interviewer: interview.interviewerName,
                position: interview.position?.title,
                company: interview.client?.companyName,
                status: interview.status,
                meetingLink: interview.meetingLink
            }
        });
    } catch (error) {
        console.error('Error fetching interview by token:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch interview', error: error.message });
    }
};

const updateInterviewStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rescheduleReason, newDate, newTime } = req.body;

        if (!status) return res.status(400).json({ success: false, message: 'status is required' });

        const interview = await Interview.findByPk(id);
        if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

        if (status === 'Rescheduled' && newDate) {
            interview.rescheduledFrom = interview.interviewDate;
            interview.interviewDate = new Date(newDate);
            if (newTime) interview.startTime = newTime;
            interview.rescheduleReason = rescheduleReason || null;
            interview.meetingToken = crypto.randomBytes(32).toString('hex');
            interview.meetingLink = generateMeetingLink(interview.meetingToken);

            // Send updated email best-effort
            try {
                const [candidate, position] = await Promise.all([
                    Candidate.findByPk(interview.candidateId),
                    RecruitmentPosition.findByPk(interview.positionId)
                ]);
                if (candidate && position) {
                    await sendInterviewInvitation(interview, candidate, position);
                }
            } catch (e) {
                console.error('Error sending reschedule email:', e);
            }
        }

        interview.status = status;
        await interview.save();

        return res.status(200).json({
            success: true,
            message: 'Interview status updated',
            data: interview
        });
    } catch (error) {
        console.error('Error updating interview status:', error);
        return res.status(500).json({ success: false, message: 'Failed to update interview', error: error.message });
    }
};

const updateInterview = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            interviewType,
            interviewDate,
            startTime,
            duration,
            meetingType,
            interviewerName,
            interviewerEmail,
            interviewerRole,
            notes
        } = req.body;

        const interview = await Interview.findByPk(id);
        if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

        const resolvedIds = await resolveInterviewIds(req.body);
        const { candidateId, positionId, clientId } = resolvedIds;

        // Update fields if provided
        if (candidateId) interview.candidateId = candidateId;
        if (positionId) interview.positionId = positionId;
        if (clientId) interview.clientId = clientId;
        if (interviewType) interview.interviewType = interviewType;
        if (interviewDate) interview.interviewDate = new Date(interviewDate);
        if (startTime) interview.startTime = startTime;
        if (duration) interview.duration = duration;
        if (meetingType) interview.meetingType = meetingType;
        if (interviewerName) interview.interviewerName = interviewerName;
        if (interviewerEmail) interview.interviewerEmail = interviewerEmail;
        if (interviewerRole) interview.interviewerRole = interviewerRole;
        if (notes !== undefined) interview.notes = notes;

        await interview.save();

        const populated = await Interview.findByPk(interview.id, {
            include: [
                { model: Candidate, as: 'candidate' },
                { model: RecruitmentPosition, as: 'position' },
                { model: Client, as: 'client' }
            ]
        });

        return res.status(200).json({
            success: true,
            message: 'Interview updated successfully',
            data: populated
        });
    } catch (error) {
        console.error('Error updating interview:', error);
        return res.status(500).json({ success: false, message: 'Failed to update interview', error: error.message });
    }
};

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

        const ratings = [skills, attitude, knowledge, communication, behavior];
        for (const rating of ratings) {
            if (rating !== undefined && (rating < 1 || rating > 10)) {
                return res.status(400).json({ success: false, message: 'All ratings must be between 1 and 10' });
            }
        }

        const interview = await Interview.findByPk(id);
        if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

        const calculatedOverall = overallRating || Math.round((skills + attitude + knowledge + communication + behavior) / 5);

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

        const candidate = await Candidate.findByPk(interview.candidateId);
        if (candidate) {
            if (recommendation === 'Strongly Recommend' || recommendation === 'Recommend') {
                await candidate.update({ status: 'Shortlisted' });
            } else if (recommendation === 'Not Recommend' || recommendation === 'Strongly Not Recommend') {
                await candidate.update({ status: 'Rejected' });
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Interview feedback submitted successfully',
            data: interview
        });
    } catch (error) {
        console.error('Error submitting feedback:', error);
        return res.status(500).json({ success: false, message: 'Failed to submit feedback', error: error.message });
    }
};

const getInterviewFeedbackForm = async (req, res) => {
    try {
        const { id } = req.params;
        const interview = await Interview.findByPk(id, {
            include: [
                { model: Candidate, as: 'candidate' },
                { model: RecruitmentPosition, as: 'position' }
            ]
        });

        if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

        return res.status(200).json({
            success: true,
            data: {
                interviewId: interview.id,
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
        return res.status(500).json({ success: false, message: 'Failed to fetch feedback form', error: error.message });
    }
};

const cancelInterview = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const interview = await Interview.findByPk(id);
        if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

        interview.status = 'Cancelled';
        interview.notes = (interview.notes || '') + `\nCancelled: ${reason || 'No reason provided'}`;
        await interview.save();

        await Candidate.update(
            { status: 'Shortlisted' },
            { where: { id: interview.candidateId } }
        );

        return res.status(200).json({ success: true, message: 'Interview cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling interview:', error);
        return res.status(500).json({ success: false, message: 'Failed to cancel interview', error: error.message });
    }
};

const deleteInterview = async (req, res) => {
    try {
        const { id } = req.params;
        const interview = await Interview.findByPk(id);
        if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

        await interview.destroy();

        return res.status(200).json({ success: true, message: 'Interview deleted permanently' });
    } catch (error) {
        console.error('Error deleting interview:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete interview', error: error.message });
    }
};

const sendInterviewReminder = async (req, res) => {
    try {
        const { id } = req.params;
        const interview = await Interview.findByPk(id, {
            include: [
                { model: Candidate, as: 'candidate' },
                { model: RecruitmentPosition, as: 'position' }
            ]
        });

        if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

        const meetingLink = interview.meetingLink;

        try {
            await processInterviewReminder(interview);

            return res.status(200).json({ success: true, message: 'Reminder email sent successfully', emailSent: true });
        } catch (error) {
            const status = error?.response?.status;
            if (error?.code === 'BREVO_API_KEY_MISSING') {
                return res.status(200).json({
                    success: true,
                    message: 'Brevo email disabled: BREVO_API_KEY missing in .env.',
                    emailSent: false,
                    candidateEmail: interview?.candidate?.email || null,
                    provider: 'brevo',
                    providerStatus: null,
                    providerErrorMessage: 'BREVO_API_KEY_MISSING'
                });
            }

            const brevoMsg = status === 401
                ? 'Brevo SMTP unauthorized. Check BREVO_API_KEY in .env.'
                : 'Email sending failed.';

            // Don't fail the whole reminder flow if email provider is misconfigured.
            return res.status(200).json({
                success: true,
                message: brevoMsg,
                emailSent: false,
                candidateEmail: interview?.candidate?.email || null,
                provider: 'brevo',
                providerStatus: status || null,
                providerErrorMessage: error?.response?.data?.message || error?.message || 'Unknown error'
            });
        }
    } catch (error) {
        console.error('Error sending reminder:', error);
        return res.status(500).json({ success: false, message: 'Failed to send reminder', error: error.message });
    }
};

module.exports = {
    scheduleInterview,
    getInterviews,
    getInterviewById,
    getInterviewByToken,
    updateInterviewStatus,
    updateInterview,
    submitInterviewFeedback,
    getInterviewFeedbackForm,
    cancelInterview,
    deleteInterview,
    sendInterviewReminder,
    runAutomaticInterviewReminders
};
