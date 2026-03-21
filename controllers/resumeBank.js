const { ResumeBank, RecruitmentPosition, DepartmentTeam } = require('../models/models');
const sharePointService = require('../utils/sharePointService');

/**
 * Sync all resumes from SharePoint
 * POST /api/resumebank/sync
 */
const syncResumes = async (req, res) => {
    try {
        const { roleType, fullSync = false } = req.body;
        
        let result;
        
        if (roleType) {
            // Sync specific role folder
            result = await sharePointService.syncResumesByRole(roleType);
        } else {
            // Full sync with progress tracking
            let processedCount = 0;
            
            result = await sharePointService.syncAllResumes(({ processed, total }) => {
                processedCount = processed;
            });
        }
        
        // Process and save to database
        const savedResumes = [];
        const errors = [];
        
        for (const resume of result.files || []) {
            try {
                const existingResume = await ResumeBank.findOne({ sharePointId: resume.id });
                
                const resumeData = {
                    sharePointId: resume.id,
                    driveId: resume.driveId || result.driveId,
                    fileName: resume.name,
                    fileType: resume.name.split('.').pop().toLowerCase(),
                    fileSize: resume.size,
                    roleType: resume.roleType || 'Uncategorized',
                    subRole: resume.subRole,
                    webUrl: resume.webUrl,
                    downloadUrl: resume.downloadUrl,
                    folderPath: resume.folderPath,
                    sharePointCreatedAt: resume.createdDateTime ? new Date(resume.createdDateTime) : null,
                    sharePointModifiedAt: resume.lastModifiedDateTime ? new Date(resume.lastModifiedDateTime) : null,
                    sharePointCreatedBy: resume.createdBy?.user?.displayName,
                    lastSyncedAt: new Date()
                };
                
                if (existingResume) {
                    await ResumeBank.findByIdAndUpdate(existingResume._id, resumeData);
                    savedResumes.push({ ...resumeData, updated: true });
                } else {
                    const newResume = new ResumeBank(resumeData);
                    await newResume.save();
                    savedResumes.push({ ...resumeData, created: true });
                }
            } catch (err) {
                errors.push({ file: resume.name, error: err.message });
            }
        }
        
        res.json({
            success: true,
            message: `Synced ${savedResumes.length} resumes`,
            stats: {
                total: result.files?.length || 0,
                saved: savedResumes.length,
                created: savedResumes.filter(r => r.created).length,
                updated: savedResumes.filter(r => r.updated).length,
                errors: errors.length
            },
            errors: errors.length > 0 ? errors : undefined
        });
        
    } catch (error) {
        console.error('Error syncing resumes:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to sync resumes', 
            error: error.message 
        });
    }
};

/**
 * Get all role types for filtering
 * GET /api/resumebank/roles
 */
const getRoleTypes = async (req, res) => {
    try {
        const roles = await ResumeBank.distinct('roleType');
        const roleCounts = await ResumeBank.aggregate([
            { $group: { _id: '$roleType', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        
        res.json({
            success: true,
            roles: roleCounts.map(r => ({ name: r._id, count: r.count }))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get resumes with filters
 * GET /api/resumebank
 */
const getResumes = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            roleType, 
            status, 
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            isStarred,
            assignedTo
        } = req.query;
        
        const query = {};
        
        if (roleType) query.roleType = roleType;
        if (status) query.status = status;
        if (isStarred === 'true') query.isStarred = true;
        if (assignedTo) query.assignedTo = assignedTo;
        
        // Text search
        if (search) {
            query.$or = [
                { candidateName: { $regex: search, $options: 'i' } },
                { fileName: { $regex: search, $options: 'i' } },
                { skills: { $in: [new RegExp(search, 'i')] } },
                { roleType: { $regex: search, $options: 'i' } }
            ];
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
        
        const [resumes, total] = await Promise.all([
            ResumeBank.find(query)
                .populate('assignedTo', 'name email')
                .populate('assignedPosition', 'title clientName')
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            ResumeBank.countDocuments(query)
        ]);
        
        res.json({
            success: true,
            data: resumes,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get single resume details
 * GET /api/resumebank/:id
 */
const getResumeById = async (req, res) => {
    try {
        const resume = await ResumeBank.findById(req.params.id)
            .populate('assignedTo', 'name email')
            .populate('assignedPosition', 'title clientName');
            
        if (!resume) {
            return res.status(404).json({ success: false, message: 'Resume not found' });
        }
        
        res.json({ success: true, data: resume });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update resume details (candidate info, status, etc.)
 * PUT /api/resumebank/:id
 */
const updateResume = async (req, res) => {
    try {
        const { 
            candidateName, email, phone, experience, skills, 
            currentCompany, currentLocation, preferredLocation,
            currentSalary, expectedSalary, noticePeriod,
            status, tags, rating, isStarred, contactNotes,
            assignedTo, assignedPosition
        } = req.body;
        
        const updateData = {};
        
        if (candidateName !== undefined) updateData.candidateName = candidateName;
        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;
        if (experience !== undefined) updateData.experience = experience;
        if (skills !== undefined) updateData.skills = skills;
        if (currentCompany !== undefined) updateData.currentCompany = currentCompany;
        if (currentLocation !== undefined) updateData.currentLocation = currentLocation;
        if (preferredLocation !== undefined) updateData.preferredLocation = preferredLocation;
        if (currentSalary !== undefined) updateData.currentSalary = currentSalary;
        if (expectedSalary !== undefined) updateData.expectedSalary = expectedSalary;
        if (noticePeriod !== undefined) updateData.noticePeriod = noticePeriod;
        if (status !== undefined) updateData.status = status;
        if (tags !== undefined) updateData.tags = tags;
        if (rating !== undefined) updateData.rating = rating;
        if (isStarred !== undefined) updateData.isStarred = isStarred;
        if (contactNotes !== undefined) {
            updateData.contactNotes = contactNotes;
            updateData.lastContactedAt = new Date();
        }
        if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
        if (assignedPosition !== undefined) updateData.assignedPosition = assignedPosition;
        
        const resume = await ResumeBank.findByIdAndUpdate(
            req.params.id, 
            updateData, 
            { new: true }
        ).populate('assignedTo', 'name email')
         .populate('assignedPosition', 'title clientName');
        
        if (!resume) {
            return res.status(404).json({ success: false, message: 'Resume not found' });
        }
        
        res.json({ success: true, data: resume });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Star/unstar multiple resumes
 * POST /api/resumebank/star
 */
const toggleStarResumes = async (req, res) => {
    try {
        const { resumeIds, isStarred } = req.body;
        
        await ResumeBank.updateMany(
            { _id: { $in: resumeIds } },
            { isStarred }
        );
        
        res.json({ 
            success: true, 
            message: `${resumeIds.length} resume(s) ${isStarred ? 'starred' : 'unstarred'}` 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update status for multiple resumes
 * POST /api/resumebank/bulk-status
 */
const bulkUpdateStatus = async (req, res) => {
    try {
        const { resumeIds, status } = req.body;
        
        await ResumeBank.updateMany(
            { _id: { $in: resumeIds } },
            { status }
        );
        
        res.json({ 
            success: true, 
            message: `Updated status of ${resumeIds.length} resume(s) to ${status}` 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Assign resumes to a position
 * POST /api/resumebank/assign
 */
const assignToPosition = async (req, res) => {
    try {
        const { resumeIds, positionId, assignedTo } = req.body;
        
        const position = await RecruitmentPosition.findById(positionId);
        if (!position) {
            return res.status(404).json({ success: false, message: 'Position not found' });
        }
        
        await ResumeBank.updateMany(
            { _id: { $in: resumeIds } },
            { 
                assignedPosition: positionId,
                assignedTo: assignedTo || null,
                status: 'Shortlisted'
            }
        );
        
        res.json({ 
            success: true, 
            message: `Assigned ${resumeIds.length} resume(s) to ${position.title}` 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get download URL for a resume
 * GET /api/resumebank/:id/download
 */
const getDownloadUrl = async (req, res) => {
    try {
        const resume = await ResumeBank.findById(req.params.id);
        
        if (!resume) {
            return res.status(404).json({ success: false, message: 'Resume not found' });
        }
        
        // Get fresh download URL from SharePoint
        const downloadUrl = await sharePointService.getFileDownloadUrl(resume.driveId, resume.sharePointId);
        
        res.json({ 
            success: true, 
            downloadUrl,
            fileName: resume.fileName
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get resume statistics
 * GET /api/resumebank/stats
 */
const getStats = async (req, res) => {
    try {
        const [
            totalCount,
            statusStats,
            roleStats,
            recentlyAdded
        ] = await Promise.all([
            ResumeBank.countDocuments(),
            ResumeBank.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            ResumeBank.aggregate([
                { $group: { _id: '$roleType', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),
            ResumeBank.countDocuments({
                createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            })
        ]);
        
        res.json({
            success: true,
            stats: {
                total: totalCount,
                recentlyAdded,
                byStatus: statusStats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
                topRoles: roleStats
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Search resumes in SharePoint (without saving)
 * GET /api/resumebank/search-sharepoint
 */
const searchSharePoint = async (req, res) => {
    try {
        const { query } = req.query;
        
        if (!query) {
            return res.status(400).json({ success: false, message: 'Search query required' });
        }
        
        const results = await sharePointService.searchResumes(query);
        
        res.json({
            success: true,
            results
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get folder structure from SharePoint
 * GET /api/resumebank/folders
 */
const getFolders = async (req, res) => {
    try {
        const folders = await sharePointService.getRoleTypeFolders();
        
        res.json({
            success: true,
            folders
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    syncResumes,
    getRoleTypes,
    getResumes,
    getResumeById,
    updateResume,
    toggleStarResumes,
    bulkUpdateStatus,
    assignToPosition,
    getDownloadUrl,
    getStats,
    searchSharePoint,
    getFolders
};
