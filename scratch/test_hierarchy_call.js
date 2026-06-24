const { getAdminHierarchy } = require('../controllers/admin');

async function testHierarchyCall() {
    const req = {
        body: { adminId: '04bc9ecd-0baf-456c-9d3a-c7f2499efd25' },
        user: { role: 'administrator', email: 'admin.mabicons@gmail.com' }
    };

    const res = {
        statusCode: 200,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            console.log('--- Status Code:', this.statusCode);
            console.log('--- Response Data ---');
            console.log(JSON.stringify(data, null, 2));
        }
    };

    try {
        await getAdminHierarchy(req, res);
        process.exit(0);
    } catch (err) {
        console.error('Error during test:', err);
        process.exit(1);
    }
}

testHierarchyCall();
