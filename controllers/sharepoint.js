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

/**
 * @desc    Test SharePoint connection
 * @route   GET /api/sharepoint/test
 * @access  Private (Admin/KAM)
 */
exports.testConnection = async (req, res) => {
  try {
    const siteId = await getSiteId();
    const lists = await sharePointService.getLists(siteId);
    
    res.status(200).json({
      success: true,
      message: 'SharePoint connection successful',
      data: {
        siteId,
        availableLists: lists.map(l => ({ id: l.id, name: l.displayName }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'SharePoint connection failed',
      error: error.message
    });
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
    
    // TODO: Save to local database
    // await Candidate.bulkCreate(candidates, { updateOnDuplicate: ['stage', 'status', 'assignedTo'] });
    
    res.status(200).json({
      success: true,
      message: `Synced ${candidates.length} candidates from SharePoint`,
      data: candidates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to sync candidates',
      error: error.message
    });
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
    
    res.status(200).json({
      success: true,
      message: `Synced ${interviews.length} interviews from SharePoint`,
      data: interviews
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to sync interviews',
      error: error.message
    });
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
    
    res.status(200).json({
      success: true,
      message: `Synced ${clients.length} clients from SharePoint`,
      data: clients
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to sync clients',
      error: error.message
    });
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
    res.status(500).json({
      success: false,
      message: 'Failed to sync all data',
      error: error.message
    });
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
    const updateData = req.body;
    const siteId = await getSiteId();
    
    const result = await sharePointService.updateCandidateInSharePoint(
      siteId,
      'Candidates',
      sharePointId,
      updateData
    );
    
    res.status(200).json({
      success: true,
      message: 'Candidate updated in SharePoint',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update candidate in SharePoint',
      error: error.message
    });
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
    res.status(500).json({
      success: false,
      message: 'Failed to get SharePoint lists',
      error: error.message
    });
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
    
    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get list items',
      error: error.message
    });
  }
};
