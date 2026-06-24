const { DeptDocument } = require('../models/sequelizeModels');
const sequelize = DeptDocument.sequelize;

// Emulate frontend unpackPolicy helper
const formatFileSize = (bytes) => {
  if (!bytes) return '';
  const num = Number(bytes);
  if (isNaN(num)) return bytes;
  const sizeInMB = num / (1024 * 1024);
  return sizeInMB >= 1 
    ? `${sizeInMB.toFixed(1)} MB` 
    : `${(num / 1024).toFixed(0)} KB`;
};

const unpackPolicy = (doc) => {
  let packedData = {};
  try {
    if (doc.description && doc.description.trim().startsWith('{')) {
      packedData = JSON.parse(doc.description);
    } else {
      packedData = {
        category: 'HR Management',
        description: doc.description || '',
        version: '1.0',
        effectiveFrom: new Date().toISOString().split('T')[0],
        status: 'active',
        updatedBy: 'HR Manager'
      };
    }
  } catch (e) {
    packedData = {
      category: 'HR Management',
      description: doc.description || '',
      version: '1.0',
      effectiveFrom: new Date().toISOString().split('T')[0],
      status: 'active',
      updatedBy: 'HR Manager'
    };
  }

  return {
    id: doc.id,
    title: doc.name,
    category: packedData.category,
    description: packedData.description,
    version: packedData.version,
    effectiveFrom: packedData.effectiveFrom,
    status: packedData.status,
    updatedBy: packedData.updatedBy,
    fileName: doc.fileUrl ? doc.fileUrl.split('/').pop() : '',
    fileSize: doc.fileSize ? formatFileSize(doc.fileSize) : '',
    fileUrl: doc.fileUrl,
    fileType: doc.fileType,
  };
};

async function runTest() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // 1. Pack metadata as JSON string
    const packedDescription = JSON.stringify({
      category: 'Leave Management',
      description: 'Comprehensive annual and sick leaves description content',
      version: '2.5',
      effectiveFrom: '2026-06-15',
      status: 'active',
      updatedBy: 'Lead Auditor'
    });

    // 2. Create database document representing a policy
    const doc = await DeptDocument.create({
      department: 'All', // Global policy
      name: 'Mabicons Leave Guidelines 2026',
      description: packedDescription,
      fileUrl: '/uploads/doc-123456789-leave.pdf',
      fileType: 'pdf',
      fileSize: 2097152, // 2MB in bytes
      uploadedBy: '17fd18b2-1634-4e43-a30e-fbda8bce1233', // existing tech user ID
      uploadedByName: 'Tech User',
      category: 'Policy'
    });

    console.log('✅ Created document:', doc.id);

    // 3. Retrieve documents for a user whose department is 'Management'
    // The query should return both their department-specific documents and 'All'
    const userDept = 'Management';
    const Op = sequelize.Sequelize.Op;
    
    const fetchedDocs = await DeptDocument.findAll({
      where: {
        department: {
          [Op.in]: [userDept, 'All']
        },
        category: 'Policy'
      }
    });

    console.log(`\nFound ${fetchedDocs.length} policy documents for user with department "${userDept}".`);

    // Verify our policy is in the fetched documents and unpack it
    const testDoc = fetchedDocs.find(d => d.id === doc.id);
    if (!testDoc) {
      throw new Error('Test policy document not found in fetched documents list!');
    }

    console.log('Unpacking fetched policy document...');
    const unpacked = unpackPolicy(testDoc);
    console.log('Unpacked policy details:', unpacked);

    // Assertions
    if (unpacked.title !== 'Mabicons Leave Guidelines 2026') throw new Error('Title mismatch');
    if (unpacked.category !== 'Leave Management') throw new Error('Category mismatch');
    if (unpacked.description !== 'Comprehensive annual and sick leaves description content') throw new Error('Description mismatch');
    if (unpacked.version !== '2.5') throw new Error('Version mismatch');
    if (unpacked.effectiveFrom !== '2026-06-15') throw new Error('EffectiveFrom mismatch');
    if (unpacked.status !== 'active') throw new Error('Status mismatch');
    if (unpacked.updatedBy !== 'Lead Auditor') throw new Error('UpdatedBy mismatch');
    if (unpacked.fileName !== 'doc-123456789-leave.pdf') throw new Error('FileName mismatch');
    if (unpacked.fileSize !== '2.0 MB') throw new Error(`FileSize format mismatch: expected "2.0 MB", got "${unpacked.fileSize}"`);

    console.log('\n✅ ALL INTEGRATION CHECKS PASSED.');

    // Clean up
    await doc.destroy();
    console.log('Test record cleaned up successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

runTest();
