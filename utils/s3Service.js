/**
 * AWS S3 Service for Resume Bank
 * Handles S3 operations to sync resumes from S3 bucket
 */

const AWS = require('aws-sdk');
const path = require('path');

class S3Service {
  constructor() {
    this.configured = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    
    if (this.configured) {
      this.s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'ap-south-1'
      });
    } else {
      console.warn('AWS S3 Service not configured - Missing credentials in .env');
      this.s3 = null;
    }
    
    this.bucketName = process.env.AWS_S3_RESUME_BUCKET || 'mabicons-resumes';
  }

  hasCredentials() {
    return this.configured;
  }

  /**
   * List all folders (role types) in the bucket root
   */
  async getRoleTypeFolders() {
    try {
      const params = {
        Bucket: this.bucketName,
        Delimiter: '/',
        Prefix: ''
      };

      const response = await this.s3.listObjectsV2(params).promise();
      
      const folders = (response.CommonPrefixes || []).map(prefix => ({
        name: prefix.Prefix.replace('/', ''),
        path: prefix.Prefix
      }));

      return folders;
    } catch (error) {
      console.error('Error getting role folders:', error);
      throw error;
    }
  }

  /**
   * Get all files in a specific folder (role type)
   */
  async getFilesInFolder(folderPath) {
    try {
      const files = [];
      let continuationToken = null;

      do {
        const params = {
          Bucket: this.bucketName,
          Prefix: folderPath,
          ContinuationToken: continuationToken
        };

        const response = await this.s3.listObjectsV2(params).promise();
        
        const folderFiles = (response.Contents || [])
          .filter(item => {
            const ext = path.extname(item.Key).toLowerCase();
            return ['.pdf', '.doc', '.docx'].includes(ext) && item.Key !== folderPath;
          })
          .map(item => ({
            id: Buffer.from(item.Key).toString('base64'),
            key: item.Key,
            name: path.basename(item.Key),
            size: item.Size,
            lastModified: item.LastModified,
            roleType: folderPath.replace('/', ''),
            folderPath: folderPath,
            fileType: path.extname(item.Key).toLowerCase().replace('.', ''),
            eTag: item.ETag
          }));

        files.push(...folderFiles);
        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      return files;
    } catch (error) {
      console.error('Error getting files in folder:', error);
      throw error;
    }
  }

  /**
   * Get all resumes from all role folders
   */
  async getAllResumes(progressCallback) {
    try {
      const folders = await this.getRoleTypeFolders();
      const allFiles = [];
      let processed = 0;

      for (const folder of folders) {
        const files = await this.getFilesInFolder(folder.path);
        allFiles.push(...files);
        processed++;
        
        if (progressCallback) {
          progressCallback({
            processed,
            total: folders.length,
            currentFolder: folder.name,
            filesFound: allFiles.length
          });
        }
      }

      return {
        files: allFiles,
        totalFolders: folders.length,
        totalFiles: allFiles.length
      };
    } catch (error) {
      console.error('Error getting all resumes:', error);
      throw error;
    }
  }

  /**
   * Sync resumes from a specific role folder
   */
  async syncResumesByRole(roleType) {
    try {
      const folderPath = roleType.endsWith('/') ? roleType : `${roleType}/`;
      const files = await this.getFilesInFolder(folderPath);
      
      return {
        roleType,
        files,
        count: files.length
      };
    } catch (error) {
      console.error('Error syncing role:', error);
      throw error;
    }
  }

  /**
   * Get a pre-signed URL for downloading a resume
   */
  async getDownloadUrl(fileKey, expiresIn = 3600) {
    if (!this.s3) {
      throw new Error('S3 client not configured');
    }
    try {
      const params = {
        Bucket: this.bucketName,
        Key: fileKey,
        Expires: expiresIn, // URL expires in 1 hour by default
        ResponseContentDisposition: 'inline'
      };

      const url = await this.s3.getSignedUrlPromise('getObject', params);
      return url;
    } catch (error) {
      console.error('Error generating download URL:', error);
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileKey) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: fileKey
      };

      const response = await this.s3.headObject(params).promise();
      return {
        size: response.ContentLength,
        lastModified: response.LastModified,
        contentType: response.ContentType,
        eTag: response.ETag
      };
    } catch (error) {
      console.error('Error getting file metadata:', error);
      throw error;
    }
  }

  /**
   * Search resumes by filename pattern
   */
  async searchResumes(query) {
    try {
      const result = await this.getAllResumes();
      const searchLower = query.toLowerCase();
      
      const matches = result.files.filter(file => 
        file.name.toLowerCase().includes(searchLower) ||
        file.roleType.toLowerCase().includes(searchLower)
      );

      return matches;
    } catch (error) {
      console.error('Error searching resumes:', error);
      throw error;
    }
  }

  /**
   * Upload a resume to S3
   */
  async uploadResume(file, roleType) {
    try {
      const key = `${roleType}/${Date.now()}_${file.originalname}`;
      
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          'original-name': file.originalname,
          'uploaded-at': new Date().toISOString()
        }
      };

      const result = await this.s3.upload(params).promise();
      
      return {
        key: result.Key,
        location: result.Location,
        bucket: this.bucketName
      };
    } catch (error) {
      console.error('Error uploading resume:', error);
      throw error;
    }
  }

  /**
   * Delete a resume from S3
   */
  async deleteResume(fileKey) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: fileKey
      };

      await this.s3.deleteObject(params).promise();
      return { success: true };
    } catch (error) {
      console.error('Error deleting resume:', error);
      throw error;
    }
  }

  /**
   * Get bucket statistics
   */
  async getBucketStats() {
    try {
      const result = await this.getAllResumes();
      const roleStats = {};
      
      result.files.forEach(file => {
        if (!roleStats[file.roleType]) {
          roleStats[file.roleType] = { count: 0, totalSize: 0 };
        }
        roleStats[file.roleType].count++;
        roleStats[file.roleType].totalSize += file.size;
      });

      return {
        totalFiles: result.files.length,
        totalFolders: result.totalFolders,
        byRole: roleStats
      };
    } catch (error) {
      console.error('Error getting bucket stats:', error);
      throw error;
    }
  }
}

module.exports = new S3Service();
