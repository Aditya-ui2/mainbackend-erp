// In googleDriveServices.js
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { Readable } = require('stream');

// Configuration object loaded from environment variables
const config = {
  CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground',
  REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN
};

const isConfigured = !!(config.CLIENT_ID && config.CLIENT_SECRET && config.REFRESH_TOKEN);

if (!isConfigured) {
  console.warn('⚠️  Google Drive credentials are missing. Google Drive features will be disabled.');
  console.warn('   Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in .env file.');
}

// Initialize Google Drive API
const initializeDrive = () => {
  if (!isConfigured) return null;
  
  const oauth2Client = new google.auth.OAuth2(
    config.CLIENT_ID,
    config.CLIENT_SECRET,
    config.REDIRECT_URI
  );

  oauth2Client.setCredentials({ refresh_token: config.REFRESH_TOKEN });

  return google.drive({
    version: 'v3',
    auth: oauth2Client,
  });
};

const drive = initializeDrive();

const checkDriveConfigured = () => {
  if (!isConfigured || !drive) {
    throw new Error('Google Drive is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in .env file.');
  }
};

const getOrCreateFolder = async (name, parentFolderId = null) => {
  checkDriveConfigured();
  try {
    let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    if (parentFolderId) {
      query += ` and '${parentFolderId}' in parents`;
    }

    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (response.data.files.length > 0) {
      return response.data.files[0].id;
    }

    const folder = await drive.files.create({
      resource: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : [],
      },
      fields: 'id',
    });

    return folder.data.id;
  } catch (error) {
    console.error('Error in getOrCreateFolder:', error);
    throw new Error(`Failed to setup folder: ${error.message}`);
  }
};

const updateFilePermissions = async (fileId, role = 'reader', type = 'anyone') => {
  checkDriveConfigured();
  try {
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: role,
        type: type,
      },
    });
    return true;
  } catch (error) {
    console.error('Error updating file permissions:', error);
    throw error;
  }
};

const uploadFile = async (fileObject) => {
  try {
    if (!fileObject || !fileObject.buffer) {
      throw new Error('Invalid file object');
    }

    const uploadDir = path.join(__dirname, '..', 'uploads', 'chat');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const safeFileName = `${Date.now()}-${fileObject.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(uploadDir, safeFileName);

    // Save file locally
    fs.writeFileSync(filePath, fileObject.buffer);

    const formattedSize = formatFileSize(fileObject.size);

    return {
      fileId: safeFileName,
      fileName: safeFileName,
      originalName: fileObject.originalname,
      fileType: fileObject.mimetype,
      webViewLink: `/uploads/chat/${safeFileName}`,
      downloadLink: `/uploads/chat/${safeFileName}`,
      fileSize: fileObject.size,
      formattedSize: formattedSize,
      uploadDate: new Date().toISOString(),
      mimeType: fileObject.mimetype
    };
  } catch (error) {
    console.error('Error saving file locally:', error);
    throw new Error('Failed to save file locally');
  }
};

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};



// Helper function to get file extension
const getFileExtension = (filename) => {
  return path.extname(filename).toLowerCase();
};

// Helper function to check if file is an image
const isImage = (mimeType) => {
  return mimeType.startsWith('image/');
};

module.exports = {
  drive,
  isConfigured,
  getOrCreateFolder,
  updateFilePermissions,
  uploadFile
};




// const uploadFile = async (filePath, mimeType) => {
//   try {
//       if (!fs.existsSync(filePath)) {
//           throw new Error('File does not exist');
//       }

//       const response = await drive.files.create({
//           requestBody: {
//               name: path.basename(filePath),
//               mimeType: mimeType,
//           },
//           media: {
//               mimeType: mimeType,
//               body: fs.createReadStream(filePath),
//           },
//       });

//       return response.data;
//   } catch (error) {
//       console.error('Error uploading file:', error.message);
//       throw error;
//   }
// };

// const deleteFile = async (fileId) => {
//   try {
//       await drive.files.delete({ fileId });
//       return true;
//   } catch (error) {
//       console.error('Error deleting file:', error.message);
//       throw error;
//   }
// };

// const getFileLink = async (fileId) => {
//   try {
//       // Set file permissions to public
//       await drive.permissions.create({
//           fileId: fileId,
//           requestBody: {
//               role: 'reader',
//               type: 'anyone',
//           },
//       });

//       // Get file links
//       const result = await drive.files.get({
//           fileId: fileId,
//           fields: 'webViewLink, webContentLink, id',
//       });

//       return {
//           webViewLink: result.data.webViewLink,
//           webContentLink: result.data.webContentLink,
//           directLink: `https://drive.google.com/uc?id=${result.data.id}`,
//       };
//   } catch (error) {
//       console.error('Error getting file links:', error.message);
//       throw error;
//   }
// };

// const uploadFileToDrive = async (folderId, file) => {
//   try {
//       if (!file || !file.filepath) {
//           throw new Error('Invalid file object');
//       }

//       const fileMetadata = {
//           name: file.originalFilename || 'unnamed-file',
//           parents: [folderId],
//       };

//       const media = {
//           mimeType: file.mimetype,
//           body: fs.createReadStream(file.filepath),
//       };

//       const response = await drive.files.create({
//           resource: fileMetadata,
//           media,
//           fields: 'id',
//       });

//       return response.data.id;
//   } catch (error) {
//       console.error('Error uploading file to drive:', error.message);
//       throw error;
//   }
// };
