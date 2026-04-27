require('dotenv').config();
const { SuperAdmin } = require('./models/sequelizeModels');
async function check() {
  const existing = await SuperAdmin.findOne({ where: { email: 'ashwin.mabicons@gmail.com' } });
  console.log(existing ? 'Found: ' + existing.email : 'Not found');
  process.exit();
}
check();
