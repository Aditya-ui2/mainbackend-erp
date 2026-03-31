const { Op, fn, col, literal } = require('sequelize');
const { TeamLeader, Client, RecruitmentPosition, Candidate, Interview, DepartmentTask, ResumeBank, DepartmentTeam } = require('../models/sequelizeModels');
const fs = require('fs');
const path = require('path');

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

const normalizeOfferStatus = (value = '') => {
    const allowed = ['Draft', 'Pending Approval', 'Sent', 'Negotiating', 'Accepted', 'Rejected', 'Expired'];
    return allowed.includes(value) ? value : 'Draft';
};

// Get all KAMs (DepartmentTeam members) with their recruitment positions and stats
const getKamsWithRecruitment = async (req, res) => {
    try {
        // Fetch all members of the HR Recruitment department
        const kams = await DepartmentTeam.findAll({
            where: {
                department: 'HR Recruitment',
                role: { [Op.ne]: 'Department Head' }
            },
            attributes: ['id', 'name', 'email', 'phone', 'role', 'status'],
        });

        // 7-day window for "This Week Hires"
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const kamsWithStats = await Promise.all(kams.map(async (kam) => {
            try {
                const k = kam.toJSON();
                const interviewOr = buildInterviewMatchers(k);
                
                const ownedPositions = await RecruitmentPosition.findAll({
                    where: {
                        [Op.or]: [
                            { departmentTeamId: kam.id },
                            { teamLeaderId: kam.id }
                        ]
                    },
                    attributes: ['id', 'title', 'status'],
                    raw: true
                });

                const ownedPositionIds = ownedPositions.map(position => position.id);
                const ownedPositionCount = ownedPositions.filter(position => position.status === 'Open').length;

                const [totalCandidates, interviews, hires, recentActivityCandidate, profilesShared, callsDone, pendingTasks, completedTasks] = await Promise.all([
                    Candidate.count({
                        where: ownedPositionIds.length > 0
                            ? { positionId: { [Op.in]: ownedPositionIds } }
                            : { id: null }
                    }),
                    Interview.count({
                        where: {
                            [Op.and]: [
                                { [Op.or]: interviewOr },
                                { status: { [Op.ne]: 'Cancelled' } }
                            ]
                        }
                    }),
                    Candidate.count({
                        where: ownedPositionIds.length > 0
                            ? {
                                positionId: { [Op.in]: ownedPositionIds },
                                [Op.or]: [
                                    { status: 'Selected' },
                                    { stage: 'Joined' }
                                ],
                                updatedAt: { [Op.gte]: weekAgo }
                            }
                            : { id: null }
                    }),
                    Candidate.findAll({
                        where: ownedPositionIds.length > 0
                            ? { positionId: { [Op.in]: ownedPositionIds } }
                            : { id: null },
                        include: [{ 
                            model: RecruitmentPosition, 
                            as: 'position', 
                            attributes: ['title'],
                            required: false // LEFT JOIN ensures activity shows even if position is null
                        }],
                        order: [['updatedAt', 'DESC']],
                        limit: 3
                    }),
                    Candidate.count({
                        where: ownedPositionIds.length > 0
                            ? {
                                positionId: { [Op.in]: ownedPositionIds },
                                status: { [Op.in]: ['Shared', 'Shortlisted', 'Interview', 'Selected'] }
                            }
                            : { id: null }
                    }),
                    Interview.count({
                        where: {
                            [Op.and]: [
                                { [Op.or]: interviewOr },
                                { status: { [Op.ne]: 'Cancelled' } },
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
        
        if (!clientId || clientId === "") {
            return res.status(400).json({ success: false, message: 'Client ID is required' });
        }

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
    try {
        const { name, email, phone, positionId, clientId, skills, experience, currentSalary, expectedSalary, notes, location, noticePeriod, stage, pipelineStatus, rating, source } = req.body;
        
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
                    skills: Array.isArray(skills) ? skills : (skills ? skills.split(',').map(s => s.trim()) : []),
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

        const candidate = await Candidate.create({
            name, email, phone, 
            positionId: positionId || null, 
            clientId: clientId || null, 
            cvUrl, cvFileName,
            skills: Array.isArray(skills) ? skills : (skills ? skills.split(',').map(s => s.trim()) : []),
            experience, currentSalary, expectedSalary, notes, location, noticePeriod,
            stage: stage || 'Screening', pipelineStatus: pipelineStatus || 'pending',
            rating: rating || 0, source, status: 'Submitted',
            addedById: req.user?.id
        });

        res.status(201).json({ 
            success: true, 
            message: 'Candidate added successfully', 
            data: candidate,
            resumeBankSync: !!cvUrl // true if a resume was processed
        });
    } catch (error) {
        console.error('Error adding candidate:', error);
        res.status(500).json({ success: false, message: 'Failed to add candidate', error: error.message });
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

// Get candidates for a position
const getCandidatesByPosition = async (req, res) => {
    try {
        const { positionId } = req.params;
        const { status } = req.query;

        const where = { positionId };
        if (status) where.status = status;

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
        const { year, month, date } = req.query;
        
        // Build date filter for candidates and positions
        let dateFilter = {};
        if (date) {
            // Specific date filter
            const specificDate = new Date(date);
            const nextDay = new Date(specificDate);
            nextDay.setDate(nextDay.getDate() + 1);
            dateFilter = {
                createdAt: {
                    [Op.gte]: specificDate,
                    [Op.lt]: nextDay
                }
            };
        } else if (year && month) {
            // Month filter
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            dateFilter = {
                createdAt: {
                    [Op.gte]: startDate,
                    [Op.lte]: endDate
                }
            };
        } else if (year) {
            // Year filter
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year, 11, 31, 23, 59, 59);
            dateFilter = {
                createdAt: {
                    [Op.gte]: startDate,
                    [Op.lte]: endDate
                }
            };
        }
        
        const [totalPositions, openPositions, holdPositions, closedPositions] = await Promise.all([
            RecruitmentPosition.count({ where: dateFilter }),
            RecruitmentPosition.count({ where: { ...dateFilter, status: 'Open' } }),
            RecruitmentPosition.count({ where: { ...dateFilter, status: 'Hold' } }),
            RecruitmentPosition.count({ where: { ...dateFilter, status: 'Closed' } }),
        ]);

        const [totalCandidates, sharedCVs, shortlisted, selected] = await Promise.all([
            Candidate.count({ where: dateFilter }),
            Candidate.count({ where: { ...dateFilter, status: { [Op.in]: ['Shared', 'Shortlisted', 'Interview', 'Selected'] } } }),
            Candidate.count({ where: { ...dateFilter, status: { [Op.in]: ['Shortlisted', 'Interview', 'Selected'] } } }),
            Candidate.count({ where: { ...dateFilter, status: 'Selected' } }),
        ]);

        // Pipeline stage counts
        const stageCounts = await Candidate.findAll({
            attributes: ['stage', [fn('COUNT', col('id')), 'count']],
            where: dateFilter,
            group: ['stage'],
            raw: true,
        });
        const stageMap = {};
        stageCounts.forEach(s => { stageMap[s.stage] = parseInt(s.count); });

        // Position-wise metrics
        const positions = await RecruitmentPosition.findAll({
            include: [{ model: Client, as: 'client', attributes: ['companyName', 'name'] }],
            limit: 10,
        });

        const positionMetrics = await Promise.all(positions.map(async (pos) => {
            const candidateCount = await Candidate.count({ where: { positionId: pos.id } });
            const filledCount = await Candidate.count({ where: { positionId: pos.id, stage: 'Joined' } });
            return { position: pos.title, openings: pos.openings || 1, filled: filledCount, total: candidateCount };
        }));

        // Client-wise metrics
        const allPositions = await RecruitmentPosition.findAll({
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
            const filledCount = await Candidate.count({ where: { positionId: { [Op.in]: data.positionIds }, stage: 'Joined' } });
            return { client, openings: data.openings, filled: filledCount };
        }));

        res.status(200).json({
            success: true,
            data: {
                positions: { total: totalPositions, open: openPositions, hold: holdPositions, closed: closedPositions },
                candidates: { total: totalCandidates, sharedCVs, shortlisted, selected },
                funnel: {
                    screening: stageMap['Screening'] || 0, phoneInterview: stageMap['Phone Interview'] || 0,
                    technical: stageMap['Technical Round'] || 0, hrRound: stageMap['HR Round'] || 0,
                    clientInterview: stageMap['Client Interview'] || 0, offerSent: stageMap['Offer Sent'] || 0,
                    joined: stageMap['Joined'] || 0, rejected: stageMap['Rejected'] || 0,
                },
                positionMetrics,
                clientMetrics,
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
        const { status, priority, client, search, sortBy, sortOrder } = req.query;

        const where = {};
        if (status) where.status = status;
        if (priority) where.priority = priority;
        if (client) where.clientId = client;
        if (search) {
            where[Op.or] = [
                { title: { [Op.iLike]: `%${search}%` } },
                { location: { [Op.iLike]: `%${search}%` } },
                { description: { [Op.iLike]: `%${search}%` } },
            ];
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

        // Delete associated candidates first
        await Candidate.destroy({ where: { positionId: id } });

        const deleted = await RecruitmentPosition.destroy({ where: { id } });
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Position not found' });
        }

        res.status(200).json({ success: true, message: 'Position and associated candidates deleted' });
    } catch (error) {
        console.error('Error deleting position:', error);
        res.status(500).json({ success: false, message: 'Failed to delete position', error: error.message });
    }
};

// Get all candidates with filtering (for pipeline view)
const getAllCandidates = async (req, res) => {
    try {
        const { status, positionId, search, stage, pipelineStatus, page = 1, limit = 100 } = req.query;

        const where = {};
        
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
                { model: RecruitmentPosition, as: 'position', attributes: ['title'] },
                { model: Client, as: 'client', attributes: ['companyName', 'name'] },
            ],
            order: [['createdAt', 'DESC']],
            offset,
            limit: parseInt(limit),
        });

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
                [Op.or]: [
                    { name: { [Op.iLike]: `%${trimmedSearch}%` } },
                    { email: { [Op.iLike]: `%${trimmedSearch}%` } }
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
        const candidates = await Candidate.findAll({
            where: {
                [Op.or]: [
                    { stage: 'Offer Sent' },
                    { offeredCTC: { [Op.ne]: null } },
                    { offerDate: { [Op.ne]: null } },
                    { offerExpiryDate: { [Op.ne]: null } },
                    { joiningDate: { [Op.ne]: null } },
                    { negotiationNotes: { [Op.ne]: null } },
                    { offerStatus: { [Op.in]: ['Pending Approval', 'Sent', 'Negotiating', 'Accepted', 'Rejected', 'Expired'] } }
                ]
            },
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
                photo: candidate.photo || ''
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

        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found for offer creation' });
        }

        let resolvedPositionId = candidate.positionId;
        let resolvedClientId = candidate.clientId;

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

        await candidate.update({
            positionId: resolvedPositionId || candidate.positionId,
            clientId: resolvedClientId || candidate.clientId,
            offeredCTC: offeredCTC || null,
            currentSalary: currentCTC || candidate.currentSalary || null,
            joiningDate: joiningDate || null,
            offerDate: offerDate || null,
            offerExpiryDate: expiryDate || null,
            offerStatus: normalizeOfferStatus(status),
            negotiationNotes: negotiationNotes || null,
            stage: normalizeOfferStatus(status) === 'Accepted' ? 'Joined' : 'Offer Sent',
            status: normalizeOfferStatus(status) === 'Rejected' ? 'Rejected' : (normalizeOfferStatus(status) === 'Accepted' ? 'Selected' : candidate.status || 'Selected')
        });

        const refreshed = await Candidate.findByPk(candidate.id, {
            include: [
                { model: RecruitmentPosition, as: 'position', attributes: ['id', 'title'] },
                { model: Client, as: 'client', attributes: ['id', 'companyName', 'name'] }
            ]
        });

        res.status(200).json({
            success: true,
            message: 'Offer saved successfully',
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
        const { positionId, clientId } = req.body;

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

            const candidate = await Candidate.create({
                name: file.originalname.replace(/\.(pdf|doc|docx)$/i, ''),
                email: buildUploadedCandidateEmail(file.originalname),
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
                    roleType: 'Uncategorized', // Default for bulk upload
                    candidateName: candidate.name,
                    webUrl: `/uploads/resumes/${storedFileName}`
                });
                console.log('Successfully synced bulk upload with Resume Bank:', candidate.name);
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
        const { candidateId } = req.body;
        const candidate = await Candidate.findByPk(candidateId);
        if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

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
                { teamLeaderId: { [Op.in]: memberIds } }
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

module.exports = {
    getKamsWithRecruitment,
    createRecruitmentPosition,
    updateRecruitmentPosition,
    deleteRecruitmentPosition,
    getAllPositions,
    getAllCandidates,
    addCandidate,
    updateCandidateStatus,
    getCandidatesByPosition,
    getRecruitmentStats,
    getClientRecruitmentProgress,
    getMyPerformanceStats,
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
    getCandidateById,
    getOffers,
    createOrUpdateOffer,
    getOfferCandidatesSuggestions
};
