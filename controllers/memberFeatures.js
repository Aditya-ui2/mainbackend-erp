const { DepartmentTeam, LeaveRequest, Attendance, DailyReport, Announcement, DeptDocument, Training, Payslip, DeptChat, DepartmentTask, DepartmentNote } = require('../models/sequelizeModels');
const { Op } = require('sequelize');
const { addNotification } = require('./notification');

// ============== MY PROFILE ==============
const getMyProfile = async (req, res) => {
    try {
        const member = await DepartmentTeam.findByPk(req.user.id, {
            attributes: { exclude: ['password'] }
        });
        if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
        res.json({ success: true, member });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateMyProfile = async (req, res) => {
    try {
        const { name, phone, avatar, skills } = req.body;
        const member = await DepartmentTeam.findByPk(req.user.id);
        if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
        await member.update({ name, phone, avatar, skills });
        const updated = await DepartmentTeam.findByPk(req.user.id, { attributes: { exclude: ['password'] } });
        res.json({ success: true, member: updated });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============== LEAVE REQUESTS ==============
const getLeaveRequests = async (req, res) => {
    try {
        const where = { memberId: req.user.id };
        if (req.query.status && req.query.status !== 'all') where.status = req.query.status;
        const leaves = await LeaveRequest.findAll({ where, order: [['createdAt', 'DESC']] });
        res.json({ success: true, leaves });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const applyLeave = async (req, res) => {
    try {
        const { leaveType, startDate, endDate, reason } = req.body;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        const leave = await LeaveRequest.create({
            memberId: req.user.id,
            memberName: req.user.name,
            department: req.user.department,
            leaveType, startDate, endDate, reason,
            totalDays: leaveType === 'Half Day' ? 0.5 : totalDays,
        });
        res.status(201).json({ success: true, leave, message: 'Leave applied!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getDeptLeaveRequests = async (req, res) => {
    try {
        const where = { department: req.query.department || req.user.department };
        if (req.query.status && req.query.status !== 'all') where.status = req.query.status;
        const leaves = await LeaveRequest.findAll({ where, order: [['createdAt', 'DESC']] });
        res.json({ success: true, leaves });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const approveRejectLeave = async (req, res) => {
    try {
        const { status, comment } = req.body;
        const leave = await LeaveRequest.findByPk(req.params.id);
        if (!leave) return res.status(404).json({ success: false, message: 'Leave not found' });
        await leave.update({ status, approvedBy: req.user.id, approverName: req.user.name, approverComment: comment });
        addNotification(leave.memberId, 'DepartmentTeam', `📋 Your leave (${leave.startDate} - ${leave.endDate}) has been ${status.toLowerCase()} by ${req.user.name}`, 'leave', 'high');
        res.json({ success: true, leave, message: `Leave ${status.toLowerCase()}` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============== ATTENDANCE ==============
const checkIn = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const existing = await Attendance.findOne({ where: { memberId: req.user.id, date: today } });
        if (existing) return res.status(400).json({ success: false, message: 'Already checked in today' });
        const attendance = await Attendance.create({
            memberId: req.user.id, memberName: req.user.name,
            department: req.user.department, date: today,
            checkIn: new Date(), status: 'Present',
        });
        res.status(201).json({ success: true, attendance, message: 'Checked in!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const checkOut = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const attendance = await Attendance.findOne({ where: { memberId: req.user.id, date: today } });
        if (!attendance) return res.status(404).json({ success: false, message: 'No check-in found today' });
        if (attendance.checkOut) return res.status(400).json({ success: false, message: 'Already checked out' });
        const workHours = ((new Date() - new Date(attendance.checkIn)) / (1000 * 60 * 60)).toFixed(2);
        await attendance.update({ checkOut: new Date(), workHours: parseFloat(workHours) });
        res.json({ success: true, attendance, message: `Checked out! (${workHours}h)` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getMyAttendance = async (req, res) => {
    try {
        const where = { memberId: req.user.id };
        if (req.query.month && req.query.year) {
            const startDate = `${req.query.year}-${req.query.month.padStart(2, '0')}-01`;
            const endDate = `${req.query.year}-${req.query.month.padStart(2, '0')}-31`;
            where.date = { [Op.between]: [startDate, endDate] };
        }
        const records = await Attendance.findAll({ where, order: [['date', 'DESC']] });
        res.json({ success: true, records });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getDeptAttendance = async (req, res) => {
    try {
        const where = { department: req.query.department || req.user.department };
        if (req.query.date) where.date = req.query.date;
        else where.date = new Date().toISOString().split('T')[0];
        const records = await Attendance.findAll({ where, order: [['checkIn', 'DESC']] });
        res.json({ success: true, records });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============== PERFORMANCE STATS ==============
const getPerformanceStats = async (req, res) => {
    try {
        const memberId = req.user.id;
        const member = await DepartmentTeam.findByPk(memberId, { attributes: { exclude: ['password'] } });
        const tasks = await DepartmentTask.findAll({ where: { assignedTo: memberId } });
        const completed = tasks.filter(t => t.status === 'Completed');
        const overdue = tasks.filter(t => t.status === 'Overdue');
        const onTime = completed.filter(t => t.completedAt && t.dueDate && new Date(t.completedAt) <= new Date(t.dueDate));

        // Attendance this month
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;
        const attendances = await Attendance.findAll({
            where: { memberId, date: { [Op.between]: [monthStart, monthEnd] } }
        });
        const presentDays = attendances.filter(a => a.status === 'Present' || a.status === 'WFH').length;
        const avgWorkHours = attendances.length ? (attendances.reduce((s, a) => s + (a.workHours || 0), 0) / attendances.length).toFixed(1) : 0;

        // Daily reports this month
        const reports = await DailyReport.findAll({
            where: { memberId, date: { [Op.between]: [monthStart, monthEnd] } }
        });

        // Current streak (consecutive days with completed tasks or reports)
        let streak = 0;
        const today = new Date();
        for (let i = 0; i < 60; i++) {
            const d = new Date(today); d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const hasReport = reports.some(r => r.date === dateStr);
            const hasAttendance = attendances.some(a => a.date === dateStr);
            if (hasReport || hasAttendance) streak++;
            else if (i > 0) break;
        }

        res.json({
            success: true,
            stats: {
                totalTasks: tasks.length,
                completedTasks: completed.length,
                overdueTasks: overdue.length,
                pendingTasks: tasks.filter(t => t.status === 'Pending').length,
                inProgressTasks: tasks.filter(t => t.status === 'In Progress').length,
                onTimeRate: completed.length ? Math.round((onTime.length / completed.length) * 100) : 0,
                presentDays,
                avgWorkHours: parseFloat(avgWorkHours),
                reportsSubmitted: reports.length,
                streak,
                joinDate: member?.joinDate,
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============== DAILY REPORTS ==============
const submitDailyReport = async (req, res) => {
    try {
        const {
            summary, tasksCompleted, tasksPlanned, blockers, mood,
            checkInTime, checkOutTime, workHours,
            callsCount, profilesVisited, profilesShared,
            candidatesContacted, interviewsArranged
        } = req.body;
        const today = new Date().toISOString().split('T')[0];
        const existing = await DailyReport.findOne({ where: { memberId: req.user.id, date: today } });

        const reportData = {
            summary, tasksCompleted, tasksPlanned, blockers, mood,
            checkInTime: checkInTime || null,
            checkOutTime: checkOutTime || null,
            workHours: parseFloat(workHours) || 0,
            callsCount: parseInt(callsCount) || 0,
            profilesVisited: parseInt(profilesVisited) || 0,
            profilesShared: parseInt(profilesShared) || 0,
            candidatesContacted: parseInt(candidatesContacted) || 0,
            interviewsArranged: parseInt(interviewsArranged) || 0,
        };
        
        let report;
        let message;
        
        if (existing) {
            await existing.update(reportData);
            report = existing;
            message = 'Report updated!';
        } else {
            report = await DailyReport.create({
                memberId: req.user.id, memberName: req.user.name,
                department: req.user.department, date: today,
                ...reportData,
            });
            message = 'Report submitted!';
        }

        // Notify Sachin (Recruitment Head)
        const sachinId = 'b330b023-9bf1-43be-acb0-a2b6e80f6cfe';
        try {
            await addNotification(
                sachinId,
                'DepartmentTeam',
                `📋 Daily Report: ${req.user.name} submitted their report for ${today}. Summary: ${summary.substring(0, 50)}${summary.length > 50 ? '...' : ''}`,
                'general',
                'medium'
            );
        } catch (notifyError) {
            console.error('Failed to notify header:', notifyError);
        }

        res.status(existing ? 200 : 201).json({ success: true, report, message });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getMyReports = async (req, res) => {
    try {
        const reports = await DailyReport.findAll({
            where: { memberId: req.user.id },
            order: [['date', 'DESC']],
            limit: 30,
        });
        res.json({ success: true, reports });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getDeptReports = async (req, res) => {
    try {
        const where = { department: req.query.department || req.user.department };
        if (req.query.date) where.date = req.query.date;
        const reports = await DailyReport.findAll({ where, order: [['date', 'DESC']], limit: 50 });
        res.json({ success: true, reports });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /department/mis-reports — Head view: all KAM MIS reports with filters
const getMISReports = async (req, res) => {
    try {
        const { date, memberId, startDate, endDate } = req.query;
        const department = req.query.department || req.user.department || 'HR Recruitment';
        const where = { department };

        if (date) {
            where.date = date;
        } else if (startDate && endDate) {
            const { Op } = require('sequelize');
            where.date = { [Op.between]: [startDate, endDate] };
        } else {
            // Default: last 30 days
            const { Op } = require('sequelize');
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            where.date = { [Op.gte]: thirtyDaysAgo.toISOString().split('T')[0] };
        }
        if (memberId) where.memberId = memberId;

        const reports = await DailyReport.findAll({
            where,
            order: [['date', 'DESC'], ['memberName', 'ASC']],
            limit: 200,
        });
        res.json({ success: true, reports });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /department/daily-report/:id/comment — Head can add a comment
const addHeadComment = async (req, res) => {
    try {
        const { comment } = req.body;
        const report = await DailyReport.findByPk(req.params.id);
        if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
        await report.update({
            headComment: comment,
            headCommentBy: req.user.name,
            headCommentAt: new Date(),
        });
        res.json({ success: true, message: 'Comment added', report });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============== ANNOUNCEMENTS ==============
const getAnnouncements = async (req, res) => {
    try {
        const announcements = await Announcement.findAll({
            where: { department: req.query.department || req.user.department },
            order: [['pinned', 'DESC'], ['createdAt', 'DESC']],
            limit: 30,
        });
        res.json({ success: true, announcements });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const createAnnouncement = async (req, res) => {
    try {
        const { title, content, priority, pinned, expiresAt } = req.body;
        const announcement = await Announcement.create({
            department: req.body.department || req.user.department,
            title, content, priority, pinned, expiresAt,
            postedBy: req.user.id, postedByName: req.user.name,
        });
        res.status(201).json({ success: true, announcement, message: 'Announcement posted!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteAnnouncement = async (req, res) => {
    try {
        const ann = await Announcement.findByPk(req.params.id);
        if (!ann) return res.status(404).json({ success: false, message: 'Not found' });
        await ann.destroy();
        res.json({ success: true, message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============== DOCUMENTS ==============
const getDocuments = async (req, res) => {
    try {
        const where = { department: req.query.department || req.user.department };
        if (req.query.category && req.query.category !== 'all') where.category = req.query.category;
        const documents = await DeptDocument.findAll({ where, order: [['createdAt', 'DESC']] });
        res.json({ success: true, documents });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const uploadDocument = async (req, res) => {
    try {
        const { name, description, fileUrl, fileType, fileSize, category } = req.body;
        const doc = await DeptDocument.create({
            department: req.body.department || req.user.department,
            name, description, fileUrl, fileType, fileSize, category,
            uploadedBy: req.user.id, uploadedByName: req.user.name,
        });
        res.status(201).json({ success: true, document: doc, message: 'Document uploaded!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteDocument = async (req, res) => {
    try {
        const doc = await DeptDocument.findByPk(req.params.id);
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        await doc.destroy();
        res.json({ success: true, message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============== TRAINING ==============
const getMyTrainings = async (req, res) => {
    try {
        const trainings = await Training.findAll({
            where: { memberId: req.user.id },
            order: [['createdAt', 'DESC']],
        });
        res.json({ success: true, trainings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateTraining = async (req, res) => {
    try {
        const training = await Training.findByPk(req.params.id);
        if (!training) return res.status(404).json({ success: false, message: 'Not found' });
        await training.update(req.body);
        res.json({ success: true, training, message: 'Training updated!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const assignTraining = async (req, res) => {
    try {
        const { memberId, memberName, title, description, category, startDate } = req.body;
        const training = await Training.create({
            memberId, memberName,
            department: req.body.department || req.user.department,
            title, description, category, startDate,
            assignedBy: req.user.id, assignedByName: req.user.name,
        });
        addNotification(memberId, 'DepartmentTeam', `📚 New training assigned: "${title}"`, 'general', 'medium');
        res.status(201).json({ success: true, training, message: 'Training assigned!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============== PAYSLIPS ==============
const getMyPayslips = async (req, res) => {
    try {
        const payslips = await Payslip.findAll({
            where: { memberId: req.user.id },
            order: [['year', 'DESC'], ['month', 'DESC']],
        });
        res.json({ success: true, payslips });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const generatePayslip = async (req, res) => {
    try {
        const { memberId, memberName, month, year, basicSalary, hra, otherAllowances, deductions } = req.body;
        const netSalary = (basicSalary || 0) + (hra || 0) + (otherAllowances || 0) - (deductions || 0);
        const payslip = await Payslip.create({
            memberId, memberName, month, year,
            department: req.body.department || req.user.department,
            basicSalary, hra, otherAllowances, deductions, netSalary,
        });
        addNotification(memberId, 'DepartmentTeam', `💰 Payslip for ${month} ${year} generated`, 'general', 'medium');
        res.status(201).json({ success: true, payslip, message: 'Payslip generated!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============== TEAM CHAT ==============
const getChatMessages = async (req, res) => {
    try {
        const messages = await DeptChat.findAll({
            where: { department: req.query.department || req.user.department },
            order: [['createdAt', 'ASC']],
            limit: 100,
        });
        res.json({ success: true, messages });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const sendChatMessage = async (req, res) => {
    try {
        const { message, messageType, fileUrl, replyTo } = req.body;
        const msg = await DeptChat.create({
            department: req.user.department,
            senderId: req.user.id, senderName: req.user.name,
            senderRole: req.user.role || req.user.userType,
            message, messageType, fileUrl, replyTo,
        });
        res.status(201).json({ success: true, message: msg });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============== CALENDAR (aggregates tasks + leave + attendance) ==============
const getCalendarEvents = async (req, res) => {
    try {
        const memberId = req.user.id;
        const { month, year } = req.query;
        const startDate = `${year}-${month.padStart(2, '0')}-01`;
        const endDate = `${year}-${month.padStart(2, '0')}-31`;

        const [tasks, leaves, attendances] = await Promise.all([
            DepartmentTask.findAll({
                where: { assignedTo: memberId, dueDate: { [Op.between]: [startDate, endDate] } }
            }),
            LeaveRequest.findAll({
                where: { memberId, [Op.or]: [{ startDate: { [Op.between]: [startDate, endDate] } }, { endDate: { [Op.between]: [startDate, endDate] } }] }
            }),
            Attendance.findAll({
                where: { memberId, date: { [Op.between]: [startDate, endDate] } }
            }),
        ]);

        const events = [
            ...tasks.map(t => ({ id: t.id, type: 'task', title: t.title, date: t.dueDate, status: t.status, priority: t.priority })),
            ...leaves.map(l => ({ id: l.id, type: 'leave', title: `${l.leaveType} Leave`, date: l.startDate, endDate: l.endDate, status: l.status })),
            ...attendances.map(a => ({ id: a.id, type: 'attendance', title: a.status, date: a.date, checkIn: a.checkIn, checkOut: a.checkOut, workHours: a.workHours })),
        ];
        res.json({ success: true, events });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============== NOTES ==============
const getNotes = async (req, res) => {
    try {
        const { category, search, limit = 100 } = req.query;
        const department = req.query.department || req.user.department;

        const where = { department };
        if (category && category !== 'all') where.category = category;
        if (search) {
            where[Op.or] = [
                { title: { [Op.iLike]: `%${search}%` } },
                { content: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const notes = await DepartmentNote.findAll({
            where,
            order: [['updatedAt', 'DESC']],
            limit: Math.min(parseInt(limit, 10) || 100, 300)
        });

        res.json({ success: true, notes });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const createNote = async (req, res) => {
    try {
        const { title, content, category, priority } = req.body;
        if (!title || !content) {
            return res.status(400).json({ success: false, message: 'Title and content are required' });
        }

        const note = await DepartmentNote.create({
            department: req.body.department || req.user.department,
            title,
            content,
            category: category || 'General',
            priority: priority || 'normal',
            createdById: req.user.id,
            createdByName: req.user.name
        });

        res.status(201).json({ success: true, note, message: 'Note created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateNote = async (req, res) => {
    try {
        const note = await DepartmentNote.findByPk(req.params.id);
        if (!note) return res.status(404).json({ success: false, message: 'Note not found' });

        if (note.department !== (req.user.department || note.department)) {
            return res.status(403).json({ success: false, message: 'Not allowed to edit this note' });
        }

        const { title, content, category, priority } = req.body;
        await note.update({
            title: title ?? note.title,
            content: content ?? note.content,
            category: category ?? note.category,
            priority: priority ?? note.priority,
        });

        res.json({ success: true, note, message: 'Note updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteNote = async (req, res) => {
    try {
        const note = await DepartmentNote.findByPk(req.params.id);
        if (!note) return res.status(404).json({ success: false, message: 'Note not found' });

        if (note.department !== (req.user.department || note.department)) {
            return res.status(403).json({ success: false, message: 'Not allowed to delete this note' });
        }

        await note.destroy();
        res.json({ success: true, message: 'Note deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getMyProfile, updateMyProfile,
    getLeaveRequests, applyLeave, getDeptLeaveRequests, approveRejectLeave,
    checkIn, checkOut, getMyAttendance, getDeptAttendance,
    getPerformanceStats,
    submitDailyReport, getMyReports, getDeptReports, getMISReports, addHeadComment,
    getAnnouncements, createAnnouncement, deleteAnnouncement,
    getDocuments, uploadDocument, deleteDocument,
    getMyTrainings, updateTraining, assignTraining,
    getMyPayslips, generatePayslip,
    getChatMessages, sendChatMessage,
    getCalendarEvents,
    getNotes, createNote, updateNote, deleteNote,
};
