const { TeamLeader, Client, RecruitmentPosition, Candidate } = require('../models/models');

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
            notes 
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
        const { status, interviewDate, notes } = req.body;

        const updateData = { status };
        
        if (status === 'Shared') {
            updateData.sharedAt = new Date();
        } else if (status === 'Shortlisted') {
            updateData.shortlistedAt = new Date();
        } else if (status === 'Interview' && interviewDate) {
            updateData.interviewDate = interviewDate;
        }
        
        if (notes) updateData.notes = notes;

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
                }
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

module.exports = {
    getKamsWithRecruitment,
    createRecruitmentPosition,
    updateRecruitmentPosition,
    addCandidate,
    updateCandidateStatus,
    getCandidatesByPosition,
    getRecruitmentStats
};
