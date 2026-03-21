// Use Sequelize model for ResumeBank
const { ResumeBank, DepartmentTeam, sequelize } = require('../models/sequelizeModels');
const s3Service = require('../utils/s3Service');
const sharePointService = require('../utils/sharePointService');
const { Op } = require('sequelize');

/**
 * Sync all resumes from AWS S3
 * POST /api/resumebank/sync
 */
const syncResumes = async (req, res) => {
    try {
        const { roleType, fullSync = false } = req.body;
        
        let result;
        
        if (roleType) {
            result = await s3Service.syncResumesByRole(roleType);
        } else {
            result = await s3Service.getAllResumes(({ processed, total, filesFound }) => {
                console.log(`Syncing S3: ${processed}/${total} folders, ${filesFound} files found`);
            });
        }
        
        const { savedResumes, errors } = await saveResumesToDB(result.files || [], 's3');
        
        res.json({
            success: true,
            message: `Synced ${savedResumes.length} resumes from S3`,
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
        res.status(500).json({ success: false, message: 'Failed to sync resumes', error: error.message });
    }
};

/**
 * Sync resumes from SharePoint
 * POST /api/resumebank/sync-sharepoint
 */
const syncSharePoint = async (req, res) => {
    try {
        const { roleType } = req.body;
        const basePath = process.env.SHAREPOINT_RESUME_PATH || 'Recruitment folders/Position wise';

        // Get site and drive info
        const siteId = await sharePointService.getSiteId();
        const drives = await sharePointService.getDrives(siteId);
        const docLib = drives.find(d => d.name === 'Documents' || d.name === 'Shared Documents');
        
        if (!docLib) {
            return res.status(404).json({ success: false, message: 'SharePoint document library not found' });
        }

        let spResumes;

        if (roleType) {
            // Sync specific role folder
            spResumes = await sharePointService.getAllFilesRecursive(siteId, docLib.id, `${basePath}/${roleType}`, roleType);
        } else {
            // Sync all resumes
            const result = await sharePointService.syncAllResumes(siteId, docLib.id, basePath, ({ current, total, currentRole, resumeCount }) => {
                console.log(`Syncing SharePoint: ${current}/${total} roles (${currentRole}), ${resumeCount} resumes found`);
            });
            spResumes = result.resumes || [];
        }

        // Convert SharePoint format to our DB format
        const files = spResumes.map(r => ({
            id: r.sharePointId,
            name: r.name,
            fileType: r.fileType,
            size: r.size,
            roleType: r.roleType || 'Uncategorized',
            folderPath: r.path,
            key: null,
            webUrl: r.webUrl,
            downloadUrl: r.downloadUrl,
            lastModified: r.modifiedAt,
            createdBy: r.createdBy,
            driveId: r.driveId
        }));

        const { savedResumes, errors } = await saveResumesToDB(files, 'sharepoint');

        res.json({
            success: true,
            message: `Synced ${savedResumes.length} resumes from SharePoint`,
            stats: {
                total: files.length,
                saved: savedResumes.length,
                created: savedResumes.filter(r => r.created).length,
                updated: savedResumes.filter(r => r.updated).length,
                errors: errors.length
            },
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Error syncing SharePoint resumes:', error);
        res.status(500).json({ success: false, message: 'Failed to sync from SharePoint', error: error.message });
    }
};

/**
 * Helper: save resume list to database
 */
async function saveResumesToDB(files, source) {
    const savedResumes = [];
    const errors = [];

    for (const resume of files) {
        try {
            const existingResume = await ResumeBank.findOne({ 
                where: { sharePointId: resume.id } 
            });
            
            const resumeData = {
                sharePointId: resume.id,
                driveId: source === 's3' ? 's3' : (resume.driveId || 'sharepoint'),
                fileName: resume.name,
                fileType: resume.fileType,
                fileSize: resume.size,
                roleType: resume.roleType || 'Uncategorized',
                folderPath: resume.folderPath,
                s3Key: source === 's3' ? resume.key : null,
                webUrl: resume.webUrl || null,
                downloadUrl: resume.downloadUrl || null,
                sharePointModifiedAt: resume.lastModified ? new Date(resume.lastModified) : null,
                sharePointCreatedBy: resume.createdBy || null,
                lastSyncedAt: new Date()
            };
            
            if (existingResume) {
                await existingResume.update(resumeData);
                savedResumes.push({ ...resumeData, updated: true });
            } else {
                await ResumeBank.create(resumeData);
                savedResumes.push({ ...resumeData, created: true });
            }
        } catch (err) {
            errors.push({ file: resume.name, error: err.message });
        }
    }
    return { savedResumes, errors };
}

/**
 * Get all role types for filtering
 * GET /api/resumebank/roles
 */
const getRoleTypes = async (req, res) => {
    try {
        const roleCounts = await ResumeBank.findAll({
            attributes: [
                'roleType',
                [sequelize.fn('COUNT', sequelize.col('roleType')), 'count']
            ],
            group: ['roleType'],
            order: [[sequelize.literal('count'), 'DESC']]
        });
        
        res.json({
            success: true,
            roles: roleCounts.map(r => ({ name: r.roleType, count: parseInt(r.get('count')) }))
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
        
        const where = {};
        
        if (roleType && roleType !== 'All Roles') where.roleType = roleType;
        if (status && status !== 'All Status') where.status = status;
        if (isStarred === 'true') where.isStarred = true;
        if (assignedTo) where.assignedToId = assignedTo;
        
        // Text search
        if (search) {
            where[Op.or] = [
                { candidateName: { [Op.iLike]: `%${search}%` } },
                { fileName: { [Op.iLike]: `%${search}%` } },
                { roleType: { [Op.iLike]: `%${search}%` } }
            ];
        }
        
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const order = [[sortBy, sortOrder.toUpperCase()]];
        
        const { rows: resumes, count: total } = await ResumeBank.findAndCountAll({
            where,
            order,
            offset,
            limit: parseInt(limit)
        });
        
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
        console.error('Error getting resumes:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get single resume details
 * GET /api/resumebank/:id
 */
const getResumeById = async (req, res) => {
    try {
        const resume = await ResumeBank.findByPk(req.params.id);
            
        if (!resume) {
            return res.status(404).json({ success: false, message: 'Resume not found' });
        }
        
        res.json({ success: true, data: resume });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update resume details
 * PUT /api/resumebank/:id
 */
const updateResume = async (req, res) => {
    try {
        const { 
            candidateName, email, phone, experience, skills, 
            currentCompany, currentLocation, preferredLocation,
            currentSalary, expectedSalary, noticePeriod,
            status, tags, rating, isStarred, contactNotes,
            assignedToId, assignedPositionId
        } = req.body;
        
        const resume = await ResumeBank.findByPk(req.params.id);
        
        if (!resume) {
            return res.status(404).json({ success: false, message: 'Resume not found' });
        }
        
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
        if (assignedToId !== undefined) updateData.assignedToId = assignedToId;
        if (assignedPositionId !== undefined) updateData.assignedPositionId = assignedPositionId;
        
        await resume.update(updateData);
        
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
        
        await ResumeBank.update(
            { isStarred },
            { where: { id: { [Op.in]: resumeIds } } }
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
        
        await ResumeBank.update(
            { status },
            { where: { id: { [Op.in]: resumeIds } } }
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
        
        await ResumeBank.update(
            { 
                assignedPositionId: positionId,
                assignedToId: assignedTo || null,
                status: 'Shortlisted'
            },
            { where: { id: { [Op.in]: resumeIds } } }
        );
        
        res.json({ 
            success: true, 
            message: `Assigned ${resumeIds.length} resume(s) to position` 
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
        const resume = await ResumeBank.findByPk(req.params.id);
        
        if (!resume) {
            return res.status(404).json({ success: false, message: 'Resume not found' });
        }

        let downloadUrl;

        if (resume.driveId === 's3') {
            // S3 pre-signed URL
            downloadUrl = await s3Service.getDownloadUrl(resume.s3Key || resume.folderPath + resume.fileName);
        } else {
            // SharePoint — get fresh download URL via Graph API
            try {
                const siteId = await sharePointService.getSiteId();
                downloadUrl = await sharePointService.getFileDownloadUrl(siteId, resume.driveId, resume.sharePointId);
            } catch (spErr) {
                // Fallback to stored webUrl if Graph API fails
                downloadUrl = resume.webUrl || resume.downloadUrl;
            }
        }
        
        res.json({ success: true, downloadUrl, fileName: resume.fileName });
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
        const totalCount = await ResumeBank.count();
        
        const statusStats = await ResumeBank.findAll({
            attributes: [
                'status',
                [sequelize.fn('COUNT', sequelize.col('status')), 'count']
            ],
            group: ['status']
        });
        
        const roleStats = await ResumeBank.findAll({
            attributes: [
                'roleType',
                [sequelize.fn('COUNT', sequelize.col('roleType')), 'count']
            ],
            group: ['roleType'],
            order: [[sequelize.literal('count'), 'DESC']],
            limit: 10
        });
        
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentlyAdded = await ResumeBank.count({
            where: { createdAt: { [Op.gte]: sevenDaysAgo } }
        });
        
        res.json({
            success: true,
            stats: {
                total: totalCount,
                recentlyAdded,
                byStatus: statusStats.reduce((acc, s) => ({ 
                    ...acc, 
                    [s.status || 'Unknown']: parseInt(s.get('count')) 
                }), {}),
                topRoles: roleStats.map(r => ({ 
                    _id: r.roleType, 
                    count: parseInt(r.get('count')) 
                }))
            }
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Search resumes in S3 (without saving)
 * GET /api/resumebank/search-s3
 */
const searchS3 = async (req, res) => {
    try {
        const { query } = req.query;
        
        if (!query) {
            return res.status(400).json({ success: false, message: 'Search query required' });
        }
        
        const results = await s3Service.searchResumes(query);
        
        res.json({
            success: true,
            results
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get folder structure from S3
 * GET /api/resumebank/folders
 */
const getFolders = async (req, res) => {
    try {
        const folders = await s3Service.getRoleTypeFolders();
        
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
    syncSharePoint,
    getRoleTypes,
    getResumes,
    getResumeById,
    updateResume,
    toggleStarResumes,
    bulkUpdateStatus,
    assignToPosition,
    getDownloadUrl,
    getStats,
    searchS3,
    getFolders
};
