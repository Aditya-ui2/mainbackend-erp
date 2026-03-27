const { Op } = require('sequelize');
const { TeamLeader, Client, RecruitmentPosition, Candidate } = require('../models/sequelizeModels');

// Get all KAMs (TeamLeaders) with their clients and recruitment positions
const getKamsWithRecruitment = async (req, res) => {
    try {
        const kams = await TeamLeader.findAll({
            attributes: ['id', 'name', 'email', 'phone'],
            include: [
                {
                    model: Client,
                    as: 'clients',
                    attributes: ['id', 'name', 'companyName', 'email', 'contactNumber']
                }
            ]
        });

        const kamsWithPositions = await Promise.all(kams.map(async (kam) => {
            const clientsWithPositions = await Promise.all((kam.clients || []).map(async (client) => {

                const positions = await RecruitmentPosition.findAll({
                    where: { clientId: client.id },
                    attributes: ['id', 'title', 'location', 'status', 'openings', 'filled', 'priority', 'deadline']
                });

                const positionsWithStats = await Promise.all(positions.map(async (position) => {
                    const sharedCVs = await Candidate.count({
                        where: {
                            positionId: position.id,
                            status: { [Op.in]: ['Shared', 'Shortlisted', 'Interview', 'Selected'] }
                        }
                    });

                    const shortlisted = await Candidate.count({
                        where: {
                            positionId: position.id,
                            status: { [Op.in]: ['Shortlisted', 'Interview', 'Selected'] }
                        }
                    });

                    return {
                        ...position.toJSON(),
                        sharedCVs,
                        shortlisted
                    };
                }));

                return {
                    id: client.id,
                    name: client.companyName || client.name,
                    email: client.email,
                    phone: client.contactNumber,
                    industry: 'Business',
                    logo: (client.companyName || client.name).substring(0, 2).toUpperCase(),
                    positions: positionsWithStats
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
        console.error('Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Create a new recruitment position
const createRecruitmentPosition = async (req, res) => {
    try {
        const { title, location, openings, priority, clientId, deadline } = req.body;
        if (!title || !location || !clientId) {
            return res.status(400).json({
                success: false,
                message: 'title, location and clientId are required'
            });
        }

        const client = await Client.findByPk(clientId);
        if (!client) {
            return res.status(400).json({
                success: false,
                message: 'Invalid clientId'
            });
        }

        const position = await RecruitmentPosition.create({
            title,
            location,
            openings,
            priority,
            clientId,
            deadline
        });

        res.status(201).json({
            success: true,
            message: 'Position created successfully',
            data: position
        });

    } catch (error) {
        console.error('Error creating position:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to create position',
            error: error.message
        });
    }
};

// Update recruitment position
const updateRecruitmentPosition = async (req, res) => {
    try {
        const { id } = req.params;

        await RecruitmentPosition.update(req.body, {
            where: { id }
        });

        const updated = await RecruitmentPosition.findByPk(id);

        res.status(200).json({
            success: true,
            message: 'Position updated successfully',
            data: updated
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Add a candidate
const addCandidate = async (req, res) => {
    try {
        const { positionId, clientId } = req.body;
        if (!positionId) {
            return res.status(400).json({
                success: false,
                message: 'positionId is required'
            });
        }

        const position = await RecruitmentPosition.findByPk(positionId);
        if (!position) {
            return res.status(400).json({
                success: false,
                message: 'Invalid positionId'
            });
        }

        const resolvedClientId = clientId || position.clientId;
        if (!resolvedClientId) {
            return res.status(400).json({
                success: false,
                message: 'clientId is required and could not be inferred from position'
            });
        }

        const candidate = await Candidate.create({
            name: req.body.name,
            email: req.body.email,
            phone: req.body.phone,
            positionId,
            clientId: resolvedClientId,
            cvUrl: req.body.cvUrl || req.body.resumeUrl,
            experience: req.body.experience,
            currentSalary: req.body.currentSalary || req.body.currentCTC,
            expectedSalary: req.body.expectedSalary || req.body.expectedCTC,
            noticePeriod: req.body.noticePeriod,
            status: 'Submitted'
        });

        res.status(201).json({
            success: true,
            message: 'Candidate added successfully',
            data: candidate
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update candidate status (share CV, shortlist, etc.)
const updateCandidateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const nextStatus = req.body.status;

        if (!nextStatus) {
            return res.status(400).json({ success: false, message: 'status is required' });
        }

        // Backward-compatible mapping from old docs value
        const normalizedStatus = nextStatus === 'New' ? 'Submitted' : nextStatus;
        const allowedStatuses = ['Submitted', 'Shared', 'Shortlisted', 'Interview', 'Selected', 'Rejected', 'OnHold'];

        if (!allowedStatuses.includes(normalizedStatus)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`
            });
        }

        await Candidate.update({ ...req.body, status: normalizedStatus }, {
            where: { id }
        });

        const candidate = await Candidate.findByPk(id);

        res.status(200).json({
            success: true,
            message: 'Candidate updated',
            data: candidate
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get candidates for a position
const getCandidatesByPosition = async (req, res) => {
    try {
        const { positionId } = req.params;

        const candidates = await Candidate.findAll({
            where: { positionId },
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({ success: true, data: candidates });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get recruitment stats (for dashboard)
const getRecruitmentStats = async (req, res) => {
    try {
        const totalPositions = await RecruitmentPosition.count();
        const openPositions = await RecruitmentPosition.count({ where: { status: 'Open' } });

        const totalCandidates = await Candidate.count();

        res.status(200).json({
            success: true,
            data: {
                positions: { total: totalPositions, open: openPositions },
                candidates: { total: totalCandidates }
            }
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all recruitment positions with filtering
const getAllPositions = async (req, res) => {
    try {
        const positions = await RecruitmentPosition.findAll({
            include: [{ model: Client, as: 'client', attributes: ['id', 'name', 'companyName', 'email', 'contactNumber'] }],
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            success: true,
            data: positions
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete a recruitment position
const deleteRecruitmentPosition = async (req, res) => {
    try {
        const { id } = req.params;

        await Candidate.destroy({ where: { positionId: id } });

        await RecruitmentPosition.destroy({
            where: { id }
        });

        res.status(200).json({
            success: true,
            message: 'Deleted successfully'
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all candidates with filtering (for pipeline view)
const getAllCandidates = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
        const offset = (page - 1) * limit;

        const { count: total, rows: candidates } = await Candidate.findAndCountAll({
            include: [
                {
                    model: RecruitmentPosition,
                    as: 'position',
                    attributes: ['id', 'title', 'location', 'status']
                },
                {
                    model: Client,
                    as: 'client',
                    attributes: ['id', 'name', 'companyName']
                }
            ],
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });

        res.status(200).json({
            success: true,
            data: candidates,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get recruitment progress for a specific client (client-facing read-only view)
const getClientRecruitmentProgress = async (req, res) => {
    try {
        const { clientId } = req.params;
        const client = await Client.findByPk(clientId);
        if (!client) {
            return res.status(404).json({ success: false, message: 'Client not found' });
        }

        const positions = await RecruitmentPosition.findAll({
            where: { clientId },
            order: [['createdAt', 'DESC']]
        });

        const positionIds = positions.map((p) => p.id);
        const candidates = await Candidate.findAll({
            where: { clientId },
            include: [{ model: RecruitmentPosition, as: 'position', attributes: ['id', 'title'] }],
            order: [['createdAt', 'DESC']]
        });

        const candidatesByPosition = {};
        const stageFunnel = {
            Screening: 0,
            'Phone Interview': 0,
            'Technical Round': 0,
            'HR Round': 0,
            'Client Interview': 0,
            'Offer Sent': 0,
            Joined: 0,
            Rejected: 0
        };

        candidates.forEach((c) => {
            const posId = c.positionId;
            candidatesByPosition[posId] = (candidatesByPosition[posId] || 0) + 1;
            if (stageFunnel[c.stage] !== undefined) stageFunnel[c.stage] += 1;
        });

        const positionSummaries = positions.map((p) => ({
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
            postedDate: p.createdAt
        }));

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalPositions: positions.length,
                    openPositions: positions.filter((p) => p.status === 'Open').length,
                    totalCandidates: candidates.length,
                    inPipeline: candidates.filter((c) => !['Joined', 'Rejected'].includes(c.stage)).length,
                    hired: candidates.filter((c) => c.stage === 'Joined').length,
                    totalInterviews: 0,
                    scheduledInterviews: 0,
                    completedInterviews: 0
                },
                positions: positionSummaries,
                funnel: {
                    screening: stageFunnel.Screening || 0,
                    phoneInterview: stageFunnel['Phone Interview'] || 0,
                    technical: stageFunnel['Technical Round'] || 0,
                    hrRound: stageFunnel['HR Round'] || 0,
                    clientInterview: stageFunnel['Client Interview'] || 0,
                    offerSent: stageFunnel['Offer Sent'] || 0,
                    joined: stageFunnel.Joined || 0,
                    rejected: stageFunnel.Rejected || 0
                },
                upcomingInterviews: [],
                candidates: candidates.map((c) => ({
                    id: c.id,
                    name: c.name,
                    stage: c.stage,
                    pipelineStatus: c.pipelineStatus,
                    position: c.position?.title || '',
                    updatedAt: c.updatedAt
                }))
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
