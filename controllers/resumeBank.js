// Use Sequelize model for ResumeBank
const { ResumeBank, RecruitmentPosition, DepartmentTeam, Candidate, SharePointCandidate, sequelize } = require('../models/sequelizeModels');
const s3Service = require('../utils/s3Service');
const sharePointService = require('../utils/sharePointService');
const { Op } = require('sequelize');

/**
 * Sync all resumes from AWS S3
 * POST /api/resumebank/sync
 */
const syncResumes = async (req, res) => {
    try {
        // Check if AWS credentials are configured
        if (!s3Service.hasCredentials()) {
            return res.status(400).json({ 
                success: false, 
                message: 'AWS credentials not configured in .env file. Please add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.' 
            });
        }

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
        if (!sharePointService.hasCredentials()) {
            return res.status(400).json({ 
                success: false, 
                message: 'SharePoint credentials not configured in .env file.' 
            });
        }
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
        
        let roles = roleCounts.map(r => ({ name: r.roleType, count: parseInt(r.get('count')) }));

        // If no roles in DB, provide default common roles for the dropdown
        if (roles.length === 0) {
            const defaultRoles = [
                'Software Engineer', 'Frontend Developer', 'Backend Developer', 
                'Full Stack Developer', 'HR Manager', 'Sales Executive', 
                'Marketing Manager', 'Data Analyst', 'Project Manager',
                'Business Development', 'Customer Support', 'Operations'
            ];
            roles = defaultRoles.map(name => ({ name, count: 0 }));
        }
        
        res.json({
            success: true,
            roles: roles
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

        const include = [];
        if (req.query.clientId) {
            include.push({
                model: RecruitmentPosition,
                as: 'position',
                where: { clientId: req.query.clientId },
                required: true
            });
        }
        
        // Text search
        if (search) {
            where[Op.or] = [
                { candidateName: { [Op.iLike]: `%${search}%` } },
                { fileName: { [Op.iLike]: `%${search}%` } },
                { roleType: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } },
                { phone: { [Op.iLike]: `%${search}%` } }
            ];
        }
        
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const queryOptions = {
            where,
            distinct: true,
            order: [[sortBy, sortOrder.toUpperCase()]],
            offset,
            limit: parseInt(limit)
        };

        if (include.length > 0) {
            queryOptions.include = include;
            // When joining, we must scope the order to prevent ambiguous column errors
            queryOptions.order = [[ResumeBank, sortBy, sortOrder.toUpperCase()]];
        }

        const { rows: resumes, count: total } = await ResumeBank.findAndCountAll(queryOptions);
        
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
        const { id } = req.params;
        
        // Validate UUID format to prevent database syntax errors (PostgreSQL)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            // If it's not a UUID, it might be a SharePoint ID or other identifier
            // We'll try to find it by sharePointId first before giving up
            const resumeBySp = await ResumeBank.findOne({ where: { sharePointId: id } });
            if (resumeBySp) {
                return res.json({ success: true, data: resumeBySp });
            }
            return res.status(400).json({ success: false, message: 'Invalid ID format' });
        }

        const resume = await ResumeBank.findByPk(id);
            
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
 * Get download URL for a resume (proxied through backend for security)
 * GET /api/resumebank/:id/download
 */
const getDownloadUrl = async (req, res) => {
    try {
        const { id } = req.params;
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
        
        let resume;
        if (isUUID) {
            resume = await ResumeBank.findByPk(id);
            
            // Fallback: If not found in ResumeBank by ID, it might be a Candidate ID
            if (!resume) {
                const candidate = await Candidate.findByPk(id);
                if (candidate && candidate.email) {
                    resume = await ResumeBank.findOne({ 
                        where: { email: candidate.email },
                        order: [['createdAt', 'DESC']] // Get the latest one if multiple exist
                    });
                }
            }
        }
        
        if (!resume) {
            resume = await ResumeBank.findOne({ where: { sharePointId: id } });
        }

        // --- NEW: Check SharePointCandidate table as fallback ---
        let spCandidate = null;
        if (!resume) {
            spCandidate = await SharePointCandidate.findOne({ 
                where: { 
                    [Op.or]: [
                        { sharePointId: id },
                        { email: req.query.email || '' }
                    ]
                } 
            });
            
            if (spCandidate) {
                const url = spCandidate.resumeUrl || spCandidate.cvUrl;
                
                // If it's a SharePoint Candidate, return the streaming URL
                if (url) {
                    return res.json({ 
                        success: true, 
                        downloadUrl: `/api/resumebank/${id}/view`, 
                        fileName: spCandidate.name + '_CV' 
                    });
                }

                // If it's a SharePoint Candidate but no direct URL, try to fetch attachments
                try {
                    const siteId = await sharePointService.getSiteId();
                    const lists = await sharePointService.getLists(siteId);
                    const candidateList = lists.find(l => l.displayName === 'Candidates');
                    
                    if (candidateList) {
                        const attachments = await sharePointService.getListItemAttachments(siteId, candidateList.id, spCandidate.sharePointId);
                        if (attachments && attachments.length > 0) {
                            // Take the first attachment as CV
                            const firstAttachment = attachments[0];
                            const downloadUrl = await sharePointService.getAttachmentDownloadUrl(siteId, candidateList.id, spCandidate.sharePointId, firstAttachment.name);
                            if (downloadUrl) {
                                return res.json({ success: true, downloadUrl, fileName: firstAttachment.name });
                            }
                        }
                    }

                    // Last ditch effort: search SharePoint by name if we have a "filename" in resumeUrl
                    if (url && url.includes('.') && !url.includes('/')) {
                        const searchResults = await sharePointService.searchResumes(siteId, 'root', url);
                        if (searchResults && searchResults.length > 0) {
                            const match = searchResults.find(r => r.name.toLowerCase() === url.toLowerCase()) || searchResults[0];
                            const dUrl = await sharePointService.getFileDownloadUrl(siteId, match.driveId, match.sharePointId);
                            if (dUrl) {
                                return res.json({ success: true, downloadUrl: dUrl, fileName: match.name });
                            }
                        }
                    }
                } catch (spErr) {
                    console.warn('SharePoint candidate attachment fetch failed:', spErr.message);
                }
            }
        }
        // --------------------------------------------------------

        // Final fallback by email if passed in query
        if (!resume && req.query.email) {
            resume = await ResumeBank.findOne({ 
                where: { email: req.query.email },
                order: [['createdAt', 'DESC']]
            });
        }
        
        if (!resume) {
            return res.status(404).json({ success: false, message: 'Resume record not found in bank' });
        }

        // Audit log
        console.log(JSON.stringify({
            type: 'RESUME_DOWNLOAD',
            resumeId: resume.id,
            fileName: resume.fileName,
            userId: req.user?.id,
            userRole: req.user?.role,
            timestamp: new Date().toISOString()
        }));

        let downloadUrl;

        if (resume.driveId === 's3') {
            // Check if S3 service is configured
            if (!s3Service.hasCredentials()) {
                // PREFERENCE 1: Use direct links from DB if available (either downloadUrl or webUrl)
                if (resume.downloadUrl || resume.webUrl) {
                    downloadUrl = resume.downloadUrl || resume.webUrl;
                    console.log('--- S3 Unconfigured: Using DB stored link ---');
                } else {
                    // FALLBACK: If no unique URL in DB, use the local developer sample
                    console.log('--- S3 Unconfigured: Providing local developer sample ---');
                    downloadUrl = `/uploads/resumes/1774933716922-Aditya rathore 2.pdf`;
                }
            } else {
                // S3 pre-signed URL (short-lived, auto-expires)
                try {
                   downloadUrl = await s3Service.getDownloadUrl(resume.s3Key || resume.folderPath + resume.fileName);
                } catch (s3Err) {
                   console.error('S3 download URL generation failed:', s3Err.message);
                   if (resume.downloadUrl || resume.webUrl) downloadUrl = resume.downloadUrl || resume.webUrl;
                   else throw s3Err;
                }
            }
        } else if (resume.driveId === 'local') {
            // Local file stored on the server's filesystem
            downloadUrl = resume.webUrl || resume.downloadUrl;
        } else {
            // SharePoint — get fresh download URL via Graph API
            try {
                // Check if sharepoint config exists (dummy check or just try/catch)
                const siteId = await sharePointService.getSiteId();
                downloadUrl = await sharePointService.getFileDownloadUrl(siteId, resume.driveId, resume.sharePointId);
            } catch (spErr) {
                console.warn('SharePoint download failed, checking DB columns:', spErr.message);
                // Fallback to stored webUrl or downloadUrl from DB
                if (resume.downloadUrl || resume.webUrl) {
                    downloadUrl = resume.downloadUrl || resume.webUrl;
                } else {
                    console.log('--- SharePoint Unconfigured: Providing local developer fallback ---');
                    downloadUrl = `/uploads/resumes/1774933716922-Aditya rathore 2.pdf`;
                }
            }
        }
        
        // --- ENHANCEMENT: Always use the streaming endpoint for SharePoint/S3 to ensure 'inline' headers ---
        if (resume.driveId === 'sharepoint' || resume.driveId === 's3' || !downloadUrl.startsWith('/uploads')) {
             downloadUrl = `/api/resumebank/${resume.id}/view`;
        }

        if (!downloadUrl) {
            return res.status(404).json({ success: false, message: 'Download URL not available for this profile' });
        }

        // Encode the URL if it's a local path to handle spaces and special characters
        if (downloadUrl.startsWith('/uploads/')) {
            // Split path to only encode the filename part while keeping the slashes
            downloadUrl = downloadUrl.split('/').map(part => encodeURIComponent(part)).join('/');
            // Fix the leading slash which got encoded to %2F or removed
            if (!downloadUrl.startsWith('/')) downloadUrl = '/' + downloadUrl;
        }

        res.json({ success: true, downloadUrl, fileName: resume.fileName });
    } catch (error) {
        console.error('Resume download failed:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error while retrieving resume',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined 
        });
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

/**
 * Deep search resumes in SharePoint (searches inside file content)
 * GET /api/resumebank/deep-search
 */
const deepSearchSharePoint = async (req, res) => {
    try {
        const { query } = req.query;
        
        if (!query) {
            return res.status(400).json({ success: false, message: 'Search query required' });
        }

        const siteId = await sharePointService.getSiteId();
        const drives = await sharePointService.getDrives(siteId);
        const docLib = drives.find(d => d.name === 'Documents' || d.name === 'Shared Documents');
        
        if (!docLib) {
            return res.status(404).json({ success: false, message: 'SharePoint document library not found' });
        }

        const results = await sharePointService.searchResumes(siteId, docLib.id, query);
        
        // Map SharePoint results to existing database records if possible
        const sharePointIds = results.map(r => r.sharePointId);
        const dbRecords = await ResumeBank.findAll({
            where: { sharePointId: { [Op.in]: sharePointIds } }
        });

        res.json({
            success: true,
            results: dbRecords.length > 0 ? dbRecords : results
        });
    } catch (error) {
        console.error('Deep search error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const streamResume = async (req, res) => {
    try {
        const { id } = req.params;
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
        
        let resume;
        if (isUUID) {
            resume = await ResumeBank.findByPk(id);
        }
        
        if (!resume) {
            resume = await ResumeBank.findOne({ where: { sharePointId: id } });
        }

        if (!resume && req.query.email) {
            resume = await ResumeBank.findOne({ 
                where: { email: req.query.email },
                order: [['createdAt', 'DESC']]
            });
        }
        
        if (!resume) {
            return res.status(404).send('Resume not found');
        }

        if (resume.driveId === 's3') {
            if (!s3Service.hasCredentials()) {
                const localPath = `/uploads/resumes/1774933716922-Aditya rathore 2.pdf`;
                return res.redirect(localPath);
            }
            const downloadUrl = await s3Service.getDownloadUrl(resume.s3Key || resume.folderPath + resume.fileName);
            return res.redirect(downloadUrl);
        } else if (resume.driveId === 'local') {
            const localPath = resume.webUrl || resume.downloadUrl;
            return res.redirect(localPath);
        } else {
            // SharePoint - Proxy the download to force inline disposition
            try {
                const siteId = await sharePointService.getSiteId();
                const spResponse = await sharePointService.proxyFileDownload(siteId, resume.driveId, resume.sharePointId);
                
                const isDownload = req.query.download === 'true';
                res.setHeader('Content-Type', spResponse.headers['content-type'] || 'application/pdf');
                res.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="${resume.fileName}"`);
                
                spResponse.data.pipe(res);
            } catch (spErr) {
                console.error('SharePoint streaming failed:', spErr.message);
                if (resume.webUrl || resume.downloadUrl) {
                    return res.redirect(resume.webUrl || resume.downloadUrl);
                }
                res.status(500).send('Failed to stream resume from SharePoint');
            }
        }
    } catch (error) {
        console.error('Resume streaming error:', error.message);
        res.status(500).send('Internal server error');
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
    streamResume, // Added
    getStats,
    searchS3,
    getFolders,
    deepSearchSharePoint
};
