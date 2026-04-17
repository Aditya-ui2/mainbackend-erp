require("dotenv").config();
const { Sequelize } = require("sequelize");

const s = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  dialect: "postgres",
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: false
});

async function check() {
  try {
    // Check schema
    const [cols] = await s.query("SELECT column_name FROM information_schema.columns WHERE table_name='candidates' ORDER BY ordinal_position");
    console.log("Candidate Table Columns:", cols.map(c => c.column_name).join(", "));
    
    // Check any candidates with password set
    const [results] = await s.query("SELECT id, name, email, username, password FROM candidates WHERE password IS NOT NULL LIMIT 5");
    console.log("\nCandidates with password set:");
    console.log(JSON.stringify(results, null, 2));
  } catch (e) {
    console.error("Error:", e.message);
  }
  process.exit();
}

check();
