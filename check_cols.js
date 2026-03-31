const { sequelize } = require('./models/sequelizeModels');
(async () => {
  try {
    const [results] = await sequelize.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'candidates'");
    console.log('Columns in candidates table:', results.map(r => r.column_name));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
