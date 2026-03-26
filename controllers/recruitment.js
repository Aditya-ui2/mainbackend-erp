const { TeamLeader, Client, RecruitmentPosition, Candidate, Interview } = require('../models/models');

// Get all KAMs (TeamLeaders) with their clients and recruitment positions
const getKamsWithRecruitment = async (req, res) => {
    try {
        const kams = await TeamLeader.find()
            .select('name email phone')
            .populate({
                path: 'clients',
                select: 'name companyName email contactNumber',
            })
            .lean();

        // For each KAM's client, get their recruitment positions
        const kamsWithPositions = await Promise.all(kams.map(async (kam) => {
            const clientsWithPositions = await Promise.all((kam.clients || []).map(async (client) => {
                const positions = await RecruitmentPosition.find({ client: client._id })
                    .select('title location status openings filled priority deadline')
                    .lean();

                // Get candidate stats for each position
                const positionsWithStats = await Promise.all(positions.map(async (position) => {
                    const sharedCVs = await Candidate.countDocuments({ 
                        position: position._id, 
                        status: { $in: ['Shared', 'Shortlisted', 'Interview', 'Selected'] }
                    });
                    const shortlisted = await Candidate.countDocuments({ 
                        position: position._id, 
                        status: { $in: ['Shortlisted', 'Interview', 'Selected'] }
                    });

                    return {
                        ...position,
                        sharedCVs,
                        shortlisted
                    };
                }));

                return {
                    id: client._id,
                    name: client.companyName || client.name,
                    email: client.email,
                    phone: client.contactNumber,
                    industry: 'Business', // TODO: Add industry field to client model
                    logo: (client.companyName || client.name).substring(0, 2).toUpperCase(),
                    positions: positionsWithStats.map(p => ({
                        id: p._id,
                        title: p.title,
                        location: p.location,
                        status: p.status,
                        openings: p.openings,
                        filled: p.filled,
                        priority: p.priority,
                        deadline: p.deadline,
                        sharedCVs: p.sharedCVs,
                        shortlisted: p.shortlisted
                    }))
                };
            }));

            return {
                id: kam._id,
                name: kam.name,
                email: kam.email,
                phone: kam.phone,
                avatar: kam.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
                clients: clientsWithPositions
            };
        }));

        res.status(200).json({ 
            success: true, 
            data: kamsWithPositions 
        });
    } catch (error) {
        console.error('Error fetching KAMs with recruitment:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch KAM data', 
            error: error.message 
        });
    }
};

// Create a new recruitment position
const createRecruitmentPosition = async (req, res) => {
    try {
        const { 
            title, 
            description, 
            location, 
            type, 
            salary, 
            status, 
            priority, 
            openings, 
            skills, 
            experience, 
            clientId, 
            teamLeaderId,
            deadline 
        } = req.body;

        const position = new RecruitmentPosition({
            title,
            description,
            location,
            type,
            salary,
            status,
            priority,
            openings,
            skills,
            experience,
            client: clientId,
            teamLeader: teamLeaderId,
            deadline
        });

        await position.save();

        res.status(201).json({ 
            success: true, 
            message: 'Position created successfully', 
            data: position 
        });
    } catch (error) {
        console.error('Error creating recruitment position:', error);
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
        const updates = req.body;

        const position = await RecruitmentPosition.findByIdAndUpdate(
            id, 
            updates, 
            { new: true }
        );

        if (!position) {
            return res.status(404).json({ 
                success: false, 
                message: 'Position not found' 
            });
        }

        res.status(200).json({ 
            success: true, 
            message: 'Position updated successfully', 
            data: position 
        });
    } catch (error) {
        console.error('Error updating recruitment position:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update position', 
            error: error.message 
        });
    }
};

// Add a candidate
const addCandidate = async (req, res) => {
    try {
        const { 
            name, 
            email, 
            phone, 
            positionId, 
            clientId, 
            cvUrl, 
            cvFileName, 
            skills, 
            experience, 
            currentSalary, 
            expectedSalary,
            notes,
            location,
            noticePeriod,
            stage,
            pipelineStatus,
            rating,
            source
        } = req.body;

        const candidate = new Candidate({
            name,
            email,
            phone,
            position: positionId,
            client: clientId,
            cvUrl,
            cvFileName,
            skills,
            experience,
            currentSalary,
            expectedSalary,
            notes,
            location,
            noticePeriod,
            stage: stage || 'Screening',
            pipelineStatus: pipelineStatus || 'pending',
            rating: rating || 0,
            source,
            status: 'Submitted'
        });

        await candidate.save();

        res.status(201).json({ 
            success: true, 
            message: 'Candidate added successfully', 
            data: candidate 
        });
    } catch (error) {
        console.error('Error adding candidate:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to add candidate', 
            error: error.message 
        });
    }
};

// Update candidate status (share CV, shortlist, etc.)
const updateCandidateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, stage, pipelineStatus, rejectionReason, interviewDate, notes, rating } = req.body;

        const updateData = {};
        
        if (status) {
            updateData.status = status;
            if (status === 'Shared') {
                updateData.sharedAt = new Date();
            } else if (status === 'Shortlisted') {
                updateData.shortlistedAt = new Date();
            } else if (status === 'Interview' && interviewDate) {
                updateData.interviewDate = interviewDate;
            }
        }
        
        if (stage) updateData.stage = stage;
        if (pipelineStatus) updateData.pipelineStatus = pipelineStatus;
        if (rejectionReason) updateData.rejectionReason = rejectionReason;
        if (notes) updateData.notes = notes;
        if (rating !== undefined) updateData.rating = rating;

        const candidate = await Candidate.findByIdAndUpdate(
            id, 
            updateData, 
            { new: true }
        ).populate('position', 'title');

        if (!candidate) {
            return res.status(404).json({ 
                success: false, 
                message: 'Candidate not found' 
            });
        }

        // If selected, update filled count on position
        if (status === 'Selected') {
            await RecruitmentPosition.findByIdAndUpdate(
                candidate.position._id,
                { $inc: { filled: 1 } }
            );
        }

        res.status(200).json({ 
            success: true, 
            message: 'Candidate status updated', 
            data: candidate 
        });
    } catch (error) {
        console.error('Error updating candidate status:', error);
        res.status(500).json({ 
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
        const { status } = req.query;

        const query = { position: positionId };
        if (status) query.status = status;

        const candidates = await Candidate.find(query)
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({ 
            success: true, 
            data: candidates 
        });
    } catch (error) {
        console.error('Error fetching candidates:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch candidates', 
            error: error.message 
        });
    }
};

// Get recruitment stats (for dashboard)
const getRecruitmentStats = async (req, res) => {
    try {
        const totalPositions = await RecruitmentPosition.countDocuments();
        const openPositions = await RecruitmentPosition.countDocuments({ status: 'Open' });
        const holdPositions = await RecruitmentPosition.countDocuments({ status: 'Hold' });
        const closedPositions = await RecruitmentPosition.countDocuments({ status: 'Closed' });
        
        const totalCandidates = await Candidate.countDocuments();
        const sharedCVs = await Candidate.countDocuments({ 
            status: { $in: ['Shared', 'Shortlisted', 'Interview', 'Selected'] }
        });
        const shortlisted = await Candidate.countDocuments({ 
            status: { $in: ['Shortlisted', 'Interview', 'Selected'] }
        });
        const selected = await Candidate.countDocuments({ status: 'Selected' });

        // Pipeline stage counts for funnel
        const screeningCount = await Candidate.countDocuments({ stage: 'Screening' });
        const phoneInterviewCount = await Candidate.countDocuments({ stage: 'Phone Interview' });
        const technicalCount = await Candidate.countDocuments({ stage: 'Technical Round' });
        const hrRoundCount = await Candidate.countDocuments({ stage: 'HR Round' });
        const clientInterviewCount = await Candidate.countDocuments({ stage: 'Client Interview' });
        const offerSentCount = await Candidate.countDocuments({ stage: 'Offer Sent' });
        const joinedCount = await Candidate.countDocuments({ stage: 'Joined' });
        const rejectedCount = await Candidate.countDocuments({ stage: 'Rejected' });

        // Position-wise metrics
        const positions = await RecruitmentPosition.find()
            .populate('client', 'companyName name')
            .lean();
        const positionMetrics = await Promise.all(positions.slice(0, 10).map(async (pos) => {
            const candidateCount = await Candidate.countDocuments({ position: pos._id });
            const filledCount = await Candidate.countDocuments({ position: pos._id, stage: 'Joined' });
            return {
                position: pos.title,
                openings: pos.openings || 1,
                filled: filledCount,
                total: candidateCount,
            };
        }));

        // Client-wise metrics
        const clientGroups = {};
        positions.forEach(pos => {
            const clientName = pos.client?.companyName || pos.client?.name || 'Unknown';
            if (!clientGroups[clientName]) clientGroups[clientName] = { openings: 0, positions: [] };
            clientGroups[clientName].openings += (pos.openings || 1);
            clientGroups[clientName].positions.push(pos._id);
        });
        const clientMetrics = await Promise.all(Object.entries(clientGroups).map(async ([client, data]) => {
            const filledCount = await Candidate.countDocuments({ position: { $in: data.positions }, stage: 'Joined' });
            return { client, openings: data.openings, filled: filledCount };
        }));

        res.status(200).json({ 
            success: true, 
            data: {
                positions: {
                    total: totalPositions,
                    open: openPositions,
                    hold: holdPositions,
                    closed: closedPositions
                },
                candidates: {
                    total: totalCandidates,
                    sharedCVs,
                    shortlisted,
                    selected
                },
                funnel: {
                    screening: screeningCount,
                    phoneInterview: phoneInterviewCount,
                    technical: technicalCount,
                    hrRound: hrRoundCount,
                    clientInterview: clientInterviewCount,
                    offerSent: offerSentCount,
                    joined: joinedCount,
                    rejected: rejectedCount,
                },
                positionMetrics,
                clientMetrics,
            }
        });
    } catch (error) {
        console.error('Error fetching recruitment stats:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch stats', 
            error: error.message 
        });
    }
};

// Get all recruitment positions with filtering
const getAllPositions = async (req, res) => {
    try {
        const { status, priority, client, search, sortBy, sortOrder } = req.query;
        
        const query = {};
        if (status) query.status = status;
        if (priority) query.priority = priority;
        if (client) query.client = client;
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { location: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ];
        }

        const sortOptions = {};
        if (sortBy) {
            sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
        } else {
            sortOptions.createdAt = -1;
        }

        const positions = await RecruitmentPosition.find(query)
            .populate('client', 'name companyName')
            .sort(sortOptions)
            .lean();

        // Get candidate counts using aggregation instead of N+1 queries
        const positionIds = positions.map(p => p._id);
        const [candidateCounts, filledCounts] = await Promise.all([
            Candidate.aggregate([
                { $match: { position: { $in: positionIds } } },
                { $group: { _id: '$position', count: { $sum: 1 } } }
            ]),
            Candidate.aggregate([
                { $match: { position: { $in: positionIds }, status: 'Selected' } },
                { $group: { _id: '$position', count: { $sum: 1 } } }
            ])
        ]);

        const candidateCountMap = {};
        candidateCounts.forEach(c => { candidateCountMap[c._id.toString()] = c.count; });
        const filledCountMap = {};
        filledCounts.forEach(c => { filledCountMap[c._id.toString()] = c.count; });

        const positionsWithStats = positions.map(pos => ({
            ...pos,
            candidateCount: candidateCountMap[pos._id.toString()] || 0,
            filled: filledCountMap[pos._id.toString()] || 0,
            clientName: pos.client?.companyName || pos.client?.name || 'Unknown',
            clientLogo: (pos.client?.companyName || pos.client?.name || 'NA').substring(0, 2).toUpperCase(),
        }));

        res.status(200).json({
            success: true,
            data: positionsWithStats
        });
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
        await Candidate.deleteMany({ position: id });

        const position = await RecruitmentPosition.findByIdAndDelete(id);
        if (!position) {
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

        const query = {};
        if (status) query.status = status;
        if (positionId) query.position = positionId;
        if (pipelineStatus) query.pipelineStatus = pipelineStatus;
        if (stage) query.stage = stage;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [candidates, total] = await Promise.all([
            Candidate.find(query)
                .populate('position', 'title')
                .populate('client', 'companyName name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Candidate.countDocuments(query)
        ]);

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

        // Get all positions for this client
        const positions = await RecruitmentPosition.find({ client: clientId })
            .select('title location type status priority openings filled deadline createdAt')
            .sort({ createdAt: -1 })
            .lean();

        const positionIds = positions.map(p => p._id);

        // Get all candidates and interview stats in parallel using aggregation
        const [candidates, candidateStages, interviewStats, interviews] = await Promise.all([
            Candidate.find({ client: clientId })
                .select('name stage pipelineStatus position createdAt updatedAt')
                .populate('position', 'title')
                .sort({ createdAt: -1 })
                .lean(),
            Candidate.aggregate([
                { $match: { client: require('mongoose').Types.ObjectId(clientId) } },
                { $group: { _id: '$stage', count: { $sum: 1 } } }
            ]),
            Interview.aggregate([
                { $match: { position: { $in: positionIds } } },
                {
                    $facet: {
                        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
                        upcoming: [
                            { $match: { status: 'Scheduled', interviewDate: { $gte: new Date() } } },
                            { $sort: { interviewDate: 1 } },
                            { $limit: 10 },
                            {
                                $lookup: {
                                    from: 'candidates', localField: 'candidate', foreignField: '_id',
                                    as: 'candidateInfo', pipeline: [{ $project: { name: 1 } }]
                                }
                            },
                            {
                                $lookup: {
                                    from: 'recruitmentpositions', localField: 'position', foreignField: '_id',
                                    as: 'positionInfo', pipeline: [{ $project: { title: 1 } }]
                                }
                            },
                            {
                                $project: {
                                    candidateName: { $arrayElemAt: ['$candidateInfo.name', 0] },
                                    positionTitle: { $arrayElemAt: ['$positionInfo.title', 0] },
                                    interviewDate: 1, startTime: 1, interviewType: 1, status: 1
                                }
                            }
                        ]
                    }
                }
            ]),
            Interview.countDocuments({ position: { $in: positionIds } })
        ]);

        // Build stage funnel
        const stageFunnel = {};
        candidateStages.forEach(s => { stageFunnel[s._id] = s.count; });

        // Build position summaries with candidate counts using aggregation results
        const candidatesByPosition = {};
        candidates.forEach(c => {
            const posId = c.position?._id?.toString();
            if (posId) {
                if (!candidatesByPosition[posId]) candidatesByPosition[posId] = 0;
                candidatesByPosition[posId]++;
            }
        });

        const positionSummaries = positions.map(p => ({
            id: p._id,
            title: p.title,
            location: p.location,
            type: p.type,
            status: p.status,
            priority: p.priority,
            openings: p.openings || 1,
            filled: p.filled || 0,
            candidateCount: candidatesByPosition[p._id.toString()] || 0,
            deadline: p.deadline,
            postedDate: p.createdAt,
        }));

        const interviewData = interviewStats[0] || { byStatus: [], upcoming: [] };
        const interviewStatusMap = {};
        interviewData.byStatus.forEach(s => { interviewStatusMap[s._id] = s.count; });

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalPositions: positions.length,
                    openPositions: positions.filter(p => p.status === 'Open' || p.status === 'Urgent').length,
                    totalCandidates: candidates.length,
                    inPipeline: candidates.filter(c => !['Joined', 'Rejected'].includes(c.stage)).length,
                    hired: candidates.filter(c => c.stage === 'Joined').length,
                    totalInterviews: interviews,
                    scheduledInterviews: interviewStatusMap['Scheduled'] || 0,
                    completedInterviews: interviewStatusMap['Completed'] || 0,
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
                upcomingInterviews: interviewData.upcoming,
                candidates: candidates.map(c => ({
                    id: c._id,
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
