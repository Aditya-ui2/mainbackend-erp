const { Op, fn, col, literal } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { TeamLeader, Client, RecruitmentPosition, Candidate, Interview, OfferTemplate, DepartmentTask, ResumeBank, DepartmentTeam, DepartmentNote, SharePointCandidate } = require('../models/sequelizeModels');
const fs = require('fs');
const path = require('path');
const sendEmail = require('../utils/emailService');
const { hashPassword, comparePasswords } = require('../utils/bcryptUtils');
const { generateToken, generateRefreshToken } = require('../utils/jwtUtils');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const escapeLike = (value = '') => String(value).replace(/[\\%_]/g, '\\$&');

const buildUploadedCandidateEmail = (fileName = '') => {
    const baseName = String(fileName)
        .replace(/\.[^.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.+|\.+$/g, '')
        .slice(0, 40) || 'candidate';

    return `${baseName}.${Date.now()}@resume-upload.local`;
};

const normalizePositionType = (value = '') => {
    if (value === 'Remote') return 'Full-time';
    return ['Full-time', 'Part-time', 'Contract', 'Internship'].includes(value) ? value : 'Full-time';
};

const normalizePositionStatus = (value = '', priority = '') => {
    if (['Open', 'Closed', 'Hold'].includes(value)) return value;
    if (priority === 'Urgent') return 'Open';
    return 'Open';
};

const buildOfferEmailHtml = ({ candidateName, position, client, offeredCTC, joiningDate, expiryDate }) => `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin-bottom: 12px; color: #0f4c81;">Offer Letter</h2>
        <p>Dear ${candidateName || 'Candidate'},</p>
        <p>Your offer details have been shared by the recruitment team.</p>
        <ul>
            <li><strong>Position:</strong> ${position || 'N/A'}</li>
            <li><strong>Client:</strong> ${client || 'Internal'}</li>
            <li><strong>Offered CTC:</strong> ${offeredCTC || 'N/A'}</li>
            <li><strong>Joining Date:</strong> ${joiningDate || 'N/A'}</li>
            <li><strong>Offer Valid Till:</strong> ${expiryDate || 'N/A'}</li>
        </ul>
        <p>Please review the attached offer letter and revert in case of any questions.</p>
        <p>Regards,<br/>Mabicons Recruitment Team</p>
    </div>
`;

const safeJsonParse = (value, fallback) => {
    try {
        if (typeof value !== 'string') return fallback;
        const trimmed = value.trim();
        if (!trimmed) return fallback;
        return JSON.parse(trimmed);
    } catch (_) {
        return fallback;
    }
};

const upsertOfferTemplate = async (req, res) => {
    console.log('--- UPSERT OFFER TEMPLATE REQUEST ---');
    console.log('Body:', req.body);
    console.log('File:', req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
    } : 'No file uploaded');

    try {
        const requesterRole = String(req.user?.role || req.user?.userType || '').toLowerCase();
        if (requesterRole.includes('client') || requesterRole.includes('customer')) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { clientId, clientName, fieldMap } = req.body;

        let resolvedClientId = clientId;
        if (!resolvedClientId && clientName) {
            const foundClient = await Client.findOne({
                where: {
                    [Op.or]: [
                        { companyName: { [Op.iLike]: String(clientName).trim() } },
                        { name: { [Op.iLike]: String(clientName).trim() } }
                    ]
                },
                attributes: ['id']
            });
            resolvedClientId = foundClient?.id || null;
        }

        if (!resolvedClientId) {
            return res.status(400).json({ success: false, message: 'clientId or clientName is required' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Template PDF file is required' });
        }

        if (req.file.mimetype !== 'application/pdf') {
            return res.status(400).json({ success: false, message: 'Only PDF templates are supported' });
        }

        const baseDir = path.join(__dirname, '..', 'uploads', 'offer-templates', resolvedClientId);
        fs.mkdirSync(baseDir, { recursive: true });
        const sanitizedFileName = `${Date.now()}-${String(req.file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const targetPath = path.join(baseDir, sanitizedFileName);
        fs.writeFileSync(targetPath, req.file.buffer);

        const parsedFieldMap = typeof fieldMap === 'object' ? fieldMap : safeJsonParse(fieldMap, {});

        const record = await OfferTemplate.create({
            clientId: resolvedClientId,
            templateUrl: `/uploads/offer-templates/${resolvedClientId}/${sanitizedFileName}`,
            templateFileName: req.file.originalname,
            fieldMap: parsedFieldMap
        });

        return res.status(201).json({ success: true, data: record });
    } catch (error) {
        console.error('Error saving offer template:', error);
        return res.status(500).json({ success: false, message: 'Failed to save offer template', error: error.message });
    }
};

const getOfferTemplate = async (req, res) => {
    try {
        const requesterRole = String(req.user?.role || req.user?.userType || '').toLowerCase();
        if (requesterRole.includes('client') || requesterRole.includes('customer')) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { clientId, clientName } = req.query;

        let resolvedClientId = clientId;
        if (!resolvedClientId && clientName) {
            const foundClient = await Client.findOne({
                where: {
                    [Op.or]: [
                        { companyName: { [Op.iLike]: String(clientName).trim() } },
                        { name: { [Op.iLike]: String(clientName).trim() } }
                    ]
                },
                attributes: ['id']
            });
            resolvedClientId = foundClient?.id || null;
        }

        if (!resolvedClientId) {
            return res.status(400).json({ success: false, message: 'clientId or clientName is required' });
        }

        const record = await OfferTemplate.findOne({
            where: { clientId: resolvedClientId, status: { [Op.ne]: 'Deleted' } },
            order: [['createdAt', 'DESC']]
        });

        if (!record) {
            return res.status(200).json({ success: true, message: 'No offer template found for this client', data: null });
        }

        return res.status(200).json({ success: true, data: record });
    } catch (error) {
        console.error('Error fetching offer template:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch offer template', error: error.message });
    }
};

const wrapTextToWidth = ({ text, font, fontSize, maxWidth }) => {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        const width = font.widthOfTextAtSize(next, fontSize);
        if (width <= maxWidth) {
            current = next;
            continue;
        }
        if (current) lines.push(current);
        current = word;
    }
    if (current) lines.push(current);
    return lines;
};

const resolvePositionOwnership = async ({ departmentTeamId, teamLeaderId, userId }) => {
    let resolvedDepartmentTeamId = null;
    let resolvedTeamLeaderId = null;

    const candidateDepartmentTeamId = departmentTeamId || userId;
    if (candidateDepartmentTeamId) {
        const departmentMember = await DepartmentTeam.findByPk(candidateDepartmentTeamId, {
            attributes: ['id'],
            raw: true
        });
        if (departmentMember?.id) {
            resolvedDepartmentTeamId = departmentMember.id;
        }
    }

    if (teamLeaderId) {
        const teamLeader = await TeamLeader.findByPk(teamLeaderId, {
            attributes: ['id'],
            raw: true
        });
        if (teamLeader?.id) {
            resolvedTeamLeaderId = teamLeader.id;
        }
    }

    if (!resolvedDepartmentTeamId && userId) {
        const currentTeamLeader = await TeamLeader.findByPk(userId, {
            attributes: ['id'],
            raw: true
        });
        if (currentTeamLeader?.id) {
            resolvedTeamLeaderId = currentTeamLeader.id;
        }
    }

    return {
        departmentTeamId: resolvedDepartmentTeamId,
        teamLeaderId: resolvedTeamLeaderId
    };
};

const buildInterviewMatchers = (kam) => {
    const rawName = kam.name || '';
    const emailPrefix = (kam.email || '').split('@')[0];
    const nameParts = rawName
        .replace(/\(.*?\)/g, ' ')
        .split(/\s+/)
        .map(part => part.trim())
        .filter(Boolean);

    const lookupTerms = [...new Set([emailPrefix, ...nameParts].filter(term => term && term.length >= 3))];

    return [
        { interviewerId: kam.id },
        ...(kam.email ? [{ interviewerEmail: kam.email }] : []),
        ...lookupTerms.map(term => ({
            interviewerName: { [Op.iLike]: `%${escapeLike(term)}%` }
        }))
    ];
};

const buildDateRangeFromQuery = ({ year, month, date, startDate, endDate } = {}) => {
    if (startDate || endDate) {
        const parsedStart = startDate ? new Date(startDate) : new Date(endDate);
        const parsedEnd = endDate ? new Date(endDate) : new Date(startDate);

        if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
            return null;
        }

        const minDate = parsedStart <= parsedEnd ? parsedStart : parsedEnd;
        const maxDate = parsedStart <= parsedEnd ? parsedEnd : parsedStart;

        const normalizedStart = new Date(minDate);
        normalizedStart.setHours(0, 0, 0, 0);

        const normalizedEnd = new Date(maxDate);
        normalizedEnd.setHours(0, 0, 0, 0);
        normalizedEnd.setDate(normalizedEnd.getDate() + 1);

        return { startDate: normalizedStart, endDate: normalizedEnd };
    }

    if (date) {
        const startDate = new Date(date);
        if (Number.isNaN(startDate.getTime())) return null;

        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        return { startDate, endDate };
    }

    const yearNumber = Number(year);
    if (!Number.isInteger(yearNumber) || yearNumber < 2000) {
        return null;
    }

    if (month !== undefined) {
        const monthNumber = Number(month);
        if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
            return null;
        }

        const startDate = new Date(yearNumber, monthNumber - 1, 1);
        const endDate = new Date(yearNumber, monthNumber, 1);
        return { startDate, endDate };
    }

    return {
        startDate: new Date(yearNumber, 0, 1),
        endDate: new Date(yearNumber + 1, 0, 1)
    };
};

const buildDateFieldFilter = (dateRange, fieldName = 'createdAt') => {
    if (!dateRange) return {};

    return {
        [fieldName]: {
            [Op.gte]: dateRange.startDate,
            [Op.lt]: dateRange.endDate
        }
    };
};

const normalizeOfferStatus = (value = '') => {
    const allowed = ['Draft', 'Pending Approval', 'Sent', 'Negotiating', 'Accepted', 'Rejected', 'Expired'];
    return allowed.includes(value) ? value : 'Draft';
};

// Get all KAMs (DepartmentTeam members) with their recruitment positions and stats
const getRecruitmentClients = async (req, res) => {
    try {
        const { clientId } = req.query;
        const where = clientId ? { id: clientId } : {};

        const clients = await Client.findAll({
            where,
            include: [{
                model: RecruitmentPosition,
                as: 'recruitmentPositions',
                attributes: [],
                required: true
            }],
            attributes: ['id', 'name', 'companyName'],
            group: ['Client.id'],
            order: [[literal('COALESCE("companyName", "name")'), 'ASC']]
        });

        res.status(200).json({ success: true, data: clients });
    } catch (error) {
        console.error('Error fetching recruitment clients:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch clients' });
    }
};

const getKamsWithRecruitment = async (req, res) => {
    try {
        const { client: clientId } = req.query;
        const dateRange = buildDateRangeFromQuery(req.query);
        const positionDateFilter = buildDateFieldFilter(dateRange, 'createdAt');
        const candidateDateFilter = buildDateFieldFilter(dateRange, 'createdAt');
        const interviewDateFilter = buildDateFieldFilter(dateRange, 'interviewDate');
        const activityDateFilter = buildDateFieldFilter(dateRange, 'updatedAt');

        // Fetch all members of the HR Recruitment department
        const ashwinId = '28e15eed-8297-440a-b8cd-976be26bc048';
        const excludedRecruitmentIds = [ashwinId];
        if (req.user?.id) excludedRecruitmentIds.push(req.user.id);

        const kams = await DepartmentTeam.findAll({
            where: {
                department: 'HR Recruitment',
                id: { [Op.notIn]: excludedRecruitmentIds }
            },
            attributes: ['id', 'name', 'email', 'phone', 'role', 'status'],
        });

        // 7-day window for "This Week Hires" - but respect dashboard filter if provided
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const hiresDateFilter = dateRange
            ? {
                updatedAt: {
                    [Op.gte]: dateRange.startDate,
                    [Op.lt]: dateRange.endDate
                }
            }
            : {}; // If no dateRange (All Time), don't filter by date

        const kamsWithStats = await Promise.all(kams.map(async (kam) => {
            try {
                const k = kam.toJSON();
                const interviewOr = buildInterviewMatchers(k);
                
                const ownedPositions = await RecruitmentPosition.findAll({
                    where: {
                        [Op.and]: [
                            {
                                [Op.or]: [
                                    { departmentTeamId: kam.id },
                                    { teamLeaderId: kam.id }
                                ]
                            },
                            ...(dateRange ? [positionDateFilter] : []),
                            ...(clientId ? [{ clientId }] : [])
                        ]
                    },
                    attributes: ['id', 'title', 'status'],
                    raw: true
                });

                const ownedPositionCount = ownedPositions.filter(position => position.status === 'Open').length;

                const [totalCandidates, interviews, hires, recentActivityCandidate, profilesShared, callsDone, pendingTasks, completedTasks] = await Promise.all([
                    Candidate.count({
                        where: { 
                            addedById: kam.id, 
                            ...candidateDateFilter,
                            ...(clientId ? { clientId } : {})
                        }
                    }),
                    Interview.count({
                        where: {
                            [Op.and]: [
                                { [Op.or]: interviewOr },
                                { status: { [Op.ne]: 'Cancelled' } },
                                ...(dateRange ? [interviewDateFilter] : []),
                                ...(clientId ? [{ clientId }] : [])
                            ]
                        }
                    }),
                    Candidate.count({
                        where: {
                            addedById: kam.id,
                            [Op.or]: [
                                { status: 'Selected' },
                                { stage: 'Joined' }
                            ],
                            ...hiresDateFilter,
                            ...(clientId ? { clientId } : {})
                        }
                    }),
                    Candidate.findAll({
                        where: { 
                            addedById: kam.id, 
                            ...activityDateFilter,
                            ...(clientId ? { clientId } : {})
                        },
                        include: [{ 
                            model: RecruitmentPosition, 
                            as: 'position', 
                            attributes: ['title'],
                            required: false
                        }],
                        order: [['updatedAt', 'DESC']],
                        limit: 3,
                        raw: true,
                        nest: true
                    }),
                    Candidate.count({
                        where: { 
                            addedById: kam.id, 
                            status: { [Op.in]: ['Shared', 'Shortlisted', 'Interview', 'Selected'] },
                            ...candidateDateFilter,
                            ...(clientId ? { clientId } : {})
                        }
                    }),
                    Interview.count({
                        where: {
                            [Op.and]: [
                                { [Op.or]: interviewOr },
                                { status: { [Op.ne]: 'Cancelled' } },
                                ...(dateRange ? [interviewDateFilter] : []),
                                ...(clientId ? [{ clientId }] : []),
                                {
                                    [Op.or]: [
                                        { interviewType: 'Phone Screening' },
                                        { meetingType: 'Phone' }
                                    ]
                                }
                            ]
                        }
                    }),
                    DepartmentTask.count({
                        where: {
                            assignedTo: kam.id,
                            department: 'HR Recruitment',
                            status: { [Op.in]: ['Pending', 'In Progress', 'Overdue'] }
                        }
                    }),
                    DepartmentTask.count({
                        where: {
                            assignedTo: kam.id,
                            department: 'HR Recruitment',
                            status: 'Completed'
                        }
                    })
                ]);

                const activities = recentActivityCandidate.map(c => {
                    // Determine the action based on status/stage
                    let action = c.status || 'Active';
                    if (c.status === 'Submitted' && c.stage === 'Screening') action = 'Sourced';
                    if (c.status === 'Selected') action = 'Hired';

                    return {
                        action,
                        candidate: c.name,
                        position: c.position?.title || 'General Sourcing',
                        time: c.updatedAt
                    };
                });

                return {
                    ...k,
                    avatar: kam.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
                    stats: {
                        activePositions: ownedPositionCount,
                        candidatesPipeline: totalCandidates,
                        interviewsScheduled: interviews,
                        thisWeekHires: hires,
                        offersExtended: 0,
                        profilesShared,
                        callsDone,
                        pendingTasks,
                        completedTasks
                    },
                    recentActivity: activities.length > 0 ? activities : [{ action: 'No recent activity', candidate: '', time: 'N/A' }]
                };
            } catch (err) {
                console.error(`Error processing stats for KAM ${kam.id}:`, err.message);
                // Return basic info with zero stats as fallback
                return {
                    ...kam.toJSON(),
                    avatar: kam.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
                    stats: {
                        activePositions: 0,
                        candidatesPipeline: 0,
                        interviewsScheduled: 0,
                        thisWeekHires: 0,
                        offersExtended: 0,
                        profilesShared: 0,
                        callsDone: 0,
                        pendingTasks: 0,
                        completedTasks: 0
                    },
                    recentActivity: [{ action: 'Error loading activity', candidate: '', time: 'N/A' }]
                };
            }
        }));

        res.status(200).json({ success: true, data: kamsWithStats });
    } catch (error) {
        console.error('Error fetching KAMs with recruitment:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch KAM data', error: error.message });
    }
};

// Create a new recruitment position
const createRecruitmentPosition = async (req, res) => {
    try {
        const { title, description, location, type, salary, status, priority, openings, skills, experience, clientId, teamLeaderId, departmentTeamId, deadline } = req.body;
        
        // clientId can be null for internal positions

        const ownership = await resolvePositionOwnership({
            departmentTeamId,
            teamLeaderId,
            userId: req.user?.id
        });

        const position = await RecruitmentPosition.create({
            title,
            description,
            location: location || 'Remote',
            type: normalizePositionType(type),
            salary,
            status: normalizePositionStatus(status, priority),
            priority,
            openings,
            skills: skills || [],
            experience,
            clientId,
            teamLeaderId: ownership.teamLeaderId,
            departmentTeamId: ownership.departmentTeamId,
            postedByUserId: req.user?.id || null,
            postedByUserType: req.user?.userType || req.user?.role || null,
            postedByName: req.user?.name || null,
            postedByEmail: req.user?.email || null,
            deadline
        });

        // Notify Admin Sachin if posted by a client
        if (req.user?.userType?.toLowerCase().includes('client') || req.body.postedByClient) {
            const { addNotification } = require('./notification');
            const sachinId = '60de4380-0140-49ff-b26d-a8d06333af11';
            try {
                await addNotification(
                    sachinId,
                    'DepartmentTeam',
                    `🆕 New Job Posting: ${req.user?.name || 'A client'} has posted a new position "${title}" for ${req.body.client || 'their company'}.`,
                    'candidate',
                    'high'
                );
            } catch (notifyErr) {
                console.error('Failed to notify Admin Sachin:', notifyErr);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Position created successfully',
            data: {
                ...position.toJSON(),
                postedByName: req.user?.name || null,
                postedByEmail: req.user?.email || null
            }
        });
    } catch (error) {
        console.error('Error creating recruitment position:', error);
        res.status(500).json({ success: false, message: 'Failed to create position', error: error.message });
    }
};

// Update recruitment position
const updateRecruitmentPosition = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const position = await RecruitmentPosition.findByPk(id);
        if (!position) {
            return res.status(404).json({ success: false, message: 'Position not found' });
        }

        if (updates.clientId === "") {
            delete updates.clientId; // Or handle as null if allowed
        }

        if ('type' in updates) {
            updates.type = normalizePositionType(updates.type);
        }

        if ('status' in updates || 'priority' in updates) {
            updates.status = normalizePositionStatus(updates.status, updates.priority);
        }

        if ('location' in updates && !updates.location) {
            updates.location = 'Remote';
        }

        if ('departmentTeamId' in updates || 'teamLeaderId' in updates) {
            const ownership = await resolvePositionOwnership({
                departmentTeamId: updates.departmentTeamId,
                teamLeaderId: updates.teamLeaderId,
                userId: req.user?.id
            });
            updates.departmentTeamId = ownership.departmentTeamId;
            updates.teamLeaderId = ownership.teamLeaderId;
        }
        
        await position.update(updates);
        res.status(200).json({ success: true, message: 'Position updated successfully', data: position });
    } catch (error) {
        console.error('Error updating recruitment position:', error);
        res.status(500).json({ success: false, message: 'Failed to update position', error: error.message });
    }
};

// Add a candidate
const addCandidate = async (req, res) => {
    console.log('--- ADD CANDIDATE REQUEST ---');
    console.log('Body:', req.body);
    console.log('File:', req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
    } : 'No file uploaded');
    try {

        let { name, email, phone, positionId, clientId, skills, experience, currentSalary, expectedSalary, notes, location, noticePeriod, stage, pipelineStatus, rating, source, joiningDate, offeredCTC, status } = req.body;
        
        // --- EMERGENCY AUTO-FIX FOR REMOTE SERVERS ---
        try {
            // Attempt to drop the restrictive constraint on every attempt (non-blocking)
            await RecruitmentPosition.sequelize.query('ALTER TABLE candidates DROP CONSTRAINT IF EXISTS "candidates_addedById_fkey"').catch(() => {});
        } catch (dbErr) { /* Ignore */ }
        // ----------------------------------------------

        
        // Robustness: Handle empty or mock UUID fields
        const isUUID = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
        
        if (!isUUID(positionId)) positionId = null;
        if (!isUUID(clientId)) clientId = null;
        
        let addedById = req.user?.id;
        if (!isUUID(addedById)) {
            addedById = null;
        } else {
            // Safety check: Only assign if the user exists in DepartmentTeams due to strict DB constraints
            const userExists = await DepartmentTeam.findByPk(addedById);
            if (!userExists) {
                console.log('Skipping addedById assignment: User not in DepartmentTeams table');
                addedById = null;
            }
        }

        // Robustness: Handle skills (String/Array/JSON)
        let parsedSkills = [];
        try {
            if (Array.isArray(skills)) {
                parsedSkills = skills;
            } else if (typeof skills === 'string') {
                if (skills.startsWith('[') && skills.endsWith(']')) {
                    parsedSkills = JSON.parse(skills);
                } else if (skills.trim()) {
                    parsedSkills = skills.split(',').map(s => s.trim()).filter(Boolean);
                }
            }
        } catch (e) {
            console.error('Error parsing skills:', e);
            parsedSkills = [];
        }
        
        let cvUrl = req.body.cvUrl || null;
        let cvFileName = req.body.cvFileName || null;

        // Handle File Upload from Multer
        if (req.file) {
            const uploadDir = path.join(__dirname, '..', 'uploads', 'resumes');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const fileName = `${Date.now()}-${req.file.originalname}`;
            const filePath = path.join(uploadDir, fileName);
            
            fs.writeFileSync(filePath, req.file.buffer);
            
            cvUrl = `/uploads/resumes/${fileName}`;
            cvFileName = req.file.originalname;

            // Also add to Resume Bank
            try {
                const ext = cvFileName.split('.').pop().toLowerCase();
                const allowedTypes = ['pdf', 'doc', 'docx'];
                const fileType = allowedTypes.includes(ext) ? ext : 'pdf'; // Fallback to pdf for ENUM safety

                console.log('Attempting to sync with Resume Bank:', {
                    candidateName: name,
                    roleType: req.body.roleType || 'Uncategorized',
                    fileType: fileType
                });

                const bankEntry = await ResumeBank.create({
                    sharePointId: `local-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                    driveId: 'local',
                    fileName: cvFileName,
                    fileType: fileType,
                    fileSize: req.file.size,
                    roleType: req.body.roleType || 'Uncategorized',
                    candidateName: name || 'New Candidate',
                    email: email,
                    phone: phone,
                    experience: experience,
                    skills: parsedSkills,
                    currentLocation: location,
                    noticePeriod: noticePeriod,
                    currentSalary: currentSalary,
                    expectedSalary: expectedSalary,
                    webUrl: cvUrl
                });
                console.log('Successfully synced with Resume Bank, ID:', bankEntry.id);
            } catch (bankErr) {
                console.error('Failed to sync with Resume Bank Error details:', bankErr);
                fs.appendFileSync(path.join(__dirname, '..', 'resume_bank_sync_debug.log'), `[${new Date().toISOString()}] Error syncing candidate ${name}: ${bankErr.message}\n${bankErr.stack}\n---\n`);
                // Non-blocking error, we still want to create the candidate
            }
        }

        let candidate;
        try {
            candidate = await Candidate.create({
                name, email, phone, 
                positionId, 
                clientId, 
                cvUrl, cvFileName,
                skills: parsedSkills,
                experience, currentSalary, expectedSalary, notes, location, noticePeriod,
                stage: stage || 'Screening', pipelineStatus: pipelineStatus || 'pending',
                rating: rating || 0, source, status: status || 'Submitted',
                addedById, joiningDate, offeredCTC
            });
        } catch (fkError) {
            if (fkError.name === 'SequelizeForeignKeyConstraintError' && fkError.parent?.constraint === 'candidates_addedById_fkey') {
                console.log('Retrying candidate creation without addedById due to FK constraint...');
                candidate = await Candidate.create({
                    name, email, phone, 
                    positionId, 
                    clientId, 
                    cvUrl, cvFileName,
                    skills: parsedSkills,
                    experience, currentSalary, expectedSalary, notes, location, noticePeriod,
                    stage: stage || 'Screening', pipelineStatus: pipelineStatus || 'pending',
                    rating: rating || 0, source, status: status || 'Submitted',
                    joiningDate, offeredCTC
                    // notice: addedById is omitted here
                });
            } else {
                throw fkError; // Re-throw if it's a different error
            }
        }

        res.status(201).json({
            success: true,
            message: 'Candidate added successfully',
            data: candidate
        });
    } catch (error) {
        console.error('Error in addCandidate:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error while adding candidate',
            error: error.message 
        });
    }
};

// Update candidate status (share CV, shortlist, etc.)
const updateCandidateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, stage, pipelineStatus, rejectionReason, interviewDate, notes, rating } = req.body;

        const candidate = await Candidate.findByPk(id);
        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        const { clientId } = req.body;
        if (clientId && candidate.clientId !== clientId) {
            return res.status(403).json({ success: false, message: 'Access denied. You can only update candidates belonging to your company.' });
        }

        const updateData = {};
        if (status) {
            updateData.status = status;
            if (status === 'Shared') updateData.sharedAt = new Date();
            else if (status === 'Shortlisted') updateData.shortlistedAt = new Date();
            else if (status === 'Interview' && interviewDate) updateData.interviewDate = interviewDate;
        }
        if (stage) updateData.stage = stage;
        if (pipelineStatus) updateData.pipelineStatus = pipelineStatus;
        if (rejectionReason) updateData.rejectionReason = rejectionReason;
        if (notes) updateData.notes = notes;
        if (rating !== undefined) updateData.rating = rating;
        if (req.body.bgvStatus) updateData.bgvStatus = req.body.bgvStatus;

        await candidate.update(updateData);

        // Reload with position info
        await candidate.reload({ include: [{ model: RecruitmentPosition, as: 'position', attributes: ['title'] }] });

        // If selected, update filled count on position
        if (status === 'Selected') {
            await RecruitmentPosition.increment('filled', { where: { id: candidate.positionId } });
        }

        res.status(200).json({ success: true, message: 'Candidate status updated', data: candidate });
    } catch (error) {
        console.error('Error updating candidate status:', error);
        res.status(500).json({ success: false, message: 'Failed to update candidate', error: error.message });
    }
};


// Update candidate profile
const updateCandidate = async (req, res) => {
    console.log('--- UPDATE CANDIDATE REQUEST ---');
    console.log('ID:', req.params.id);
    console.log('BODY:', JSON.stringify(req.body, null, 2));
    try {
        const { id } = req.params;
        let { name, email, phone, positionId, clientId, skills, experience, currentSalary, expectedSalary, notes, location, noticePeriod, stage, pipelineStatus, rating, source } = req.body;

        const candidate = await Candidate.findByPk(id);
        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        // Robustness: Handle empty or mock UUID fields
        const isUUID = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
        
        if (positionId !== undefined && !isUUID(positionId)) positionId = null;
        if (clientId !== undefined && !isUUID(clientId)) clientId = null;

        // Robustness: Handle skills (String/Array/JSON)
        let parsedSkills = undefined;
        if (skills !== undefined) {
            try {
                if (Array.isArray(skills)) {
                    parsedSkills = skills;
                } else if (typeof skills === 'string') {
                    if (skills.startsWith('[') && skills.endsWith(']')) {
                        parsedSkills = JSON.parse(skills);
                    } else if (skills.trim()) {
                        parsedSkills = skills.split(',').map(s => s.trim()).filter(Boolean);
                    } else {
                        parsedSkills = [];
                    }
                }
            } catch (e) {
                console.error('Error parsing skills during update:', e);
                parsedSkills = [];
            }
        }

        const updateData = {
            name, email, phone, positionId, clientId,
            experience, currentSalary, expectedSalary, notes, location, noticePeriod,
            stage, pipelineStatus, rating, source,
            bgvStatus: req.body.bgvStatus
        };
        
        if (parsedSkills !== undefined) updateData.skills = parsedSkills;

        // Remove undefined fields to not overwrite with null unless intentional
        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) {
                delete updateData[key];
            }
        });

        await candidate.update(updateData);

        // Reload with full info for frontend state synchronization
        await candidate.reload({ 
            include: [
                { model: RecruitmentPosition, as: 'position', attributes: ['title'] },
                { model: Client, as: 'client', attributes: ['name', 'companyName'] }
            ] 
        });

        console.log('--- UPDATE SUCCESSFUL ---');
        return res.status(200).json({ 
            success: true, 
            message: 'Candidate updated successfully', 
            data: candidate 
        });
    } catch (error) {
        console.error('--- UPDATE FAILED ---', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to update candidate', 
            error: error.message 
        });
    }
};

// Get candidates for a position
const getCandidatesByPosition = async (req, res) => {
    try {
        const { positionId } = req.params;
        const { status, clientId } = req.query;

        const where = { positionId };
        if (status) where.status = status;
        if (clientId) where.clientId = clientId;

        const candidates = await Candidate.findAll({
            where,
            order: [['createdAt', 'DESC']],
        });

        res.status(200).json({ success: true, data: candidates });
    } catch (error) {
        console.error('Error fetching candidates:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch candidates', error: error.message });
    }
};

// Get recruitment stats (for dashboard)
const getRecruitmentStats = async (req, res) => {
    try {
        const { teamMember, client: clientId, activityType } = req.query;
        const dateRange = buildDateRangeFromQuery(req.query);
        const dateFilter = buildDateFieldFilter(dateRange, 'createdAt');
        const interviewDateFilter = buildDateFieldFilter(dateRange, 'interviewDate');

        // Combined filter for components that filter by team member AND client
        const commonFilter = {
            ...dateFilter,
            ...(teamMember && teamMember !== 'All Team' ? { addedById: teamMember } : {}),
            ...(clientId ? { clientId } : {})
        };

        const posFilter = {
            ...dateFilter,
            ...(clientId ? { clientId } : {}),
            ...(teamMember && teamMember !== 'All Team' ? {
                [Op.or]: [
                    { departmentTeamId: teamMember },
                    { teamLeaderId: teamMember },
                    { assignedToId: teamMember },
                    { postedByUserId: teamMember }
                ]
            } : {})
        };

        const totalPositions = await RecruitmentPosition.count({ where: posFilter });
        const openPositions = await RecruitmentPosition.count({ 
            where: { ...posFilter, status: 'Open' } 
        });
        const holdPositions = await RecruitmentPosition.count({ 
            where: { ...posFilter, status: 'Hold' } 
        });
        const closedPositions = await RecruitmentPosition.count({ 
            where: { ...posFilter, status: 'Closed' } 
        });

        // Pipeline stats
        const [totalCandidates, sharedCVs, shortlisted, selected, rejected] = await Promise.all([
            Candidate.count({ where: commonFilter }),
            Candidate.count({ where: { ...commonFilter, status: 'Shared' } }),
            Candidate.count({ where: { ...commonFilter, status: 'Shortlisted' } }),
            Candidate.count({ where: { ...commonFilter, [Op.or]: [{ status: 'Selected' }, { stage: 'Joined' }] } }),
            Candidate.count({ where: { ...commonFilter, status: 'Rejected' } }),
        ]);

        console.log('Fetching stage map...');
        // Pipeline stage counts
        const stageCounts = await Candidate.findAll({
            attributes: ['stage', [fn('COUNT', col('Candidate.id')), 'count']],
            where: commonFilter,
            group: ['stage'],
            raw: true,
        });
        const stageMap = {};
        stageCounts.forEach(s => { 
            if (s.stage) {
                stageMap[s.stage] = parseInt(s.count); 
            }
        });

        console.log('Fetching position metrics...');
        // Position-wise metrics
        const positions = await RecruitmentPosition.findAll({
            where: {
                ...dateFilter,
                ...(clientId ? { clientId } : {})
            },
            include: [{ model: Client, as: 'client', attributes: ['companyName', 'name'] }],
            limit: 10,
        });

        const positionMetrics = await Promise.all(positions.map(async (pos) => {
            const candidateCount = await Candidate.count({ where: { positionId: pos.id, ...dateFilter } });
            const filledCount = await Candidate.count({ where: { positionId: pos.id, stage: 'Joined', ...dateFilter } });
            return { position: pos.title, openings: pos.openings || 1, filled: filledCount, total: candidateCount };
        }));

        console.log('Fetching client metrics...');
        // Client-wise metrics
        const allPositions = await RecruitmentPosition.findAll({
            where: {
                ...dateFilter,
                ...(clientId ? { clientId } : {})
            },
            include: [{ model: Client, as: 'client', attributes: ['companyName', 'name'] }],
        });
        const clientGroups = {};
        allPositions.forEach(pos => {
            const clientName = pos.client?.companyName || pos.client?.name || 'Unknown';
            if (!clientGroups[clientName]) clientGroups[clientName] = { openings: 0, positionIds: [] };
            clientGroups[clientName].openings += (pos.openings || 1);
            clientGroups[clientName].positionIds.push(pos.id);
        });
        const clientMetrics = await Promise.all(Object.entries(clientGroups).map(async ([client, data]) => {
            const filledCount = await Candidate.count({ where: { positionId: { [Op.in]: data.positionIds }, stage: 'Joined', ...dateFilter } });
            return { client, openings: data.openings, filled: filledCount };
        }));

        console.log('Fetching interview counts...');
        // Interview counts - Global for stats card
        const [totalInterviews, scheduledInterviews, completedInterviews, cancelledInterviews] = await Promise.all([
            Interview.count({ 
                where: {
                    ...interviewDateFilter,
                    ...(clientId ? { clientId } : {})
                } 
            }),
            Interview.count({ 
                where: { 
                    ...interviewDateFilter, 
                    status: 'Scheduled',
                    ...(clientId ? { clientId } : {})
                } 
            }),
            Interview.count({ 
                where: { 
                    ...interviewDateFilter, 
                    status: 'Completed',
                    ...(clientId ? { clientId } : {})
                } 
            }),
            Interview.count({ 
                where: { 
                    ...interviewDateFilter, 
                    status: 'Cancelled',
                    ...(clientId ? { clientId } : {})
                } 
            }),
        ]);

        console.log('Fetching candidates for annual summary...');
        // Determine summary range (Always show full year of the selected filter for "Annual" context)
        let summaryYear = new Date().getFullYear();
        if (dateRange && dateRange.startDate) {
            summaryYear = new Date(dateRange.startDate).getFullYear();
        }
        
        let summaryStartDate = new Date(summaryYear, 0, 1); // Jan 1st
        let summaryEndDate = new Date(summaryYear, 11, 31, 23, 59, 59); // Dec 31st

        // If no filter, show last 12 months instead of calendar year
        if (!dateRange || !dateRange.startDate) {
            summaryStartDate = new Date();
            summaryStartDate.setMonth(summaryStartDate.getMonth() - 11);
            summaryStartDate.setDate(1);
            summaryEndDate = new Date();
        }


        let summaryRecords = [];
        const summaryDateFilter = { 
            [Op.gte]: summaryStartDate,
            [Op.lte]: summaryEndDate
        };

        if (activityType === 'Calls' || activityType === 'Interview Count' || activityType === 'Meeting') {
            // For Interview-based metrics
            const interviewWhere = {
                ...(clientId ? { clientId } : {}),
                interviewDate: summaryDateFilter,
                status: { [Op.ne]: 'Cancelled' }
            };

            if (activityType === 'Calls') {
                interviewWhere[Op.or] = [
                    { interviewType: 'Phone Screening' },
                    { meetingType: 'Phone' }
                ];
            } else if (activityType === 'Meeting') {
                interviewWhere.meetingType = { [Op.in]: ['Meeting', 'In-Person', 'Client Interview'] };
            }

            summaryRecords = await Interview.findAll({
                where: {
                    ...interviewWhere,
                    ...(teamMember && teamMember !== 'All Team' ? { interviewerId: teamMember } : {})
                },
                include: [{
                    model: Candidate,
                    as: 'candidate',
                    attributes: ['addedById'],
                    include: [{
                        model: DepartmentTeam,
                        as: 'addedBy',
                        attributes: ['name']
                    }]
                }],
                attributes: ['interviewDate', 'createdAt'],
                raw: true,
                nest: true
            });

            // Map interview records to look like summaryRecords
            summaryRecords = summaryRecords.map(int => ({
                ...int,
                createdAt: int.interviewDate || int.createdAt,
                addedBy: int.candidate?.addedBy || { name: 'Unknown' }
            }));

        } else {
            // For Candidate-based metrics (Hiring, Offers, Rejected, or default Sourcing)
            const candidateWhere = {
                ...commonFilter,
                createdAt: summaryDateFilter
            };

            if (activityType === 'Hiring') {
                candidateWhere[Op.or] = [
                    { status: 'Selected' },
                    { stage: 'Joined' }
                ];
            } else if (activityType === 'Offers') {
                candidateWhere.stage = 'Offer Sent';
            } else if (activityType === 'Rejected') {
                candidateWhere.status = 'Rejected';
            }

            summaryRecords = await Candidate.findAll({
                where: candidateWhere,
                include: [{
                    model: DepartmentTeam,
                    as: 'addedBy',
                    attributes: ['name']
                }],
                attributes: ['createdAt', 'addedById'],
                raw: true,
                nest: true
            });
        }

        console.log('Processing annual summary with consistent keys...');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const summaryMap = {};
        
        // 1. First pass: bucket candidates by month and recruiter
        const recruitersFromDb = await DepartmentTeam.findAll({ 
            where: { department: 'HR Recruitment' },
            attributes: ['name'],
            raw: true 
        });
        const allRecruiters = recruitersFromDb.map(r => r.name);
        
        summaryRecords.forEach(cand => {
            const date = new Date(cand.createdAt);
            const monthIndex = date.getMonth();
            const year = date.getFullYear();
            const sortKey = `${year}-${(monthIndex + 1).toString().padStart(2, '0')}`;
            
            if (!summaryMap[sortKey]) {
                summaryMap[sortKey] = { 
                    name: monthNames[monthIndex],
                    sortKey 
                };
            }
            // Use recruiter full name from addedBy relation
            const recruiterKey = cand.addedBy?.name || 'Unknown';
            summaryMap[sortKey][recruiterKey] = (summaryMap[sortKey][recruiterKey] || 0) + 1;
        });

        // 2. Second pass: ensure ALL 12 MONTHS of the year are present
        // This ensures a stable X-axis and professional layout
        const annualSummary = [];
        for (let i = 0; i < 12; i++) {
            const mName = monthNames[i];
            const sKey = `${summaryYear}-${(i + 1).toString().padStart(2, '0')}`;
            
            const monthData = summaryMap[sKey] || { name: mName };
            
            // Backfill ALL recruiters from DB
            allRecruiters.forEach(recruiterKey => {
                if (monthData[recruiterKey] === undefined) {
                    monthData[recruiterKey] = 0;
                }
            });
            
            delete monthData.sortKey;
            annualSummary.push(monthData);
        }
        
        console.log('Fetching tasks and notes count...');
        const pendingTasks = await DepartmentTask.count({ where: { department: 'HR Recruitment', status: 'Pending' } });
        const totalNotes = await DepartmentNote.count({ where: { department: 'HR Recruitment' } });
        
        console.log('Success! Sending response.');

        res.status(200).json({
            success: true,
            data: {
                positions: { total: totalPositions, open: openPositions, hold: holdPositions, closed: closedPositions },
                candidates: { total: totalCandidates, sharedCVs, shortlisted, selected, rejected },
                interviews: { 
                    total: totalInterviews, 
                    scheduled: scheduledInterviews, 
                    pending: completedInterviews,
                    rejected: cancelledInterviews 
                },
                annualSummary,
                funnel: {
                    screening: stageMap['Screening'] || 0, phoneInterview: stageMap['Phone Interview'] || 0,
                    technical: stageMap['Technical Round'] || 0, hrRound: stageMap['HR Round'] || 0,
                    clientInterview: stageMap['Client Interview'] || 0, offerSent: stageMap['Offer Sent'] || 0,
                    joined: stageMap['Joined'] || 0, rejected: stageMap['Rejected'] || 0,
                },
                positionMetrics,
                clientMetrics,
                pendingTasks,
                totalNotes
            }
        });
    } catch (error) {
        console.error('Error fetching recruitment stats:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch stats', error: error.message });
    }
};

// Get all recruitment positions with filtering
const getAllPositions = async (req, res) => {
    try {
        const { status, priority, client: clientId, search, sortBy, sortOrder, assignedToId } = req.query;

        const where = {
            ...buildDateFieldFilter(buildDateRangeFromQuery(req.query), 'createdAt')
        };
        if (status) where.status = status;
        if (priority) where.priority = priority;
        if (clientId) where.clientId = clientId;
        if (assignedToId) {
            where[Op.and] = where[Op.and] || [];
            where[Op.and].push({
                [Op.or]: [
                    { assignedToId: assignedToId },
                    { departmentTeamId: assignedToId },
                    { teamLeaderId: assignedToId },
                    { postedByUserId: assignedToId }
                ]
            });
        }
        if (search) {
            where[Op.and] = where[Op.and] || [];
            where[Op.and].push({
                [Op.or]: [
                    { title: { [Op.iLike]: `%${search}%` } },
                    { location: { [Op.iLike]: `%${search}%` } },
                    { description: { [Op.iLike]: `%${search}%` } },
                ]
            });
        }

        const order = sortBy ? [[sortBy, sortOrder === 'asc' ? 'ASC' : 'DESC']] : [['createdAt', 'DESC']];

        const positions = await RecruitmentPosition.findAll({
            where,
            include: [
                { model: Client, as: 'client', attributes: ['name', 'companyName'] },
                { model: TeamLeader, as: 'teamLeader', attributes: ['id', 'name', 'email'], required: false },
                { model: DepartmentTeam, as: 'postedBy', attributes: ['id', 'name', 'email'], required: false },
                { model: DepartmentTask, as: 'tasks' }
            ],
            order,
        });

        // Get candidate counts
        const positionIds = positions.map(p => p.id);
        const [candidateCounts, filledCounts] = await Promise.all([
            Candidate.findAll({
                attributes: ['positionId', [fn('COUNT', col('id')), 'count']],
                where: { positionId: { [Op.in]: positionIds } },
                group: ['positionId'],
                raw: true,
            }),
            Candidate.findAll({
                attributes: ['positionId', [fn('COUNT', col('id')), 'count']],
                where: { positionId: { [Op.in]: positionIds }, status: 'Selected' },
                group: ['positionId'],
                raw: true,
            }),
        ]);

        const candidateCountMap = {};
        candidateCounts.forEach(c => { candidateCountMap[c.positionId] = parseInt(c.count); });
        const filledCountMap = {};
        filledCounts.forEach(c => { filledCountMap[c.positionId] = parseInt(c.count); });

        const positionsWithStats = positions.map(pos => {
            const p = pos.toJSON();
            return {
                ...p,
                candidateCount: candidateCountMap[p.id] || 0,
                filled: filledCountMap[p.id] || 0,
                clientName: p.client?.companyName || p.client?.name || 'Unknown',
                clientLogo: (p.client?.companyName || p.client?.name || 'NA').substring(0, 2).toUpperCase(),
                postedByName: p.postedByName || p.postedBy?.name || p.teamLeader?.name || 'Unassigned',
                postedByEmail: p.postedByEmail || p.postedBy?.email || p.teamLeader?.email || null,
            };
        });

        res.status(200).json({ success: true, data: positionsWithStats });
    } catch (error) {
        console.error('Error fetching positions:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch positions', error: error.message });
    }
};
const getCandidateById = async (req, res) => {
    try {
        const { id } = req.params;

        const candidate = await Candidate.findByPk(id, {
            include: [
                { model: RecruitmentPosition, as: 'position', attributes: ['id', 'title', 'location', 'type', 'status'] },
                { model: Client, as: 'client', attributes: ['id', 'companyName', 'name'] },
            ],
        });

        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        // Get interview history
        const interviews = await Interview.findAll({
            where: { candidateId: id },
            attributes: ['id', 'interviewType', 'interviewDate', 'startTime', 'status', 'evaluation', 'notes', 'interviewerName'],
            order: [['interviewDate', 'DESC']],
        });

        res.status(200).json({
            success: true,
            data: {
                ...candidate.toJSON(),
                interviews,
            }
        });
    } catch (error) {
        console.error('Error fetching candidate:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch candidate', error: error.message });
    }
};



// Delete a recruitment position
const deleteRecruitmentPosition = async (req, res) => {
    try {
        const { id } = req.params;
        const { clientId } = req.query;

        const position = await RecruitmentPosition.findByPk(id);
        if (!position) {
            return res.status(404).json({ success: false, message: 'Position not found' });
        }

        if (clientId && position.clientId !== clientId) {
            return res.status(403).json({ success: false, message: 'Access denied. You can only delete positions belonging to your company.' });
        }

        // Delete associated candidates first
        await Candidate.destroy({ where: { positionId: id } });

        const deleted = await RecruitmentPosition.destroy({ where: { id } });

        res.status(200).json({ success: true, message: 'Position and associated candidates deleted' });
    } catch (error) {
        console.error('Error deleting position:', error);
        res.status(500).json({ success: false, message: 'Failed to delete position', error: error.message });
    }
};

// Get all candidates with filtering (for pipeline view)
const getAllCandidates = async (req, res) => {
    try {
        const { status, positionId, clientId, search, stage, pipelineStatus, assignedToId, page = 1, limit = 100 } = req.query;

        const where = {
            ...buildDateFieldFilter(buildDateRangeFromQuery(req.query), 'createdAt')
        };
        const positionWhere = {};
        
        if (clientId) where.clientId = clientId;
        if (assignedToId) {
            where[Op.and] = where[Op.and] || [];
            where[Op.and].push({
                [Op.or]: [
                    { addedById: assignedToId },
                    { '$position.assignedToId$': assignedToId },
                    { '$position.departmentTeamId$': assignedToId },
                    { '$position.teamLeaderId$': assignedToId }
                ]
            });
        }
        
        // Define known ENUM values to prevent database validation errors (500)
        const VALID_STATUSES = ['Submitted', 'Shortlisted', 'Interview', 'Selected', 'Rejected', 'Joined'];
        const VALID_STAGES = ['Screening', 'Phone Interview', 'Technical Round', 'HR Round', 'Client Interview', 'Offer Sent', 'Joined', 'Rejected'];
        const VALID_PIPELINE = ['Sourced', 'Applied', 'Pending', 'Interviewing', 'Selected', 'Rejected', 'On-Hold', 'Offer-Sent', 'Joined'];

        if (status) {
            const statusArray = status.split(',').map(s => s.trim());
            
            // Map frontend statuses to available DB values
            const statusCriteria = [];
            const stageCriteria = [];

            statusArray.forEach(s => {
                // Check Status Column
                if (VALID_STATUSES.includes(s)) statusCriteria.push(s);
                else if (s === 'Accepted') statusCriteria.push('Selected'); // Map Accepted to Selected
                
                // Check Stage Column
                if (VALID_STAGES.includes(s)) stageCriteria.push(s);
                else if (s === 'Offer Sent' || s === 'Negotiating') stageCriteria.push('Offer Sent');
                else if (s === 'Joined') stageCriteria.push('Joined');
            });

            // Use Op.or to find candidates matching either criteria
            const orFilters = [];
            if (statusCriteria.length > 0) {
                orFilters.push({ status: statusCriteria.length > 1 ? { [Op.in]: statusCriteria } : statusCriteria[0] });
            }
            if (stageCriteria.length > 0) {
                orFilters.push({ stage: stageCriteria.length > 1 ? { [Op.in]: stageCriteria } : stageCriteria[0] });
            }

            if (orFilters.length > 0) {
                where[Op.or] = orFilters;
            }
        }

        if (stage) {
            const stageArray = stage.split(',').map(s => s.trim());
            const filteredStage = stageArray.filter(s => VALID_STAGES.includes(s));
            if (filteredStage.length > 0) {
                where.stage = filteredStage.length > 1 ? { [Op.in]: filteredStage } : filteredStage[0];
            }
        }

        if (positionId) where.positionId = positionId;
        
        if (pipelineStatus) {
             const pipelineArray = pipelineStatus.split(',').map(s => s.trim());
             const filteredPipeline = pipelineArray.filter(s => VALID_PIPELINE.includes(s));
             if (filteredPipeline.length > 0) {
                 where.pipelineStatus = filteredPipeline.length > 1 ? { [Op.in]: filteredPipeline } : filteredPipeline[0];
             }
        }
        if (search) {
            where[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } },
            ];
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const { count: total, rows: candidates } = await Candidate.findAndCountAll({
            where,
            include: [
                {
                    model: RecruitmentPosition,
                    as: 'position',
                    attributes: ['id', 'title', 'status'],
                    where: {
                        ...positionWhere
                    },
                    required: true
                },
                { model: Client, as: 'client', attributes: ['companyName', 'name'] },
            ],
            order: [['createdAt', 'DESC']],
            offset,
            limit: parseInt(limit),
        });

        console.log(`[DEBUG] getAllCandidates returning ${candidates.length} candidates`);
        candidates.forEach(c => console.log(` - ID: ${c.id}, Name: ${c.name}, Stage: ${c.stage}, Source: ${c.source}`));

        res.status(200).json({
            success: true,
            data: candidates,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (error) {
        console.error('Error fetching all candidates:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch candidates', error: error.message });
    }
};

const getOfferCandidatesSuggestions = async (req, res) => {
    try {
        const { search = '', limit = 10 } = req.query;
        const trimmedSearch = String(search || '').trim();
        if (!trimmedSearch) {
            return res.status(200).json({ success: true, data: [] });
        }

        const candidates = await Candidate.findAll({
            where: {
                [Op.and]: [
                    {
                        [Op.or]: [
                            { name: { [Op.iLike]: `%${trimmedSearch}%` } },
                            { email: { [Op.iLike]: `%${trimmedSearch}%` } }
                        ]
                    },
                    {
                        status: { [Op.notIn]: ['Rejected'] },
                        stage: { [Op.notIn]: ['Rejected', 'Joined'] }
                    }
                ]
            },
            include: [
                { model: RecruitmentPosition, as: 'position', attributes: ['id', 'title'] },
                { model: Client, as: 'client', attributes: ['id', 'companyName', 'name'] }
            ],
            order: [['updatedAt', 'DESC']],
            limit: parseInt(limit, 10)
        });

        const data = candidates.map((candidate) => ({
            id: candidate.id,
            name: candidate.name,
            email: candidate.email,
            positionId: candidate.positionId,
            clientId: candidate.clientId,
            position: candidate.position?.title || '',
            client: candidate.client?.companyName || candidate.client?.name || '',
            currentCTC: candidate.currentSalary || '',
            expectedCTC: candidate.expectedSalary || '',
            offerStatus: candidate.offerStatus || 'Draft'
        }));

        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Error fetching offer candidate suggestions:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch offer candidates', error: error.message });
    }
};

const getOffers = async (req, res) => {
    try {
        const { clientId } = req.query;
        const where = {
            [Op.and]: [
                ...(clientId ? [{ clientId }] : []),
                {
                    [Op.or]: [
                        { stage: 'Offer Sent' },
                        { offeredCTC: { [Op.ne]: null } },
                        { offerDate: { [Op.ne]: null } },
                        { offerExpiryDate: { [Op.ne]: null } },
                        { joiningDate: { [Op.ne]: null } },
                        { negotiationNotes: { [Op.ne]: null } },
                        { offerStatus: { [Op.in]: ['Pending Approval', 'Sent', 'Negotiating', 'Accepted', 'Rejected', 'Expired'] } }
                    ]
                }
            ]
        };

        const candidates = await Candidate.findAll({
            where,
            include: [
                { model: RecruitmentPosition, as: 'position', attributes: ['id', 'title'] },
                { model: Client, as: 'client', attributes: ['id', 'companyName', 'name'] }
            ],
            order: [['updatedAt', 'DESC']]
        });

        const data = candidates
            .filter((candidate) =>
                candidate.stage === 'Offer Sent' ||
                candidate.offeredCTC ||
                candidate.offerDate ||
                candidate.offerExpiryDate ||
                candidate.joiningDate ||
                candidate.negotiationNotes ||
                ['Pending Approval', 'Sent', 'Negotiating', 'Accepted', 'Rejected', 'Expired'].includes(candidate.offerStatus)
            )
            .map((candidate) => ({
                id: candidate.id,
                candidateId: candidate.id,
                candidateName: candidate.name,
                email: candidate.email || '',
                position: candidate.position?.title || '',
                client: candidate.client?.companyName || candidate.client?.name || '',
                offeredCTC: candidate.offeredCTC || candidate.expectedSalary || '',
                currentCTC: candidate.currentSalary || '',
                joiningDate: candidate.joiningDate || '',
                offerDate: candidate.offerDate || '',
                expiryDate: candidate.offerExpiryDate || '',
                status: candidate.offerStatus || 'Draft',
                negotiationNotes: candidate.negotiationNotes || '',
                bgvStatus: candidate.bgvStatus || 'Not Started',
                tempUsername: candidate.username || '',
                tempPassword: candidate.rawPassword || '',
                offerLetterUrl: candidate.offerLetterUrl || '',
                offerLetterFileName: candidate.offerLetterFileName || '',
                photo: candidate.photo || '',
                bgvStatus: candidate.bgvStatus || 'Not Started',
                tempUsername: candidate.username || '',
                tempPassword: candidate.rawPassword || ''
            }));

        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Error fetching offers:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch offers', error: error.message });
    }
};

const createOrUpdateOffer = async (req, res) => {
    try {
        const {
            candidateId,
            candidateName,
            email,
            position,
            client,
            offeredCTC,
            currentCTC,
            joiningDate,
            offerDate,
            expiryDate,
            status,
            negotiationNotes
        } = req.body;
        
        console.log('--- CREATE/UPDATE OFFER REQUEST ---');
        console.log('Candidate ID:', candidateId);
        console.log('File:', req.file ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        } : 'No file uploaded');


        let uploadedOfferMeta = null;
        if (req.file) {
            const offerDirectory = path.join(__dirname, '..', 'uploads', 'offers');
            fs.mkdirSync(offerDirectory, { recursive: true });
            const sanitizedFileName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const targetPath = path.join(offerDirectory, sanitizedFileName);
            fs.writeFileSync(targetPath, req.file.buffer);
            uploadedOfferMeta = {
                offerLetterUrl: `/uploads/offers/${sanitizedFileName}`,
                offerLetterFileName: req.file.originalname,
                emailAttachmentName: req.file.originalname,
                emailAttachmentContent: req.file.buffer.toString('base64')
            };
            console.log('File saved successfully to:', targetPath);
        } else {
            console.log('No file received in request');
        }

        let candidate = null;
        if (candidateId || req.params.candidateId) {
            candidate = await Candidate.findByPk(candidateId || req.params.candidateId);
        }

        if (!candidate && email) {
            candidate = await Candidate.findOne({ where: { email: { [Op.iLike]: email.trim() } } });
        }

        if (!candidate && candidateName) {
            candidate = await Candidate.findOne({ where: { name: { [Op.iLike]: candidateName.trim() } } });
        }

        let resolvedPositionId = candidate?.positionId || null;
        let resolvedClientId = candidate?.clientId || null;

        // Try to resolve IDs from names if they aren't already set
        if (!resolvedPositionId && position) {
            const foundPosition = await RecruitmentPosition.findOne({ where: { title: { [Op.iLike]: position.trim() } } });
            if (foundPosition) {
                resolvedPositionId = foundPosition.id;
                resolvedClientId = resolvedClientId || foundPosition.clientId;
            }
        }

        if (!resolvedClientId && client) {
            const foundClient = await Client.findOne({
                where: {
                    [Op.or]: [
                        { companyName: { [Op.iLike]: client.trim() } },
                        { name: { [Op.iLike]: client.trim() } }
                    ]
                }
            });
            if (foundClient) resolvedClientId = foundClient.id;
        }

        if (!candidate) {
            console.log('Candidate not found, creating new one on the fly:', { candidateName, email });
            if (!candidateName || !email) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Candidate Name and Email are required to create a new candidate record.' 
                });
            }
            
            let mappedAddedByType = 'Employee';
            const userRole = String(req.user?.role || req.user?.userType || '').toLowerCase();
            if (userRole.includes('admin') || userRole.includes('leader') || userRole.includes('head') || userRole.includes('tl')) {
                mappedAddedByType = 'TeamLeader';
            } else if (userRole.includes('team') || userRole.includes('member')) {
                mappedAddedByType = 'DepartmentTeam';
            }

            candidate = await Candidate.create({
                id: uuidv4(),
                name: candidateName,
                email: email,
                clientId: resolvedClientId,
                positionId: resolvedPositionId,
                status: 'Selected',
                stage: 'Offer Sent',
                addedByType: mappedAddedByType,
                addedById: req.user?.id
            });
        }

        const normalizedRequestEmail = typeof email === 'string' ? email.trim() : '';
        const resolvedCandidateEmail = (candidate.email || normalizedRequestEmail || '').trim();
        const useTemplate = String(req.body.useTemplate || '').toLowerCase() === 'true';
        if (!uploadedOfferMeta && useTemplate) {
            if (!resolvedClientId) {
                return res.status(400).json({ success: false, message: 'Client must be resolved to use template generation' });
            }

            const templateRecord = await OfferTemplate.findOne({
                where: { clientId: resolvedClientId, status: { [Op.ne]: 'Deleted' } },
                order: [['createdAt', 'DESC']]
            });

            if (!templateRecord?.templateUrl) {
                return res.status(404).json({ success: false, message: 'Offer template not found for selected client' });
            }

            const templateRelPath = String(templateRecord.templateUrl).replace(/^\//, '');
            const templateAbsPath = path.join(__dirname, '..', templateRelPath);
            if (!fs.existsSync(templateAbsPath)) {
                return res.status(404).json({ success: false, message: 'Offer template file missing on server' });
            }

            const templateBytes = fs.readFileSync(templateAbsPath);
            const pdfDoc = await PDFDocument.load(templateBytes);
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

            const defaultFieldMap = {
                1: [
                    { key: 'offerDate', x: 0.12, y: 0.165, fontSize: 10 },
                    { key: 'candidateName', x: 0.12, y: 0.187, fontSize: 11 },
                    { key: 'address', x: 0.12, y: 0.235, fontSize: 9, maxWidth: 0.44 },
                    { key: 'joiningDate', x: 0.52, y: 0.355, fontSize: 9 },
                    { key: 'ctc', x: 0.35, y: 0.52, fontSize: 9 }
                ]
            };

            const fieldMap = (templateRecord.fieldMap && Object.keys(templateRecord.fieldMap).length > 0)
                ? templateRecord.fieldMap
                : defaultFieldMap;

            const formatDate = (value) => {
                if (!value) return '';
                const d = new Date(value);
                if (Number.isNaN(d.getTime())) return String(value);
                return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            };

            const values = {
                offerDate: formatDate(offerDate),
                candidateName: candidateName || candidate.name || '',
                address: negotiationNotes || '',
                joiningDate: formatDate(joiningDate),
                ctc: offeredCTC ? `Rs. ${offeredCTC}` : '',
                client: client || ''
            };

            const pages = pdfDoc.getPages();
            for (const [pageKey, fields] of Object.entries(fieldMap || {})) {
                const pageIndex = Math.max(0, parseInt(pageKey, 10) - 1);
                const page = pages[pageIndex];
                if (!page || !Array.isArray(fields)) continue;
                const { width, height } = page.getSize();

                for (const f of fields) {
                    let raw = values[f.key] ?? '';
                    if (!raw) continue;
                    
                    // Sanitize for PDF encoding (WinAnsi cannot encode Rupee symbol)
                    raw = String(raw).replace(/₹/g, 'Rs.');

                    const size = Number(f.fontSize) || 10;
                    const x = width * (Number(f.x) || 0);
                    const yTop = height * (Number(f.y) || 0);
                    let y = height - yTop - size;

                    if (f.key === 'address') {
                        const maxWidth = width * (Number(f.maxWidth) || 0.4);
                        const lines = wrapTextToWidth({ text: raw, font, fontSize: size, maxWidth });
                        for (let li = 0; li < lines.length; li += 1) {
                            page.drawText(lines[li], { x, y: y - (li * (size + 2)), size, font, color: rgb(0, 0, 0) });
                        }
                        continue;
                    }

                    page.drawText(String(raw), { x, y, size, font, color: rgb(0, 0, 0) });
                }
            }

            const generatedBytes = await pdfDoc.save();
            const offerDirectory = path.join(__dirname, '..', 'uploads', 'offers');
            fs.mkdirSync(offerDirectory, { recursive: true });
            const generatedName = `${Date.now()}-offer-${candidate.id}.pdf`;
            const targetPath = path.join(offerDirectory, generatedName);
            fs.writeFileSync(targetPath, Buffer.from(generatedBytes));
            uploadedOfferMeta = {
                offerLetterUrl: `/uploads/offers/${generatedName}`,
                offerLetterFileName: templateRecord.templateFileName || 'OfferLetter.pdf',
                emailAttachmentName: templateRecord.templateFileName || 'OfferLetter.pdf',
                emailAttachmentContent: Buffer.from(generatedBytes).toString('base64')
            };
        }

        await candidate.update({
            positionId: resolvedPositionId || candidate.positionId,
            clientId: resolvedClientId || candidate.clientId,
            email: resolvedCandidateEmail || candidate.email,
            offeredCTC: offeredCTC || null,
            currentSalary: currentCTC || candidate.currentSalary || null,
            joiningDate: joiningDate || null,
            offerDate: offerDate || null,
            offerExpiryDate: expiryDate || null,
            offerStatus: normalizeOfferStatus(status),
            negotiationNotes: negotiationNotes || null,
            offerLetterUrl: uploadedOfferMeta?.offerLetterUrl || candidate.offerLetterUrl || null,
            offerLetterFileName: uploadedOfferMeta?.offerLetterFileName || candidate.offerLetterFileName || null,
            stage: normalizeOfferStatus(status) === 'Accepted' ? 'Joined' : 'Offer Sent',
            status: normalizeOfferStatus(status) === 'Rejected' ? 'Rejected' : (normalizeOfferStatus(status) === 'Accepted' ? 'Selected' : candidate.status || 'Selected')
        });

        let emailNotification = {
            attempted: Boolean(uploadedOfferMeta),
            sent: false,
            reason: null
        };

        if (uploadedOfferMeta) {
            if (!resolvedCandidateEmail) {
                emailNotification.reason = 'Candidate email is missing';
            } else {
            try {
                await sendEmail({
                    email: resolvedCandidateEmail,
                    name: candidate.name,
                    subject: `Offer Letter - ${position || 'Mabicons Opportunity'}`,
                    htmlContent: buildOfferEmailHtml({
                        candidateName: candidate.name,
                        position,
                        client,
                        offeredCTC,
                        joiningDate,
                        expiryDate
                    }),
                    attachments: [{
                        name: uploadedOfferMeta.emailAttachmentName,
                        content: uploadedOfferMeta.emailAttachmentContent
                    }]
                });
                emailNotification.sent = true;
            } catch (emailError) {
                console.error('Failed to send offer email:', emailError.response?.data || emailError.message);
                emailNotification.reason = emailError.response?.data?.message || emailError.message || 'Email provider error';
                if (emailError?.code === 'BREVO_API_KEY_MISSING') {
                    emailNotification.reason = 'BREVO_API_KEY missing in backend .env';
                }
            }
            }
        }

        const refreshed = await Candidate.findByPk(candidate.id, {
            include: [
                { model: RecruitmentPosition, as: 'position', attributes: ['id', 'title'] },
                { model: Client, as: 'client', attributes: ['id', 'companyName', 'name'] }
            ]
        });

        res.status(200).json({
            success: true,
            message: uploadedOfferMeta
                ? (emailNotification.sent ? 'Offer saved and email sent successfully' : 'Offer saved, but email was not sent')
                : 'Offer saved successfully',
            emailNotification,
            data: {
                id: refreshed.id,
                candidateId: refreshed.id,
                candidateName: refreshed.name,
                email: refreshed.email || '',
                position: refreshed.position?.title || '',
                client: refreshed.client?.companyName || refreshed.client?.name || '',
                offeredCTC: refreshed.offeredCTC || '',
                currentCTC: refreshed.currentSalary || '',
                joiningDate: refreshed.joiningDate || '',
                offerDate: refreshed.offerDate || '',
                expiryDate: refreshed.offerExpiryDate || '',
                status: refreshed.offerStatus || 'Draft',
                negotiationNotes: refreshed.negotiationNotes || '',
                offerLetterUrl: refreshed.offerLetterUrl || '',
                offerLetterFileName: refreshed.offerLetterFileName || '',
                photo: refreshed.photo || ''
            }
        });
    } catch (error) {
        console.error('Error saving offer:', error);
        res.status(500).json({ success: false, message: 'Failed to save offer', error: error.message });
    }
};

// Get recruitment progress for a specific client (client-facing read-only view)
const getClientRecruitmentProgress = async (req, res) => {
    try {
        const { clientId } = req.params;

        // Verify client exists
        const client = await Client.findByPk(clientId);
        if (!client) {
            return res.status(404).json({ success: false, message: 'Client not found' });
        }

        // Get all positions for this client
        const positions = await RecruitmentPosition.findAll({
            where: { clientId },
            attributes: ['id', 'title', 'location', 'type', 'status', 'priority', 'openings', 'filled', 'deadline', 'createdAt'],
            order: [['createdAt', 'DESC']],
        });

        const positionIds = positions.map(p => p.id);

        // Get candidates and stage counts in parallel
        const [candidates, stageCounts, totalInterviews, scheduledInterviews, completedInterviews, upcomingInterviews] = await Promise.all([
            Candidate.findAll({
                where: { clientId },
                attributes: ['id', 'name', 'stage', 'pipelineStatus', 'positionId', 'createdAt', 'updatedAt'],
                include: [{ model: RecruitmentPosition, as: 'position', attributes: ['title'] }],
                order: [['createdAt', 'DESC']],
            }),
            Candidate.findAll({
                attributes: ['stage', [fn('COUNT', col('id')), 'count']],
                where: { clientId },
                group: ['stage'],
                raw: true,
            }),
            Interview.count({ where: { positionId: { [Op.in]: positionIds } } }),
            Interview.count({ where: { positionId: { [Op.in]: positionIds }, status: 'Scheduled' } }),
            Interview.count({ where: { positionId: { [Op.in]: positionIds }, status: 'Completed' } }),
            Interview.findAll({
                where: {
                    positionId: { [Op.in]: positionIds },
                    status: 'Scheduled',
                    interviewDate: { [Op.gte]: new Date() },
                },
                include: [
                    { model: Candidate, as: 'candidate', attributes: ['name'] },
                    { model: RecruitmentPosition, as: 'position', attributes: ['title'] },
                ],
                order: [['interviewDate', 'ASC']],
                limit: 10,
            }),
        ]);

        // Build stage funnel
        const stageFunnel = {};
        stageCounts.forEach(s => { stageFunnel[s.stage] = parseInt(s.count); });

        // Build position summaries
        const candidatesByPosition = {};
        candidates.forEach(c => {
            const posId = c.positionId;
            if (posId) {
                if (!candidatesByPosition[posId]) candidatesByPosition[posId] = 0;
                candidatesByPosition[posId]++;
            }
        });

        const positionSummaries = positions.map(p => ({
            id: p.id,
            title: p.title,
            location: p.location,
            type: p.type,
            status: p.status,
            priority: p.priority,
            openings: p.openings || 1,
            filled: p.filled || 0,
            candidateCount: candidatesByPosition[p.id] || 0,
            deadline: p.deadline,
            postedDate: p.createdAt,
        }));

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalPositions: positions.length,
                    openPositions: positions.filter(p => p.status === 'Open').length,
                    totalCandidates: candidates.length,
                    inPipeline: candidates.filter(c => !['Joined', 'Rejected'].includes(c.stage)).length,
                    hired: candidates.filter(c => c.stage === 'Joined').length,
                    totalInterviews,
                    scheduledInterviews,
                    completedInterviews,
                },
                positions: positionSummaries,
                funnel: {
                    screening: stageFunnel['Screening'] || 0,
                    phoneInterview: stageFunnel['Phone Interview'] || 0,
                    technical: stageFunnel['Technical Round'] || 0,
                    hrRound: stageFunnel['HR Round'] || 0,
                    clientInterview: stageFunnel['Client Interview'] || 0,
                    offerSent: stageFunnel['Offer Sent'] || 0,
                    joined: stageFunnel['Joined'] || 0,
                    rejected: stageFunnel['Rejected'] || 0,
                },
                upcomingInterviews: upcomingInterviews.map(i => ({
                    candidateName: i.candidate?.name,
                    positionTitle: i.position?.title,
                    interviewDate: i.interviewDate,
                    startTime: i.startTime,
                    interviewType: i.interviewType,
                    status: i.status,
                })),
                candidates: candidates.map(c => ({
                    id: c.id,
                    name: c.name,
                    stage: c.stage,
                    pipelineStatus: c.pipelineStatus,
                    position: c.position?.title || '',
                    updatedAt: c.updatedAt,
                })),
            }
        });
    } catch (error) {
        console.error('Error fetching client recruitment progress:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch recruitment progress', error: error.message });
    }
};

// ==================== NEW FUNCTIONS FOR FRONTEND COMPATIBILITY ====================

// Get recruitment requests (for team leader view)
const getRequests = async (req, res) => {
    try {
        const positions = await RecruitmentPosition.findAll({
            include: [{ model: Client, as: 'client', attributes: ['name', 'companyName'] }],
            order: [['createdAt', 'DESC']],
        });
        res.status(200).json({ success: true, data: positions });
    } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch requests', error: error.message });
    }
};

// Create recruitment request (alternative format)
const createRequest = async (req, res) => {
    try {
        const { title, description, location, type, salary, status, priority, openings, skills, experience, clientId, teamLeaderId, departmentTeamId, deadline } = req.body;

        if (!clientId) {
            return res.status(400).json({ success: false, message: 'Client ID is required' });
        }

        const position = await RecruitmentPosition.create({
            title, description, location, type, salary,
            status: status || 'Open', priority: priority || 'Medium',
            openings: openings || 1, skills: skills || [],
            experience, clientId, teamLeaderId, departmentTeamId, deadline
        });

        res.status(201).json({ success: true, message: 'Request created successfully', data: position });
    } catch (error) {
        console.error('Error creating request:', error);
        res.status(500).json({ success: false, message: 'Failed to create request', error: error.message });
    }
};

// Upload resumes (multer handles the files)
const uploadResumes = async (req, res) => {
    try {
        const files = req.files;
        const { positionId, clientId, roleType, candidateName, phone } = req.body;
        const resolvedRoleType = roleType?.trim() || 'Uncategorized';

        if (!files || files.length === 0) {
            return res.status(400).json({ success: false, message: 'No files uploaded' });
        }

        const candidates = [];
        for (const file of files) {
            const uploadDir = path.join(__dirname, '..', 'uploads', 'resumes');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const storedFileName = `${Date.now()}-${file.originalname}`;
            const filePath = path.join(uploadDir, storedFileName);
            fs.writeFileSync(filePath, file.buffer);

            const resolvedName = candidateName?.trim() || file.originalname.replace(/\.(pdf|doc|docx)$/i, '');

            const candidate = await Candidate.create({
                name: resolvedName,
                email: buildUploadedCandidateEmail(file.originalname),
                phone: phone?.trim() || null,
                positionId: positionId || null,
                clientId: clientId || null,
                cvUrl: `/uploads/resumes/${storedFileName}`,
                cvFileName: file.originalname,
                status: 'Submitted',
                stage: 'Screening',
                pipelineStatus: 'pending',
            });
            candidates.push(candidate);

            // Also add to Resume Bank for multi-upload
            try {
                const ext = file.originalname.split('.').pop().toLowerCase();
                const allowedTypes = ['pdf', 'doc', 'docx'];
                const fileType = allowedTypes.includes(ext) ? ext : 'pdf';

                await ResumeBank.create({
                    sharePointId: `local-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                    driveId: 'local',
                    fileName: file.originalname,
                    fileType: fileType,
                    fileSize: file.size,
                    roleType: resolvedRoleType,
                    candidateName: resolvedName,
                    webUrl: `/uploads/resumes/${storedFileName}`
                });
                console.log('Successfully synced bulk upload with Resume Bank:', resolvedName);
            } catch (bankErr) {
                console.error('Failed to sync bulk upload with Resume Bank Error details:', bankErr);
            }
        }

        res.status(201).json({ success: true, message: `${candidates.length} resume(s) uploaded`, data: candidates });
    } catch (error) {
        console.error('Error uploading resumes:', error);
        res.status(500).json({ success: false, message: 'Failed to upload resumes', error: error.message });
    }
};

// Accept / shortlist candidate (simple)
const acceptCandidateSimple = async (req, res) => {
    try {
        const { candidateId, clientId } = req.body;
        const candidate = await Candidate.findByPk(candidateId);
        if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

        if (clientId && candidate.clientId !== clientId) {
            return res.status(403).json({ success: false, message: 'Access denied. You can only accept candidates belonging to your company.' });
        }

        await candidate.update({ status: 'Shortlisted', shortlistedAt: new Date(), stage: 'Shortlisted' });
        res.status(200).json({ success: true, message: 'Candidate accepted/shortlisted', data: candidate });
    } catch (error) {
        console.error('Error accepting candidate:', error);
        res.status(500).json({ success: false, message: 'Failed to accept candidate', error: error.message });
    }
};

// Reject candidate (simple)
const rejectCandidateSimple = async (req, res) => {
    try {
        const { candidateId, reason } = req.body;
        const candidate = await Candidate.findByPk(candidateId);
        if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

        await candidate.update({ status: 'Rejected', stage: 'Rejected', rejectionReason: reason || '' });
        res.status(200).json({ success: true, message: 'Candidate rejected', data: candidate });
    } catch (error) {
        console.error('Error rejecting candidate:', error);
        res.status(500).json({ success: false, message: 'Failed to reject candidate', error: error.message });
    }
};

// Get shortlisted candidates
const getShortlistedCandidates = async (req, res) => {
    try {
        const { positionId, clientId } = req.body;
        const where = { status: { [Op.in]: ['Shortlisted', 'Interview', 'Selected'] } };
        if (positionId) where.positionId = positionId;
        if (clientId) where.clientId = clientId;

        const candidates = await Candidate.findAll({
            where,
            include: [{ model: RecruitmentPosition, as: 'position', attributes: ['title'] }],
            order: [['createdAt', 'DESC']],
        });
        res.status(200).json({ success: true, data: candidates });
    } catch (error) {
        console.error('Error fetching shortlisted:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch shortlisted candidates', error: error.message });
    }
};

// Get client requests (simple)
const getClientRequestsSimple = async (req, res) => {
    try {
        const { clientId } = req.query;
        const where = {};
        if (clientId) where.clientId = clientId;

        const positions = await RecruitmentPosition.findAll({
            where,
            include: [{ model: Client, as: 'client', attributes: ['name', 'companyName'] }],
            order: [['createdAt', 'DESC']],
        });
        res.status(200).json({ success: true, data: positions });
    } catch (error) {
        console.error('Error fetching client requests:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch client requests', error: error.message });
    }
};

// Get single request details
const getRequestDetails = async (req, res) => {
    try {
        const { requestId } = req.params;
        const position = await RecruitmentPosition.findByPk(requestId, {
            include: [
                { model: Client, as: 'client', attributes: ['name', 'companyName'] },
            ],
        });
        if (!position) return res.status(404).json({ success: false, message: 'Request not found' });

        const candidates = await Candidate.findAll({ where: { positionId: requestId }, order: [['createdAt', 'DESC']] });
        res.status(200).json({ success: true, data: { ...position.toJSON(), candidates } });
    } catch (error) {
        console.error('Error fetching request details:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch request details', error: error.message });
    }
};

// Get recruitment status (simple)
const getRecruitmentStatusSimple = async (req, res) => {
    try {
        const { positionId } = req.body;
        const where = {};
        if (positionId) where.positionId = positionId;

        const candidates = await Candidate.findAll({
            where,
            attributes: ['status', [fn('COUNT', col('id')), 'count']],
            group: ['status'],
            raw: true,
        });

        const statusMap = {};
        candidates.forEach(c => { statusMap[c.status] = parseInt(c.count); });
        res.status(200).json({ success: true, data: statusMap });
    } catch (error) {
        console.error('Error fetching status:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch status', error: error.message });
    }
};

// Schedule interview for a recruit
const scheduleInterviewForRecruit = async (req, res) => {
    try {
        const { candidateId, positionId, interviewDate, startTime, interviewType, interviewerName, meetLink, notes } = req.body;

        const interview = await Interview.create({
            candidateId, positionId, interviewDate, startTime,
            interviewType: interviewType || 'Video', interviewerName,
            interviewerId: req.user?.id,
            interviewerType: req.user?.userType || 'DepartmentTeam',
            interviewerEmail: req.user?.email,
            meetLink, notes, status: 'Scheduled',
        });

        if (candidateId) {
            await Candidate.update({ status: 'Interview', stage: 'Client Interview' }, { where: { id: candidateId } });
        }

        res.status(201).json({ success: true, message: 'Interview scheduled', data: interview });
    } catch (error) {
        console.error('Error scheduling interview:', error);
        res.status(500).json({ success: false, message: 'Failed to schedule interview', error: error.message });
    }
};

// Close recruitment request
const closeRequest = async (req, res) => {
    try {
        const { requestId, reason } = req.body;
        const position = await RecruitmentPosition.findByPk(requestId);
        if (!position) return res.status(404).json({ success: false, message: 'Request not found' });

        await position.update({ status: 'Closed' });
        res.status(200).json({ success: true, message: 'Request closed', data: position });
    } catch (error) {
        console.error('Error closing request:', error);
        res.status(500).json({ success: false, message: 'Failed to close request', error: error.message });
    }
};

// Generate Meet link for interview
const generateMeetLinkForInterview = async (req, res) => {
    try {
        const { interviewId, candidateId } = req.body;
        // Generate a basic meet link (Google Meet links require OAuth; placeholder for now)
        const meetLink = `https://meet.google.com/${Math.random().toString(36).substring(2, 11)}`;

        if (interviewId) {
            await Interview.update({ meetLink }, { where: { id: interviewId } });
        }

        res.status(200).json({ success: true, meetLink });
    } catch (error) {
        console.error('Error generating meet link:', error);
        res.status(500).json({ success: false, message: 'Failed to generate meet link', error: error.message });
    }
};

const getMyPerformanceStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const { period } = req.query;

        // Check if user is a manager/head to perform team aggregation
        let memberIds = [userId];
        const isHead = req.user.role === 'Department Head' || req.user.role === 'Admin' || req.user.id === '60de4380-0140-49ff-b26d-a8d06333af11';
        
        if (isHead) {
            const teamMembers = await DepartmentTeam.findAll({ 
                where: { managerId: userId },
                attributes: ['id']
            });
            if (teamMembers.length > 0) {
                memberIds = [...memberIds, ...teamMembers.map(m => m.id)];
            }
        }

        // Position Filter (All positions managed by the head or their direct reports)
        const posWhere = {
            [Op.or]: [
                { departmentTeamId: { [Op.in]: memberIds } }, 
                { teamLeaderId: { [Op.in]: memberIds } },
                { assignedToId: { [Op.in]: memberIds } }
            ]
        };

        const now = new Date();
        let periodStart = null;
        let periodEnd = null;

        if (period === 'This Month') {
            periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
            periodEnd = now;
        } else if (period === 'Last Month') {
            periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            periodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        } else if (period === 'This Quarter') {
            const quarter = Math.floor(now.getMonth() / 3);
            periodStart = new Date(now.getFullYear(), quarter * 3, 1);
            periodEnd = now;
        }

        const buildRangeFilter = (field) => {
            if (!periodStart && !periodEnd) return {};
            if (periodStart && periodEnd) {
                return { [field]: { [Op.between]: [periodStart, periodEnd] } };
            }
            if (periodStart) return { [field]: { [Op.gte]: periodStart } };
            return { [field]: { [Op.lte]: periodEnd } };
        };

        const managedPositions = await RecruitmentPosition.findAll({
            where: posWhere,
            attributes: ['id']
        });
        const managedIds = managedPositions.map(p => p.id);

        // Header Stats
        let headerStats = {
            activePositions: await RecruitmentPosition.count({ where: { ...posWhere, status: 'Open' } }),
            thisWeekHires: await Candidate.count({ 
                where: { 
                    [Op.or]: [
                        { positionId: { [Op.in]: managedIds } },
                        { addedById: { [Op.in]: memberIds } }
                    ],
                    stage: 'Joined',
                    ...buildRangeFilter('updatedAt')
                } 
            }),
            interviewsScheduled: await Interview.count({ 
                where: { 
                    [Op.or]: [
                        { positionId: { [Op.in]: managedIds } },
                        { interviewerId: { [Op.in]: memberIds } },
                        { interviewerName: { [Op.iLike]: `%${req.user.name.split(' ')[0]}%` } },
                        { '$candidate.addedById$': { [Op.in]: memberIds } }
                    ],
                    status: 'Scheduled',
                    ...buildRangeFilter('interviewDate')
                },
                include: [{ model: Candidate, as: 'candidate', attributes: [] }]
            }),
            candidatesPipeline: await Candidate.count({ 
                where: { 
                    [Op.or]: [
                        { positionId: { [Op.in]: managedIds } },
                        { addedById: { [Op.in]: memberIds } }
                    ],
                    ...buildRangeFilter('createdAt')
                } 
            }),
            offersExtended: await Candidate.count({ 
                where: { 
                    [Op.or]: [
                        { positionId: { [Op.in]: managedIds } },
                        { addedById: { [Op.in]: memberIds } }
                    ],
                    stage: 'Offer Sent',
                    ...buildRangeFilter('updatedAt')
                } 
            })
        };

        // Weekly Activity (Last 5 business days)
        let weeklyActivity = [];
        for (let i = 4; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const startOfDay = new Date(date).setHours(0, 0, 0, 0);
            const endOfDay = new Date(date).setHours(23, 59, 59, 999);
            
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
            
            const dayHires = await Candidate.count({ 
                where: { 
                    [Op.or]: [
                        { positionId: { [Op.in]: managedIds } },
                        { addedById: { [Op.in]: memberIds } }
                    ],
                    stage: 'Joined', 
                    updatedAt: { [Op.between]: [new Date(startOfDay), new Date(endOfDay)] } 
                } 
            });
            const dayInterviews = await Interview.count({ 
                where: { 
                    [Op.or]: [
                        { positionId: { [Op.in]: managedIds } },
                        { interviewerId: { [Op.in]: memberIds } },
                        { interviewerName: { [Op.iLike]: `%${req.user.name.split(' ')[0]}%` } },
                        { '$candidate.addedById$': { [Op.in]: memberIds } }
                    ], 
                    interviewDate: { [Op.between]: [new Date(startOfDay), new Date(endOfDay)] } 
                },
                include: [{ model: Candidate, as: 'candidate', attributes: [] }]
            });
            const dayScreenings = await Candidate.count({ 
                where: { 
                    [Op.or]: [
                        { positionId: { [Op.in]: managedIds } },
                        { addedById: { [Op.in]: memberIds } }
                    ], 
                    createdAt: { [Op.between]: [new Date(startOfDay), new Date(endOfDay)] } 
                } 
            });
            
            weeklyActivity.push({ day: dayName, hires: dayHires, interviews: dayInterviews, screenings: dayScreenings });
        }

        // Conversion Metrics (Lifetime for this period context)
        const totalScreened = await Candidate.count({ 
            where: { 
                [Op.or]: [
                    { positionId: { [Op.in]: managedIds } },
                    { addedById: { [Op.in]: memberIds } }
                ]
            } 
        });
        const totalInterviewsDone = await Interview.count({ 
            where: { 
                [Op.or]: [
                    { positionId: { [Op.in]: managedIds } },
                    { interviewerId: { [Op.in]: memberIds } },
                    { interviewerName: { [Op.iLike]: `%${req.user.name.split(' ')[0]}%` } },
                    { '$candidate.addedById$': { [Op.in]: memberIds } }
                ]
            },
            include: [{ model: Candidate, as: 'candidate', attributes: [] }]
        });
        const totalOffers = await Candidate.count({ 
            where: { 
                [Op.or]: [
                    { positionId: { [Op.in]: managedIds } },
                    { addedById: { [Op.in]: memberIds } }
                ],
                stage: 'Offer Sent' 
            } 
        });
        const totalJoined = await Candidate.count({ 
            where: { 
                [Op.or]: [
                    { positionId: { [Op.in]: managedIds } },
                    { addedById: { [Op.in]: memberIds } }
                ],
                stage: 'Joined' 
            } 
        });

        let conversionMetrics = {
            screeningToInterview: totalScreened > 0 ? Math.round((totalInterviewsDone / totalScreened) * 100) : 0,
            interviewToOffer: totalInterviewsDone > 0 ? Math.round((totalOffers / totalInterviewsDone) * 100) : 0,
            offerToJoin: totalOffers > 0 ? Math.round((totalJoined / totalOffers) * 100) : 0
        };

        const hasNoAttributedData =
            headerStats.activePositions === 0 &&
            headerStats.thisWeekHires === 0 &&
            headerStats.interviewsScheduled === 0 &&
            headerStats.candidatesPipeline === 0 &&
            headerStats.offersExtended === 0;

        if (hasNoAttributedData && req.user?.department === 'HR Recruitment') {
            headerStats = {
                activePositions: await RecruitmentPosition.count({ where: { status: 'Open' } }),
                thisWeekHires: await Candidate.count({
                    where: {
                        stage: 'Joined',
                        ...buildRangeFilter('updatedAt')
                    }
                }),
                interviewsScheduled: await Interview.count({
                    where: {
                        status: 'Scheduled',
                        ...buildRangeFilter('interviewDate')
                    }
                }),
                candidatesPipeline: await Candidate.count({
                    where: {
                        ...buildRangeFilter('createdAt')
                    }
                }),
                offersExtended: await Candidate.count({
                    where: {
                        stage: 'Offer Sent',
                        ...buildRangeFilter('updatedAt')
                    }
                })
            };

            weeklyActivity = [];
            for (let i = 4; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const startOfDay = new Date(date).setHours(0, 0, 0, 0);
                const endOfDay = new Date(date).setHours(23, 59, 59, 999);

                weeklyActivity.push({
                    day: date.toLocaleDateString('en-US', { weekday: 'long' }),
                    hires: await Candidate.count({
                        where: {
                            stage: 'Joined',
                            updatedAt: { [Op.between]: [new Date(startOfDay), new Date(endOfDay)] }
                        }
                    }),
                    interviews: await Interview.count({
                        where: {
                            interviewDate: { [Op.between]: [new Date(startOfDay), new Date(endOfDay)] }
                        }
                    }),
                    screenings: await Candidate.count({
                        where: {
                            createdAt: { [Op.between]: [new Date(startOfDay), new Date(endOfDay)] }
                        }
                    })
                });
            }

            const [globalScreened, globalInterviews, globalOffers, globalJoined] = await Promise.all([
                Candidate.count(),
                Interview.count(),
                Candidate.count({ where: { stage: 'Offer Sent' } }),
                Candidate.count({ where: { stage: 'Joined' } })
            ]);

            conversionMetrics = {
                screeningToInterview: globalScreened > 0 ? Math.round((globalInterviews / globalScreened) * 100) : 0,
                interviewToOffer: globalInterviews > 0 ? Math.round((globalOffers / globalInterviews) * 100) : 0,
                offerToJoin: globalOffers > 0 ? Math.round((globalJoined / globalOffers) * 100) : 0
            };
        }

        res.status(200).json({ 
            success: true, 
            data: { 
                ...headerStats,
                weeklyActivity,
                conversionMetrics
            } 
        });
    } catch (error) {
        console.error('Error fetching personal performance stats:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch personal stats', error: error.message });
    }
};

const deleteOffer = async (req, res) => {
    try {
        const { candidateId } = req.params;
        const candidate = await Candidate.findByPk(candidateId);

        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        // Clear offer-related fields
        await candidate.update({
            offeredCTC: null,
            offerDate: null,
            offerExpiryDate: null,
            joiningDate: null,
            negotiationNotes: null,
            offerStatus: null,
            offerLetterUrl: null,
            offerLetterFileName: null,
            // Reset to previous pipeline stage
            stage: 'Client Interview',
            status: 'Interview'
        });

        res.status(200).json({ 
            success: true, 
            message: 'Offer deleted and candidate stage reset successfully',
            data: { candidateId }
        });
    } catch (error) {
        console.error('Error deleting offer:', error);
        res.status(500).json({ success: false, message: 'Failed to delete offer', error: error.message });
    }
};


const verifyCandidateKYC = async (req, res) => {
    try {
        const { candidateId, docType, status, comment, rejectionReason } = req.body;
        const candidate = await Candidate.findByPk(candidateId);
        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        // Initialize kycDocuments if null
        const kycDocuments = candidate.kycDocuments || {};
        
        if (!kycDocuments[docType]) {
            kycDocuments[docType] = {};
        }

        kycDocuments[docType].verified = status === 'verified';
        kycDocuments[docType].verifiedAt = new Date();
        kycDocuments[docType].comment = comment;
        if (status === 'rejected' && rejectionReason) {
            kycDocuments[docType].rejectionReason = rejectionReason;
        }

        // Use changed() or set explicitly for JSONB updates if needed
        candidate.set('kycDocuments', kycDocuments);
        candidate.changed('kycDocuments', true);
        await candidate.save();

        // Send email notification when document is rejected
        if (status === 'rejected' && candidate.email) {
            const docTypeLabels = {
                pan: 'PAN Card',
                aadhar: 'Aadhar Card',
                payslips: 'Payslips',
                bank_statement: 'Bank Statement',
                degree: 'Degree Certificate',
                marksheet: 'Marksheet',
                appointment_letter: 'Appointment Letter',
                relieving_letter: 'Relieving Letter'
            };
            
            const docLabel = docTypeLabels[docType] || docType;
            const reason = rejectionReason || 'The document could not be verified. Please ensure you upload a clear, valid document.';
            
            try {
                await sendEmail({
                    to: candidate.email,
                    subject: `Action Required: Re-upload ${docLabel} - Mabicons ERP`,
                    html: `
                        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1A1A2E;">
                            <div style="text-align: center; margin-bottom: 30px;">
                                <h1 style="color: #1B4DA0; margin: 0; font-size: 24px;">Document Re-upload Required</h1>
                            </div>
                            <p style="font-size: 16px; line-height: 1.6;">Dear ${candidate.name || 'Candidate'},</p>
                            <p style="font-size: 16px; line-height: 1.6;">During our verification process, we found an issue with your <strong>${docLabel}</strong> document.</p>
                            <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px 20px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                                <p style="margin: 0; font-weight: 600; color: #92400E;">Reason for Rejection:</p>
                                <p style="margin: 8px 0 0 0; color: #78350F;">${reason}</p>
                            </div>
                            <p style="font-size: 16px; line-height: 1.6;">Please log in to your candidate portal and re-upload a valid <strong>${docLabel}</strong> at your earliest convenience.</p>
                            <div style="text-align: center; margin: 32px 0;">
                                <a href="https://erp.mabicons.com/candidate-login" style="display: inline-block; background: #1B4DA0; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Go to Candidate Portal</a>
                            </div>
                            <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 30px 0;" />
                            <p style="font-size: 14px; color: #94A3B8; margin: 0;">Best Regards,<br/><strong style="color: #1B4DA0;">Mabicons Recruitment Team</strong></p>
                        </div>
                    `
                });
            } catch (emailError) {
                console.error('Failed to send rejection email:', emailError);
            }
        }

        res.status(200).json({ 
            success: true, 
            message: `KYC for ${docType} has been ${status === 'verified' ? 'verified' : 'rejected'}`, 
            data: candidate 
        });
    } catch (error) {
        console.error('Error verifying KYC:', error);
        res.status(500).json({ success: false, message: 'Failed to verify KYC', error: error.message });
    }
};

const bulkVerifyCandidateKYC = async (req, res) => {
    try {
        const { candidateId, docTypes, status, comment } = req.body;
        const candidate = await Candidate.findByPk(candidateId);
        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        const kycDocuments = candidate.kycDocuments || {};
        docTypes.forEach(docType => {
            if (!kycDocuments[docType]) kycDocuments[docType] = {};
            kycDocuments[docType].verified = status === 'verified';
            kycDocuments[docType].verifiedAt = new Date();
            if (comment) kycDocuments[docType].comment = comment;
        });

        candidate.set('kycDocuments', kycDocuments);
        candidate.changed('kycDocuments', true);
        await candidate.save();

        res.json({ 
            success: true, 
            message: `${docTypes.length} documents verified successfully`,
            data: candidate.kycDocuments
        });
    } catch (error) {
        console.error('Bulk verification error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const uploadCandidateKYC = async (req, res) => {
    try {
        const { docType, side } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const candidateId = req.user.id;
        const candidate = await Candidate.findByPk(candidateId);
        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        // Create upload directory if it doesn't exist
        const uploadDir = path.join(__dirname, '..', 'uploads', 'kyc');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Generate filename: candidateId-docType-side-timestamp.ext
        const ext = path.extname(file.originalname);
        const fileName = `${candidateId}-${docType}${side ? `-${side}` : ''}-${Date.now()}${ext}`;
        const filePath = path.join(uploadDir, fileName);

        // Save file
        fs.writeFileSync(filePath, file.buffer);

        // Update candidate record
        const kycDocuments = candidate.kycDocuments || {};
        const docKey = side ? `${docType}_${side}` : docType;

        // PHYSICAL DELETION: If a document already exists for this key, delete the old file from disk
        if (kycDocuments[docKey] && kycDocuments[docKey].url) {
            try {
                const oldRelativePath = kycDocuments[docKey].url; // e.g., /uploads/kyc/filename.pdf
                const oldFullPath = path.join(__dirname, '..', oldRelativePath);
                
                if (fs.existsSync(oldFullPath)) {
                    fs.unlinkSync(oldFullPath);
                    console.log(`[CLEANUP] Deleted old KYC file: ${oldFullPath}`);
                }
            } catch (cleanupError) {
                console.error('[CLEANUP ERROR] Failed to delete old KYC file:', cleanupError);
                // We continue anyway so the new upload isn't blocked by a cleanup failure
            }
        }

        kycDocuments[docKey] = {
            url: `/uploads/kyc/${fileName}`,
            fileName: file.originalname,
            uploadedAt: new Date(),
            verified: false // Reset verification status on re-upload
        };

        candidate.set('kycDocuments', { ...kycDocuments });
        candidate.changed('kycDocuments', true);
        await candidate.save();

        res.status(200).json({
            success: true,
            message: 'Document uploaded successfully',
            url: `/uploads/kyc/${fileName}`
        });
    } catch (error) {
        console.error('Error uploading KYC:', error);
        res.status(500).json({ success: false, message: 'Failed to upload document', error: error.message });
    }
};

const attachFinalOfferLetter = async (req, res) => {
    try {
        const { candidateId } = req.body;
        const candidate = await Candidate.findByPk(candidateId);
        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No offer letter file provided' });
        }

        const uploadDir = path.join(__dirname, '..', 'uploads', 'offers');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const fileName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;
        const filePath = path.join(uploadDir, fileName);
        
        fs.writeFileSync(filePath, req.file.buffer);

        await candidate.update({
            offerLetterUrl: `/uploads/offers/${fileName}`,
            offerLetterFileName: req.file.originalname,
            stage: 'Offer Sent',
            status: 'Selected'
        });

        res.status(200).json({ 
            success: true, 
            message: 'Final offer letter attached and candidate status updated successfully', 
            data: candidate 
        });
    } catch (error) {
        console.error('Error attaching offer letter:', error);
        res.status(500).json({ success: false, message: 'Failed to attach offer letter', error: error.message });
    }
};

const firebaseAdmin = require('../utils/firebaseAdmin');

const generateCandidateCredentials = async (req, res) => {
    try {
        const { candidateId } = req.body;
        const candidate = await Candidate.findByPk(candidateId);
        
        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        if (!candidate.email) {
            return res.status(400).json({ success: false, message: 'Candidate email is required for credential generation' });
        }

        // Check if credentials already generated (one-time only)
        if (candidate.username && candidate.password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Credentials already generated for this candidate',
                data: {
                    email: candidate.email,
                    username: candidate.username,
                    alreadyGenerated: true
                }
            });
        }

        // Generate a random 8-character password
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let password = "";
        for (let i = 0; i < 8; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }

        // Generate a unique username based on name
        const baseUsername = candidate.name.toLowerCase().replace(/\s+/g, '').slice(0, 10);
        const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 4 digit random
        const username = `${baseUsername}${randomSuffix}`;

        const hashedPassword = await hashPassword(password);

        // --- FIREBASE INTEGRATION ---
        let firebaseUid = null;
        try {
            if (firebaseAdmin.apps.length) {
                // Try to create or update user in Firebase Auth
                let userRecord;
                try {
                    userRecord = await firebaseAdmin.auth().getUserByEmail(candidate.email);
                    // Update password if user exists
                    await firebaseAdmin.auth().updateUser(userRecord.uid, {
                        password: password,
                        displayName: candidate.name
                    });
                    console.log(`[FIREBASE] Updated existing user: ${candidate.email}`);
                } catch (authError) {
                    if (authError.code === 'auth/user-not-found') {
                        userRecord = await firebaseAdmin.auth().createUser({
                            email: candidate.email,
                            password: password,
                            displayName: candidate.name,
                            emailVerified: false
                        });
                        console.log(`[FIREBASE] Created new user: ${candidate.email}`);
                    } else {
                        throw authError;
                    }
                }
                firebaseUid = userRecord.uid;
            }
        } catch (firebaseError) {
            console.error('[FIREBASE] Sync failed:', firebaseError.message);
            // We continue with local DB update even if Firebase fails
        }

        // Save credentials to database
        try {
            console.log(`[ONBOARDING] Saving credentials to DB for candidate ID: ${candidate.id}`);
            await candidate.update({
                password: hashedPassword,
                username: username,
                rawPassword: password,
                bgvStatus: 'Sent',
                firebaseUid: firebaseUid // Save the UID if generated
            });
            console.log(`[ONBOARDING] ✅ Database update successful for ${candidate.name}`);
        } catch (dbError) {
            console.error('[ONBOARDING] ❌ Database update FAILED:', dbError.message);
            throw dbError;
        }

        // Debug Log
        console.log(`[ONBOARDING] Generated Credentials for ${candidate.name}:`);
        console.log(`Email: ${candidate.email}`);
        console.log(`Username: ${username}`);
        console.log(`Password: ${password}`);
        
        // Send Email
        try {
            const htmlContent = `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; padding: 40px; border-radius: 16px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h2 style="color: #1B4DA0; margin: 0; font-size: 24px; letter-spacing: -0.5px;">Mabicons ERP</h2>
                        <p style="color: #64748b; font-size: 14px; margin-top: 5px;">Candidate Onboarding Gateway</p>
                    </div>
                    
                    <p style="font-size: 16px;">Hi <strong>${candidate.name}</strong>,</p>
                    
                    <p>Congratulations! Your recruitment process has moved to the next stage. We have generated your secure access credentials for the Mabicons ERP portal.</p>
                    
                    <div style="background-color: #f8fafc; padding: 25px; border-radius: 12px; margin: 25px 0; border: 1px solid #cbd5e1;">
                        <p style="margin: 0 0 15px 0; font-size: 14px; color: #64748b; font-weight: 600; text-transform: uppercase; tracking: 1px;">Access Details</p>
                        <p style="margin: 8px 0; font-size: 15px;"><strong>Portal Link:</strong> <a href="http://localhost:5173/candidate-dashboard" style="color: #1B4DA0; text-decoration: none; font-weight: bold;">Click here to Login</a></p>
                        <p style="margin: 8px 0; font-size: 15px;"><strong>Candidate ID:</strong> <span style="font-weight: bold; color: #1B4DA0; background: #eef2ff; padding: 2px 6px; rounded: 4px;">${username}</span></p>
                        <p style="margin: 8px 0; font-size: 15px;"><strong>Password:</strong> <span style="font-family: 'Courier New', Courier, monospace; font-weight: bold; font-size: 16px; color: #1B4DA0; background: #eef2ff; padding: 2px 6px; rounded: 4px;">${password}</span></p>
                    </div>
                    
                    <p style="font-size: 14px; color: #64748b;">Please use these credentials to log in and complete your background verification (BGV) and other onboarding tasks.</p>
                    
                    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                        <p style="margin: 0; font-size: 14px; font-weight: bold; color: #1a1a2e;">Mabicons Recruitment Team</p>
                        <p style="margin: 5px 0 0 0; font-size: 12px; color: #94a3b8;">This is an automated message, please do not reply.</p>
                    </div>
                </div>
            `;

            await sendEmail({
                email: candidate.email,
                name: candidate.name,
                subject: 'Your Mabicons ERP Login Credentials',
                htmlContent: htmlContent
            });
        } catch (err) {
            console.error('[ONBOARDING] Email notification failed:', err.message);
        }

        res.status(200).json({ 
            success: true, 
            message: 'Credentials generated successfully',
            data: { 
                email: candidate.email,
                username: username,
                password: password 
            } 
        });

    } catch (error) {
        console.error('Error generating credentials:', error);
        res.status(500).json({ success: false, message: 'Failed to generate credentials', error: error.message });
    }
};

const loginCandidate = async (req, res) => {
    try {
        const { email, username, password } = req.body;

        if ((!email && !username) || !password) {
            return res.status(400).json({ success: false, message: 'Email/Username and password are required' });
        }

        const { Op } = require('sequelize');
        const candidate = await Candidate.findOne({ 
            where: {
                [Op.or]: [
                    email ? { email } : null,
                    username ? { username } : null
                ].filter(Boolean)
            } 
        });

        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        if (!candidate.password) {
            return res.status(401).json({ success: false, message: 'Credentials not generated for this candidate yet' });
        }

        const isPasswordValid = await comparePasswords(password, candidate.password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const payload = { 
            id: candidate.id, 
            email: candidate.email, 
            role: 'Candidate',
            name: candidate.name 
        };
        const token = generateToken(payload);
        const refreshToken = generateRefreshToken(payload);

        res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            refreshToken,
            data: {
                id: candidate.id,
                name: candidate.name,
                email: candidate.email,
                username: candidate.username,
                role: 'Candidate'
            }
        });
    } catch (error) {
        console.error('Error logging in candidate:', error);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
};

const getCandidateProfile = async (req, res) => {
    try {
        const candidateId = req.user.id;
        const candidate = await Candidate.findByPk(candidateId, {
            attributes: { exclude: ['password', 'rawPassword'] },
            include: [
                { model: RecruitmentPosition, as: 'position', attributes: ['id', 'title'] },
                { model: Client, as: 'client', attributes: ['id', 'companyName'] }
            ]
        });

        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        res.status(200).json({ success: true, data: candidate });
    } catch (error) {
        console.error('Error fetching candidate profile:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch profile' });
    }
};

const submitCandidateKYC = async (req, res) => {
    try {
        const candidateId = req.user.id;
        const candidate = await Candidate.findByPk(candidateId);
        
        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        // Add activity log entry
        console.log(`[KYC SUBMISSION] Candidate ${candidate.name} (ID: ${candidateId}) is submitting documents.`);

        await candidate.update({ 
            bgvStatus: 'KYC Submitted',
            // Optional: You could also log the timestamp in metadata if needed
        });

        res.status(200).json({ 
            success: true, 
            message: 'Profile submitted successfully for verification', 
            data: { bgvStatus: 'KYC Submitted' } 
        });
    } catch (error) {
        console.error('Error submitting KYC profile:', error);
        res.status(500).json({ success: false, message: 'Failed to submit profile', error: error.message });
    }
};

module.exports = {
    getRecruitmentClients,
    getKamsWithRecruitment,
    createRecruitmentPosition,
    updateRecruitmentPosition,
    deleteRecruitmentPosition,
    getAllPositions,
    getAllCandidates,
    addCandidate,
    getCandidateById,
    updateCandidateStatus,
    getCandidatesByPosition,
    getRecruitmentStats,
    getClientRecruitmentProgress,
    getRequests,
    uploadResumes,
    acceptCandidateSimple,
    rejectCandidateSimple,
    getShortlistedCandidates,
    getClientRequestsSimple,
    getRequestDetails,
    getRecruitmentStatusSimple,
    scheduleInterviewForRecruit,
    closeRequest,
    generateMeetLinkForInterview,
    createRequest,
    getMyPerformanceStats,
    getOffers,
    createOrUpdateOffer,
    getOfferCandidatesSuggestions,
    updateCandidate,
    deleteOffer,
    upsertOfferTemplate,
    getOfferTemplate,
    verifyCandidateKYC,
    bulkVerifyCandidateKYC,
    uploadCandidateKYC,
    submitCandidateKYC,
    attachFinalOfferLetter,
    generateCandidateCredentials,
    loginCandidate,
    getCandidateProfile
};
