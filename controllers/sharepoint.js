/**
 * SharePoint Controller
 * Handles API endpoints for SharePoint integration
 */

const sharePointService = require('../utils/sharePointService');

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
  try {
    const siteId = await getSiteId();
    const listName = req.query.listName || 'Candidates';
    
    const candidates = await sharePointService.syncCandidates(siteId, listName);
    auditLog('SYNC_CANDIDATES', req.user, { listName, count: candidates.length });
    
    res.status(200).json({
      success: true,
      message: `Synced ${candidates.length} candidates from SharePoint`,
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
  try {
    const siteId = await getSiteId();
    const listName = req.query.listName || 'Interviews';
    
    const interviews = await sharePointService.syncInterviews(siteId, listName);
    auditLog('SYNC_INTERVIEWS', req.user, { listName, count: interviews.length });
    
    res.status(200).json({
      success: true,
      message: `Synced ${interviews.length} interviews from SharePoint`,
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
  try {
    const siteId = await getSiteId();
    const listName = req.query.listName || 'Clients';
    
    const clients = await sharePointService.syncClients(siteId, listName);
    auditLog('SYNC_CLIENTS', req.user, { listName, count: clients.length });
    
    res.status(200).json({
      success: true,
      message: `Synced ${clients.length} clients from SharePoint`,
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
  try {
    const siteId = await getSiteId();
    
    const [candidates, interviews, clients] = await Promise.all([
      sharePointService.syncCandidates(siteId, 'Candidates').catch(() => []),
      sharePointService.syncInterviews(siteId, 'Interviews').catch(() => []),
      sharePointService.syncClients(siteId, 'Clients').catch(() => []),
    ]);

    auditLog('SYNC_ALL', req.user, {
      candidates: candidates.length,
      interviews: interviews.length,
      clients: clients.length
    });
    
    res.status(200).json({
      success: true,
      message: 'Full sync completed',
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
