
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const sequelize = new Sequelize(process.env.DB_NAME || 'mabicons_erp', process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST || 'localhost',
  dialect: 'postgres',
  logging: false,
});

const ResumeBank = sequelize.define('ResumeBank', {
  id: { type: DataTypes.UUID, primaryKey: true },
  fileName: { type: DataTypes.STRING },
  candidateName: { type: DataTypes.STRING }
}, { tableName: 'ResumeBanks', timestamps: true });

async function fixNames() {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB');

    const resumes = await ResumeBank.findAll({
      attributes: ['id', 'fileName']
    });

    console.log(`Processing ${resumes.length} resumes...`);
    let updatedCount = 0;

    for (const resume of resumes) {
      const fileName = resume.fileName;
      if (!fileName) continue;

      let name = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
      
      // Pattern 1: Naukri_Name[Exp]
      if (name.startsWith('Naukri_')) {
        name = name.replace(/^Naukri_/, "");
        name = name.split('[')[0];
        // Sometimes it's Naukri_Role_Name[Exp]
        const parts = name.split('_');
        if (parts.length >= 2) {
            // Check if first part is a known role or common prefix
            name = parts[parts.length - 1];
        }
      } 
      // Pattern 2: 1234_Role_Name
      else {
        const parts = name.split('_');
        if (parts.length >= 3) {
          name = parts[parts.length - 1];
        } else if (parts.length === 2) {
          if (/^\d+$/.test(parts[0])) {
            name = parts[1];
          }
        }
      }

      const cleanName = name.trim();
      if (cleanName && cleanName !== resume.candidateName) {
        await ResumeBank.update({ candidateName: cleanName }, { where: { id: resume.id } });
        updatedCount++;
      }
    }

    console.log(`Success! Fixed ${updatedCount} names.`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

fixNames();
