const { Op, fn, col, literal } = require('sequelize');
const { TeamLeader, Client, RecruitmentPosition, Candidate, Interview } = require('../models/sequelizeModels');

// Get all KAMs (TeamLeaders) with their clients and recruitment positions
const getKamsWithRecruitment = async (req, res) => {
    try {
        const kams = await TeamLeader.findAll({
            attributes: ['id', 'name', 'email', 'phone'],
        });

        const clients = await Client.findAll({
            attributes: ['id', 'name', 'companyName', 'email', 'contactNumber', 'teamLeaderId'],
        });

        const kamsWithPositions = await Promise.all(kams.map(async (kam) => {
            const kamClients = clients.filter(c => c.teamLeaderId === kam.id);
            const clientsWithPositions = await Promise.all(kamClients.map(async (client) => {
                const positions = await RecruitmentPosition.findAll({
                    where: { clientId: client.id },
                    attributes: ['id', 'title', 'location', 'status', 'openings', 'filled', 'priority', 'deadline'],
                    order: [['createdAt', 'DESC']],
                });

                const positionsWithStats = await Promise.all(positions.map(async (position) => {
                    const sharedCVs = await Candidate.count({
                        where: { positionId: position.id, status: { [Op.in]: ['Shared', 'Shortlisted', 'Interview', 'Selected'] } }
                    });
                    const shortlisted = await Candidate.count({
                        where: { positionId: position.id, status: { [Op.in]: ['Shortlisted', 'Interview', 'Selected'] } }
                    });
                    return { ...position.toJSON(), sharedCVs, shortlisted };
                }));

                return {
                    id: client.id,
                    name: client.companyName || client.name,
                    email: client.email,
                    phone: client.contactNumber,
                    industry: 'Business',
                    logo: (client.companyName || client.name).substring(0, 2).toUpperCase(),
                    positions: positionsWithStats.map(p => ({
                        id: p.id, title: p.title, location: p.location, status: p.status,
                        openings: p.openings, filled: p.filled, priority: p.priority, deadline: p.deadline,
                        sharedCVs: p.sharedCVs, shortlisted: p.shortlisted
                    }))
                };
            }));

            return {
                id: kam.id,
                name: kam.name,
                email: kam.email,
                phone: kam.phone,
                avatar: kam.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
                clients: clientsWithPositions
            };
        }));

        res.status(200).json({ success: true, data: kamsWithPositions });
    } catch (error) {
        console.error('Error fetching KAMs with recruitment:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch KAM data', error: error.message });
    }
};

// Create a new recruitment position
const createRecruitmentPosition = async (req, res) => {
    try {
        const { title, description, location, type, salary, status, priority, openings, skills, experience, clientId, teamLeaderId, deadline } = req.body;

        const position = await RecruitmentPosition.create({
            title, description, location, type, salary, status, priority, openings,
            skills: skills || [], experience, clientId, teamLeaderId, deadline
        });

        res.status(201).json({ success: true, message: 'Position created successfully', data: position });
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
        const { name, email, phone, positionId, clientId, cvUrl, cvFileName, skills, experience, currentSalary, expectedSalary, notes, location, noticePeriod, stage, pipelineStatus, rating, source } = req.body;

        const candidate = await Candidate.create({
            name, email, phone, positionId, clientId, cvUrl, cvFileName,
            skills: skills || [], experience, currentSalary, expectedSalary, notes, location, noticePeriod,
            stage: stage || 'Screening', pipelineStatus: pipelineStatus || 'pending',
            rating: rating || 0, source, status: 'Submitted'
        });

        res.status(201).json({ success: true, message: 'Candidate added successfully', data: candidate });
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
        const [totalPositions, openPositions, holdPositions, closedPositions] = await Promise.all([
            RecruitmentPosition.count(),
            RecruitmentPosition.count({ where: { status: 'Open' } }),
            RecruitmentPosition.count({ where: { status: 'Hold' } }),
            RecruitmentPosition.count({ where: { status: 'Closed' } }),
        ]);

        const [totalCandidates, sharedCVs, shortlisted, selected] = await Promise.all([
            Candidate.count(),
            Candidate.count({ where: { status: { [Op.in]: ['Shared', 'Shortlisted', 'Interview', 'Selected'] } } }),
            Candidate.count({ where: { status: { [Op.in]: ['Shortlisted', 'Interview', 'Selected'] } } }),
            Candidate.count({ where: { status: 'Selected' } }),
        ]);

        // Pipeline stage counts
        const stageCounts = await Candidate.findAll({
            attributes: ['stage', [fn('COUNT', col('id')), 'count']],
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
            include: [{ model: Client, as: 'client', attributes: ['name', 'companyName'] }],
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
            };
        });

        res.status(200).json({ success: true, data: positionsWithStats });
    } catch (error) {
        console.error('Error fetching positions:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch positions', error: error.message });
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
        if (status) where.status = status;
        if (positionId) where.positionId = positionId;
        if (pipelineStatus) where.pipelineStatus = pipelineStatus;
        if (stage) where.stage = stage;
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
    getClientRecruitmentProgress
};
