/**
 * SharePoint Controller
 * Handles API endpoints for SharePoint integration
 * All synced data is persisted to local PostgreSQL database
 */

const sharePointService = require('../utils/sharePointService');
const { SharePointCandidate, SharePointInterview, SharePointClient, SharePointSyncLog } = require('../models/sequelizeModels');

// Store site ID in memory after first fetch
let cachedSiteId = null;

/**
 * Get Site ID and cache it
 */
const getSiteId = async () => {
  if (!cachedSiteId) {
    cachedSiteId = await sharePointService.getSiteId();
  }
  return cachedSiteId;
};

/** Safe error response — never expose internal details */
const safeError = (res, message, statusCode = 500) => {
  return res.status(statusCode).json({ success: false, message });
};

/** Audit log helper */
const auditLog = (action, user, details = {}) => {
  console.log(JSON.stringify({
    type: 'SHAREPOINT_AUDIT',
    action,
    userId: user?.id,
    userRole: user?.role,
    timestamp: new Date().toISOString(),
    ...details
  }));
};

/**
 * Helper: Upsert array of records by sharePointId
 * Returns { created, updated, errors }
 */
async function upsertBySharePointId(Model, records, fieldMapper) {
  let created = 0, updated = 0;
  const errors = [];

  for (const record of records) {
    try {
      const data = fieldMapper(record);
      const existing = await Model.findOne({ where: { sharePointId: data.sharePointId } });

      if (existing) {
        await existing.update({ ...data, lastSyncedAt: new Date() });
        updated++;
      } else {
        await Model.create({ ...data, lastSyncedAt: new Date() });
        created++;
      }
    } catch (err) {
      errors.push({ sharePointId: record.sharePointId, error: err.message });
    }
  }

  return { created, updated, errors };
}

/**
 * Helper: Log sync operation
 */
async function logSync(syncType, user, stats, startTime) {
  try {
    await SharePointSyncLog.create({
      syncType,
      status: stats.errors.length > 0 ? (stats.created + stats.updated > 0 ? 'partial' : 'failed') : 'success',
      totalFetched: stats.totalFetched || 0,
      created: stats.created || 0,
      updated: stats.updated || 0,
      errors: stats.errors.length,
      errorDetails: stats.errors.slice(0, 50), // keep max 50 error entries
      syncedById: user?.id,
      syncedByName: user?.name || user?.fullName,
      syncedByRole: user?.role,
      durationMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error('Failed to save sync log:', err.message);
  }
}

/**
 * @desc    Test SharePoint connection
 * @route   GET /api/sharepoint/test
 * @access  Private (Admin/KAM)
 */
exports.testConnection = async (req, res) => {
  try {
    const siteId = await getSiteId();
    const lists = await sharePointService.getLists(siteId);
    auditLog('TEST_CONNECTION', req.user, { siteId });
    
    res.status(200).json({
      success: true,
      message: 'SharePoint connection successful',
      data: {
        siteId,
        availableLists: lists.map(l => ({ id: l.id, name: l.displayName }))
      }
    });
  } catch (error) {
    console.error('SharePoint test connection failed:', error.message);
    safeError(res, 'SharePoint connection failed');
  }
};

/**
 * @desc    Sync candidates from SharePoint
 * @route   GET /api/sharepoint/sync/candidates
 * @access  Private (Admin/KAM)
 */
exports.syncCandidates = async (req, res) => {
  const startTime = Date.now();
  try {
    const siteId = await getSiteId();
    const listName = req.query.listName || 'Candidates';
    
    const candidates = await sharePointService.syncCandidates(siteId, listName);

    // Save to database
    const result = await upsertBySharePointId(SharePointCandidate, candidates, (c) => ({
      sharePointId: c.sharePointId,
      name: c.name,
      email: c.email,
      phone: c.phone,
      position: c.position,
      client: c.client,
      stage: c.stage,
      status: c.status,
      assignedTo: c.assignedTo,
      notes: c.notes,
      sharePointCreatedAt: c.createdAt ? new Date(c.createdAt) : null,
      sharePointModifiedAt: c.modifiedAt ? new Date(c.modifiedAt) : null,
    }));

    const stats = { totalFetched: candidates.length, ...result };
    await logSync('candidates', req.user, stats, startTime);
    auditLog('SYNC_CANDIDATES', req.user, { listName, ...stats });
    
    res.status(200).json({
      success: true,
      message: `Synced ${candidates.length} candidates from SharePoint`,
      stats: { total: candidates.length, created: result.created, updated: result.updated, errors: result.errors.length },
      data: candidates
    });
  } catch (error) {
    console.error('Sync candidates failed:', error.message);
    safeError(res, 'Failed to sync candidates');
  }
};

/**
 * @desc    Sync interviews from SharePoint
 * @route   GET /api/sharepoint/sync/interviews
 * @access  Private (Admin/KAM)
 */
exports.syncInterviews = async (req, res) => {
  const startTime = Date.now();
  try {
    const siteId = await getSiteId();
    const listName = req.query.listName || 'Interviews';
    
    const interviews = await sharePointService.syncInterviews(siteId, listName);

    // Save to database
    const result = await upsertBySharePointId(SharePointInterview, interviews, (i) => ({
      sharePointId: i.sharePointId,
      candidateName: i.candidateName,
      position: i.position,
      client: i.client,
      round: i.round,
      interviewType: i.type,
      interviewDate: i.date ? new Date(i.date) : null,
      interviewTime: i.time,
      interviewer: i.interviewer,
      status: i.status,
      meetLink: i.meetLink,
      assignedTo: i.assignedTo,
      notes: i.notes,
      sharePointCreatedAt: i.createdAt ? new Date(i.createdAt) : null,
    }));

    const stats = { totalFetched: interviews.length, ...result };
    await logSync('interviews', req.user, stats, startTime);
    auditLog('SYNC_INTERVIEWS', req.user, { listName, ...stats });
    
    res.status(200).json({
      success: true,
      message: `Synced ${interviews.length} interviews from SharePoint`,
      stats: { total: interviews.length, created: result.created, updated: result.updated, errors: result.errors.length },
      data: interviews
    });
  } catch (error) {
    console.error('Sync interviews failed:', error.message);
    safeError(res, 'Failed to sync interviews');
  }
};

/**
 * @desc    Sync clients from SharePoint
 * @route   GET /api/sharepoint/sync/clients
 * @access  Private (Admin/KAM)
 */
exports.syncClients = async (req, res) => {
  const startTime = Date.now();
  try {
    const siteId = await getSiteId();
    const listName = req.query.listName || 'Clients';
    
    const clients = await sharePointService.syncClients(siteId, listName);

    // Save to database
    const result = await upsertBySharePointId(SharePointClient, clients, (c) => ({
      sharePointId: c.sharePointId,
      name: c.name,
      industry: c.industry,
      contactPerson: c.contactPerson,
      email: c.email,
      phone: c.phone,
      location: c.location,
      status: c.status,
      assignedKAM: c.assignedKAM,
      openPositions: c.openPositions,
      sharePointCreatedAt: c.createdAt ? new Date(c.createdAt) : null,
    }));

    const stats = { totalFetched: clients.length, ...result };
    await logSync('clients', req.user, stats, startTime);
    auditLog('SYNC_CLIENTS', req.user, { listName, ...stats });
    
    res.status(200).json({
      success: true,
      message: `Synced ${clients.length} clients from SharePoint`,
      stats: { total: clients.length, created: result.created, updated: result.updated, errors: result.errors.length },
      data: clients
    });
  } catch (error) {
    console.error('Sync clients failed:', error.message);
    safeError(res, 'Failed to sync clients');
  }
};

/**
 * @desc    Sync all recruitment data from SharePoint
 * @route   POST /api/sharepoint/sync/all
 * @access  Private (Admin/KAM)
 */
exports.syncAll = async (req, res) => {
  const startTime = Date.now();
  try {
    const siteId = await getSiteId();
    
    const [candidates, interviews, clients] = await Promise.all([
      sharePointService.syncCandidates(siteId, 'Candidates').catch(() => []),
      sharePointService.syncInterviews(siteId, 'Interviews').catch(() => []),
      sharePointService.syncClients(siteId, 'Clients').catch(() => []),
    ]);

    // Save all to database in parallel
    const [candResult, intResult, clientResult] = await Promise.all([
      upsertBySharePointId(SharePointCandidate, candidates, (c) => ({
        sharePointId: c.sharePointId, name: c.name, email: c.email, phone: c.phone,
        position: c.position, client: c.client, stage: c.stage, status: c.status,
        assignedTo: c.assignedTo, notes: c.notes,
        sharePointCreatedAt: c.createdAt ? new Date(c.createdAt) : null,
        sharePointModifiedAt: c.modifiedAt ? new Date(c.modifiedAt) : null,
      })),
      upsertBySharePointId(SharePointInterview, interviews, (i) => ({
        sharePointId: i.sharePointId, candidateName: i.candidateName, position: i.position,
        client: i.client, round: i.round, interviewType: i.type,
        interviewDate: i.date ? new Date(i.date) : null, interviewTime: i.time,
        interviewer: i.interviewer, status: i.status, meetLink: i.meetLink,
        assignedTo: i.assignedTo, notes: i.notes,
        sharePointCreatedAt: i.createdAt ? new Date(i.createdAt) : null,
      })),
      upsertBySharePointId(SharePointClient, clients, (c) => ({
        sharePointId: c.sharePointId, name: c.name, industry: c.industry,
        contactPerson: c.contactPerson, email: c.email, phone: c.phone,
        location: c.location, status: c.status, assignedKAM: c.assignedKAM,
        openPositions: c.openPositions,
        sharePointCreatedAt: c.createdAt ? new Date(c.createdAt) : null,
      })),
    ]);

    const allErrors = [...candResult.errors, ...intResult.errors, ...clientResult.errors];
    const stats = {
      totalFetched: candidates.length + interviews.length + clients.length,
      created: candResult.created + intResult.created + clientResult.created,
      updated: candResult.updated + intResult.updated + clientResult.updated,
      errors: allErrors,
    };
    await logSync('all', req.user, stats, startTime);

    auditLog('SYNC_ALL', req.user, {
      candidates: { fetched: candidates.length, created: candResult.created, updated: candResult.updated },
      interviews: { fetched: interviews.length, created: intResult.created, updated: intResult.updated },
      clients: { fetched: clients.length, created: clientResult.created, updated: clientResult.updated },
    });
    
    res.status(200).json({
      success: true,
      message: 'Full sync completed — all data saved to database',
      stats: {
        candidates: { total: candidates.length, created: candResult.created, updated: candResult.updated, errors: candResult.errors.length },
        interviews: { total: interviews.length, created: intResult.created, updated: intResult.updated, errors: intResult.errors.length },
        clients: { total: clients.length, created: clientResult.created, updated: clientResult.updated, errors: clientResult.errors.length },
      },
      data: {
        candidates: { count: candidates.length, data: candidates },
        interviews: { count: interviews.length, data: interviews },
        clients: { count: clients.length, data: clients },
      }
    });
  } catch (error) {
    console.error('Sync all failed:', error.message);
    safeError(res, 'Failed to sync all data');
  }
};

/**
 * @desc    Push candidate update to SharePoint
 * @route   PUT /api/sharepoint/candidates/:sharePointId
 * @access  Private (Admin/KAM/Employee)
 */
exports.updateCandidate = async (req, res) => {
  try {
    const { sharePointId } = req.params;
    // Whitelist allowed update fields
    const { stage, status, assignedTo, notes } = req.body;
    const updateData = {};
    if (stage) updateData.stage = stage;
    if (status) updateData.status = status;
    if (assignedTo) updateData.assignedTo = assignedTo;
    if (notes) updateData.notes = notes;

    const siteId = await getSiteId();
    
    const result = await sharePointService.updateCandidateInSharePoint(
      siteId,
      'Candidates',
      sharePointId,
      updateData
    );

    auditLog('UPDATE_CANDIDATE', req.user, { sharePointId, fields: Object.keys(updateData) });
    
    res.status(200).json({
      success: true,
      message: 'Candidate updated in SharePoint',
      data: result
    });
  } catch (error) {
    console.error('Update candidate failed:', error.message);
    safeError(res, 'Failed to update candidate in SharePoint');
  }
};

/**
 * @desc    Get SharePoint lists
 * @route   GET /api/sharepoint/lists
 * @access  Private (Admin/KAM)
 */
exports.getLists = async (req, res) => {
  try {
    const siteId = await getSiteId();
    const lists = await sharePointService.getLists(siteId);
    auditLog('GET_LISTS', req.user);
    
    res.status(200).json({
      success: true,
      data: lists.map(l => ({
        id: l.id,
        name: l.displayName,
        description: l.description,
        itemCount: l.list?.itemCount || 0,
        createdAt: l.createdDateTime,
      }))
    });
  } catch (error) {
    console.error('Get lists failed:', error.message);
    safeError(res, 'Failed to get SharePoint lists');
  }
};

/**
 * @desc    Get items from specific SharePoint list
 * @route   GET /api/sharepoint/lists/:listId/items
 * @access  Private (Admin/KAM)
 */
exports.getListItems = async (req, res) => {
  try {
    const { listId } = req.params;
    const siteId = await getSiteId();
    
    const items = await sharePointService.getListItems(siteId, listId);
    auditLog('GET_LIST_ITEMS', req.user, { listId, count: items.length });
    
    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    console.error('Get list items failed:', error.message);
    safeError(res, 'Failed to get list items');
  }
};

// ═══════════════════════════════════════════════════════════
// LOCAL DATABASE ENDPOINTS (data saved from SharePoint)
// ═══════════════════════════════════════════════════════════

/**
 * @desc    Get saved candidates from local database
 * @route   GET /api/sharepoint/data/candidates
 * @access  Private (Admin/KAM)
 */
exports.getSavedCandidates = async (req, res) => {
  try {
    const { client, status, search, page = 1, limit = 50 } = req.query;
    const where = {};
    if (client) where.client = client;
    if (status) where.status = status;
    if (search) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { position: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await SharePointCandidate.findAndCountAll({
      where,
      order: [['updatedAt', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / parseInt(limit)),
      currentPage: parseInt(page),
      data: rows,
    });
  } catch (error) {
    console.error('Get saved candidates failed:', error.message);
    safeError(res, 'Failed to get saved candidates');
  }
};

/**
 * @desc    Get saved interviews from local database
 * @route   GET /api/sharepoint/data/interviews
 * @access  Private (Admin/KAM)
 */
exports.getSavedInterviews = async (req, res) => {
  try {
    const { client, status, page = 1, limit = 50 } = req.query;
    const where = {};
    if (client) where.client = client;
    if (status) where.status = status;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await SharePointInterview.findAndCountAll({
      where,
      order: [['interviewDate', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / parseInt(limit)),
      currentPage: parseInt(page),
      data: rows,
    });
  } catch (error) {
    console.error('Get saved interviews failed:', error.message);
    safeError(res, 'Failed to get saved interviews');
  }
};

/**
 * @desc    Get saved clients from local database
 * @route   GET /api/sharepoint/data/clients
 * @access  Private (Admin/KAM)
 */
exports.getSavedClients = async (req, res) => {
  try {
    const { status, search } = req.query;
    const where = {};
    if (status) where.status = status;
    if (search) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { contactPerson: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const clients = await SharePointClient.findAll({
      where,
      order: [['updatedAt', 'DESC']],
    });

    res.status(200).json({ success: true, count: clients.length, data: clients });
  } catch (error) {
    console.error('Get saved clients failed:', error.message);
    safeError(res, 'Failed to get saved clients');
  }
};

/**
 * @desc    Get sync history logs
 * @route   GET /api/sharepoint/sync-logs
 * @access  Private (SuperAdmin/Admin)
 */
exports.getSyncLogs = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const logs = await SharePointSyncLog.findAll({
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
    });

    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    console.error('Get sync logs failed:', error.message);
    safeError(res, 'Failed to get sync logs');
  }
};
