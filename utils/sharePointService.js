/**
 * SharePoint Service for ERP Integration
 * Handles Microsoft Graph API calls to sync data from SharePoint
 */

const axios = require('axios');

// Max file size for resume downloads (25 MB)
const MAX_FILE_SIZE = 25 * 1024 * 1024;
// Allowed file extensions
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx'];
// Dangerous file extensions that should never be processed
const BLOCKED_EXTENSIONS = ['exe', 'bat', 'cmd', 'ps1', 'vbs', 'js', 'msi', 'scr', 'com', 'pif', 'hta', 'cpl', 'inf', 'reg'];

class SharePointService {
  constructor() {
    this.tenantId = process.env.SHAREPOINT_TENANT_ID;
    this.clientId = process.env.SHAREPOINT_CLIENT_ID;
    this.clientSecret = process.env.SHAREPOINT_CLIENT_SECRET;
    this.siteUrl = process.env.SHAREPOINT_SITE_URL;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  hasCredentials() {
    return !!(this.tenantId && this.clientId && this.clientSecret && this.siteUrl);
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
      resumeUrl: item.fields.Resume || item.fields.ResumeUrl || item.fields.CV || item.fields.CVUrl || item.fields.Attachments,
      cvUrl: item.fields.CV || item.fields.CVUrl || item.fields.Resume || item.fields.ResumeUrl,
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

  /* ═══════════════════════════════════════════════════════════
   * EXCEL WORKBOOK METHODS - Read Excel files from SharePoint
   * ═══════════════════════════════════════════════════════════ */

  /**
   * Search for an Excel file by name in the site's default document library
   */
  async findExcelFile(siteId, fileName) {
    const token = await this.getAccessToken();
    const drives = await this.getDrives(siteId);
    
    for (const drive of drives) {
      try {
        const searchUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${drive.id}/root/search(q='${encodeURIComponent(fileName)}')`;
        const response = await axios.get(searchUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const match = response.data.value?.find(f => 
          f.name.toLowerCase() === fileName.toLowerCase()
        );
        if (match) return { driveId: drive.id, itemId: match.id, name: match.name };
      } catch (e) { /* continue to next drive */ }
    }
    return null;
  }

  /**
   * Get all worksheet names from an Excel workbook
   */
  async getExcelWorksheets(siteId, driveId, itemId) {
    const token = await this.getAccessToken();
    const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${itemId}/workbook/worksheets`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.value.map(ws => ({ id: ws.id, name: ws.name, position: ws.position }));
  }

  /**
   * Get data from a specific worksheet (used range)
   */
  async getExcelSheetData(siteId, driveId, itemId, sheetName) {
    const token = await this.getAccessToken();
    const encodedSheet = encodeURIComponent(sheetName);
    const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${itemId}/workbook/worksheets('${encodedSheet}')/usedRange`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const raw = response.data;
    if (!raw.values || raw.values.length < 2) return { headers: [], rows: [] };
    
    // First non-empty row as headers, rest as data rows
    const headerRowIdx = raw.values.findIndex(row => row.some(cell => cell !== null && cell !== ''));
    if (headerRowIdx === -1) return { headers: [], rows: [] };
    
    const headers = raw.values[headerRowIdx].map(h => (h || '').toString().trim());
    const rows = raw.values.slice(headerRowIdx + 1)
      .filter(row => row.some(cell => cell !== null && cell !== ''))
      .map(row => {
        const obj = {};
        headers.forEach((h, i) => { if (h) obj[h] = row[i] ?? ''; });
        return obj;
      });
    
    return { headers, rows, totalRows: rows.length };
  }

  /* ═══════════════════════════════════════════════════════════
   * RESUME BANK METHODS - Sync 10,000+ resumes from SharePoint
   * ═══════════════════════════════════════════════════════════ */

  /**
   * Get all drives in the site (for finding document libraries)
   */
  async getDrives(siteId) {
    const token = await this.getAccessToken();
    
    try {
      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data.value;
    } catch (error) {
      console.error('Get Drives Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get folder contents from SharePoint drive
   */
  async getFolderContents(siteId, driveId, folderPath = 'root') {
    const token = await this.getAccessToken();
    
    try {
      let url;
      if (folderPath === 'root') {
        url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root/children`;
      } else {
        const encodedPath = folderPath.split('/').map(part => encodeURIComponent(part)).join('/');
        url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodedPath}:/children`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data.value;
    } catch (error) {
      console.error('Get Folder Contents Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get all files recursively from a folder (with pagination for large folders)
   */
  async getAllFilesRecursive(siteId, driveId, folderPath = 'root', roleType = null) {
    const token = await this.getAccessToken();
    let allFiles = [];
    
    try {
      const items = await this.getFolderContents(siteId, driveId, folderPath);
      
      for (const item of items) {
        if (item.folder) {
          // It's a folder - recurse into it
          const subFolderPath = folderPath === 'root' ? item.name : `${folderPath}/${item.name}`;
          const subFiles = await this.getAllFilesRecursive(siteId, driveId, subFolderPath, item.name);
          allFiles = allFiles.concat(subFiles);
        } else if (item.file) {
          // It's a file - check if it's a resume (PDF, DOC, DOCX)
          const ext = item.name.split('.').pop().toLowerCase();
          // Block dangerous extensions
          if (BLOCKED_EXTENSIONS.includes(ext)) continue;
          if (ALLOWED_EXTENSIONS.includes(ext)) {
            // Skip oversized files
            if (item.size > MAX_FILE_SIZE) continue;
            allFiles.push({
              sharePointId: item.id,
              driveId: driveId,
              name: item.name,
              roleType: roleType || this.extractRoleFromPath(folderPath),
              fileType: ext,
              size: item.size,
              // Do NOT expose downloadUrl — downloads go through backend proxy
              webUrl: item.webUrl,
              createdAt: item.createdDateTime,
              modifiedAt: item.lastModifiedDateTime,
              createdBy: item.createdBy?.user?.displayName,
              path: folderPath
            });
          }
        }
      }
      
      return allFiles;
    } catch (error) {
      console.error('Get Files Recursive Error:', error.response?.data || error.message);
      return allFiles; // Return what we have so far
    }
  }

  /**
   * Extract role type from folder path
   */
  extractRoleFromPath(path) {
    if (!path || path === 'root') return 'General';
    const parts = path.split('/');
    // Assume the first meaningful folder is the role type
    return parts.find(p => p && p !== 'Resumes') || 'General';
  }

  /**
   * Get all role type folders from Resumes directory
   */
  async getRoleTypeFolders(siteId, driveId, basePath = 'Resumes') {
    const token = await this.getAccessToken();
    
    try {
      const items = await this.getFolderContents(siteId, driveId, basePath);
      return items
        .filter(item => item.folder)
        .map(folder => ({
          name: folder.name,
          id: folder.id,
          path: `${basePath}/${folder.name}`,
          childCount: folder.folder.childCount || 0
        }));
    } catch (error) {
      console.error('Get Role Folders Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Sync resumes from a specific role folder
   */
  async syncResumesByRole(siteId, driveId, roleFolder) {
    return await this.getAllFilesRecursive(siteId, driveId, roleFolder.path, roleFolder.name);
  }

  /**
   * Sync ALL resumes from SharePoint (with progress callback)
   */
  async syncAllResumes(siteId, driveId, basePath = 'Resumes', progressCallback = null) {
    const allResumes = [];
    
    try {
      const roleFolders = await this.getRoleTypeFolders(siteId, driveId, basePath);
      
      for (let i = 0; i < roleFolders.length; i++) {
        const folder = roleFolders[i];
        
        if (progressCallback) {
          progressCallback({
            current: i + 1,
            total: roleFolders.length,
            currentRole: folder.name,
            resumeCount: allResumes.length
          });
        }
        
        const resumes = await this.syncResumesByRole(siteId, driveId, folder);
        allResumes.push(...resumes);
      }
      
      return {
        totalResumes: allResumes.length,
        roleTypes: [...new Set(allResumes.map(r => r.roleType))],
        resumes: allResumes
      };
    } catch (error) {
      console.error('Sync All Resumes Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Search resumes by name or role
   */
  async searchResumes(siteId, driveId, query) {
    const token = await this.getAccessToken();
    
    try {
      // Sanitize query: remove special chars that could manipulate the OData query
      const sanitizedQuery = query.replace(/['";\\<>{}()]/g, '').substring(0, 100);
      if (!sanitizedQuery || sanitizedQuery.length < 2) {
        throw new Error('Search query must be at least 2 characters');
      }

      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root/search(q='${encodeURIComponent(sanitizedQuery)}')`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Filter only resume files
      return response.data.value
        .filter(item => {
          const ext = item.name?.split('.').pop()?.toLowerCase();
          return ['pdf', 'doc', 'docx'].includes(ext);
        })
        .filter(item => {
          // Block oversized and dangerous files
          const ext2 = item.name?.split('.').pop()?.toLowerCase();
          return !BLOCKED_EXTENSIONS.includes(ext2) && item.size <= MAX_FILE_SIZE;
        })
        .map(item => ({
          sharePointId: item.id,
          driveId: driveId,
          name: item.name,
          roleType: this.extractRoleFromPath(item.parentReference?.path),
          fileType: item.name.split('.').pop().toLowerCase(),
          size: item.size,
          // Do NOT expose downloadUrl — downloads go through backend proxy
          webUrl: item.webUrl,
          createdAt: item.createdDateTime,
          modifiedAt: item.lastModifiedDateTime,
          path: item.parentReference?.path
        }));
    } catch (error) {
      console.error('Search Resumes Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get file download URL (internal use only — never expose raw URL to client)
   */
  async getFileDownloadUrl(siteId, driveId, fileId) {
    const token = await this.getAccessToken();
    
    try {
      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${fileId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Validate file before returning URL
      const fileName = response.data.name || '';
      const ext = fileName.split('.').pop().toLowerCase();
      if (BLOCKED_EXTENSIONS.includes(ext)) {
        throw new Error('This file type is blocked for security reasons');
      }
      if (response.data.size > MAX_FILE_SIZE) {
        throw new Error('File exceeds maximum allowed size');
      }

      return response.data['@microsoft.graph.downloadUrl'];
    } catch (error) {
      console.error('Get Download URL Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Proxy file download — streams content through backend instead of exposing raw URL
   */
  async proxyFileDownload(siteId, driveId, fileId) {
    const downloadUrl = await this.getFileDownloadUrl(siteId, driveId, fileId);
    
    const response = await axios.get(downloadUrl, {
      responseType: 'stream',
      maxContentLength: MAX_FILE_SIZE,
    });

    return response;
  }

  /**
   * Get attachments for a SharePoint list item
   */
  async getListItemAttachments(siteId, listId, itemId) {
    const token = await this.getAccessToken();
    
    try {
      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${itemId}/attachments`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data.value;
    } catch (error) {
      console.error('Get List Item Attachments Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get download URL for a list item attachment
   */
  async getAttachmentDownloadUrl(siteId, listId, itemId, attachmentName) {
    const token = await this.getAccessToken();
    
    try {
      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${itemId}/attachments/${attachmentName}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data['@microsoft.graph.downloadUrl'];
    } catch (error) {
      console.error('Get Attachment Download URL Error:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new SharePointService();
