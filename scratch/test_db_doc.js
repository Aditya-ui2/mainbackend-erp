const { DeptDocument } = require('../models/sequelizeModels');
const sequelize = DeptDocument.sequelize;

async function test() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');
        
        // Try to create a record with fileSize as an integer
        const doc = await DeptDocument.create({
            department: 'All',
            name: 'Test File Size Integer',
            fileUrl: '/uploads/test.png',
            fileType: 'png',
            fileSize: 1258291, // raw size in bytes (1.2 MB approx)
            uploadedBy: '17fd18b2-1634-4e43-a30e-fbda8bce1233', // existing tech user UUID
            uploadedByName: 'Tech User',
            category: 'Policy'
        });
        
        console.log('Document created successfully with integer fileSize:', doc.toJSON());
        
        // Clean up
        await doc.destroy();
        console.log('Test record cleaned up.');
        process.exit(0);
    } catch (error) {
        console.error('Failed to create document:', error);
        process.exit(1);
    }
}

test();
