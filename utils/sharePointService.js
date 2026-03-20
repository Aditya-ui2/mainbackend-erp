/**
 * SharePoint Service for ERP Integration
 * Handles Microsoft Graph API calls to sync data from SharePoint
 */

const axios = require('axios');

class SharePointService {
  constructor() {
    this.tenantId = process.env.SHAREPOINT_TENANT_ID;
    this.clientId = process.env.SHAREPOINT_CLIENT_ID;
    this.clientSecret = process.env.SHAREPOINT_CLIENT_SECRET;
    this.siteUrl = process.env.SHAREPOINT_SITE_URL;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get access token using client credentials flow
   */
  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const tokenEndpoint = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
      
      const params = new URLSearchParams();
      params.append('client_id', this.clientId);
      params.append('client_secret', this.clientSecret);
      params.append('scope', 'https://graph.microsoft.com/.default');
      params.append('grant_type', 'client_credentials');

      const response = await axios.post(tokenEndpoint, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      this.accessToken = response.data.access_token;
      // Set expiry 5 minutes before actual expiry
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;
      
      return this.accessToken;
    } catch (error) {
      console.error('SharePoint Auth Error:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with SharePoint');
    }
  }

  /**
   * Get SharePoint Site ID
   */
  async getSiteId() {
    const token = await this.getAccessToken();
    
    try {
      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/sites/${this.siteUrl}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data.id;
    } catch (error) {
      console.error('Get Site ID Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get all lists from SharePoint site
   */
  async getLists(siteId) {
    const token = await this.getAccessToken();
    
    try {
      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data.value;
    } catch (error) {
      console.error('Get Lists Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get items from a specific SharePoint list
   */
  async getListItems(siteId, listId, selectFields = [], expandFields = []) {
    const token = await this.getAccessToken();
    
    let url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items`;
    const params = new URLSearchParams();
    
    if (selectFields.length > 0) {
      params.append('$expand', 'fields($select=' + selectFields.join(',') + ')');
    } else {
      params.append('$expand', 'fields');
    }

    if (params.toString()) {
      url += '?' + params.toString();
    }

    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data.value;
    } catch (error) {
      console.error('Get List Items Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Create item in SharePoint list
   */
  async createListItem(siteId, listId, fields) {
    const token = await this.getAccessToken();
    
    try {
      const response = await axios.post(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items`,
        { fields },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      return response.data;
    } catch (error) {
      console.error('Create List Item Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Update item in SharePoint list
   */
  async updateListItem(siteId, listId, itemId, fields) {
    const token = await this.getAccessToken();
    
    try {
      const response = await axios.patch(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${itemId}/fields`,
        fields,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      return response.data;
    } catch (error) {
      console.error('Update List Item Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Delete item from SharePoint list
   */
  async deleteListItem(siteId, listId, itemId) {
    const token = await this.getAccessToken();
    
    try {
      await axios.delete(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${itemId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return true;
    } catch (error) {
      console.error('Delete List Item Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /* ═══════════════════════════════════════════════════════════
   * RECRUITMENT SPECIFIC METHODS
   * ═══════════════════════════════════════════════════════════ */

  /**
   * Sync candidates from SharePoint list
   */
  async syncCandidates(siteId, listName = 'Candidates') {
    const lists = await this.getLists(siteId);
    const candidateList = lists.find(l => l.displayName === listName);
    
    if (!candidateList) {
      throw new Error(`List "${listName}" not found in SharePoint`);
    }

    const items = await this.getListItems(siteId, candidateList.id);
    
    // Transform SharePoint data to app format
    return items.map(item => ({
      sharePointId: item.id,
      name: item.fields.Title || item.fields.CandidateName,
      email: item.fields.Email,
      phone: item.fields.Phone,
      position: item.fields.Position,
      client: item.fields.Client,
      stage: item.fields.Stage || 'Screening',
      status: item.fields.Status || 'Active',
      assignedTo: item.fields.AssignedTo,
      notes: item.fields.Notes,
      createdAt: item.createdDateTime,
      modifiedAt: item.lastModifiedDateTime,
    }));
  }

  /**
   * Sync interviews from SharePoint list
   */
  async syncInterviews(siteId, listName = 'Interviews') {
    const lists = await this.getLists(siteId);
    const interviewList = lists.find(l => l.displayName === listName);
    
    if (!interviewList) {
      throw new Error(`List "${listName}" not found in SharePoint`);
    }

    const items = await this.getListItems(siteId, interviewList.id);
    
    return items.map(item => ({
      sharePointId: item.id,
      candidateName: item.fields.CandidateName || item.fields.Title,
      position: item.fields.Position,
      client: item.fields.Client,
      round: item.fields.Round,
      type: item.fields.InterviewType,
      date: item.fields.InterviewDate,
      time: item.fields.InterviewTime,
      interviewer: item.fields.Interviewer,
      status: item.fields.Status || 'Scheduled',
      meetLink: item.fields.MeetLink,
      assignedTo: item.fields.AssignedTo,
      notes: item.fields.Notes,
      createdAt: item.createdDateTime,
    }));
  }

  /**
   * Sync clients from SharePoint list
   */
  async syncClients(siteId, listName = 'Clients') {
    const lists = await this.getLists(siteId);
    const clientList = lists.find(l => l.displayName === listName);
    
    if (!clientList) {
      throw new Error(`List "${listName}" not found in SharePoint`);
    }

    const items = await this.getListItems(siteId, clientList.id);
    
    return items.map(item => ({
      sharePointId: item.id,
      name: item.fields.Title || item.fields.ClientName,
      industry: item.fields.Industry,
      contactPerson: item.fields.ContactPerson,
      email: item.fields.Email,
      phone: item.fields.Phone,
      location: item.fields.Location,
      status: item.fields.Status || 'Active',
      assignedKAM: item.fields.AssignedKAM,
      openPositions: item.fields.OpenPositions || 0,
      createdAt: item.createdDateTime,
    }));
  }

  /**
   * Push candidate update to SharePoint
   */
  async updateCandidateInSharePoint(siteId, listName, sharePointId, updateData) {
    const lists = await this.getLists(siteId);
    const candidateList = lists.find(l => l.displayName === listName);
    
    if (!candidateList) {
      throw new Error(`List "${listName}" not found`);
    }

    // Transform app data to SharePoint fields
    const fields = {
      Stage: updateData.stage,
      Status: updateData.status,
      AssignedTo: updateData.assignedTo,
      Notes: updateData.notes,
    };

    return await this.updateListItem(siteId, candidateList.id, sharePointId, fields);
  }
}

module.exports = new SharePointService();
