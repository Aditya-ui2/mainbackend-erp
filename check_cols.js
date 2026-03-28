const {sequelize}=require("./models/sequelizeModels");
sequelize.query("SELECT column_name FROM information_schema.columns WHERE table_name='interviews' ORDER BY ordinal_position")
.then(function(r){console.log(JSON.stringify(r[0].map(function(x){return x.column_name})));process.exit(0)})
.catch(function(e){console.error(e.message);process.exit(1)});
