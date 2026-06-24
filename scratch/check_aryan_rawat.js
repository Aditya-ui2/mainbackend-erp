const { sequelize, Employee, DepartmentTeam } = require('../models/sequelizeModels');

async function run() {
  try {
    const employees = await Employee.findAll({
      where: { name: 'Aryan Rawat' }
    });
    console.log('Employee Records:', employees.map(emp => emp.toJSON()));

    const depts = await DepartmentTeam.findAll({
      where: { name: 'Aryan Rawat' }
    });
    console.log('DepartmentTeam Records:', depts.map(d => d.toJSON()));

  } catch (error) {
    console.error('Error querying records:', error);
  } finally {
    process.exit(0);
  }
}

run();
