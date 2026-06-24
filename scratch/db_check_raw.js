const { Client } = require('pg');
require('dotenv').config();

async function checkDB() {
    const client = new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
    });

    try {
        await client.connect();
        console.log('✅ Connected to PostgreSQL');

        const tables = ['clients', 'candidates', 'super_admins', 'admins', 'team_leaders', 'employees'];
        
        for (const table of tables) {
            try {
                const res = await client.query(`SELECT count(*) FROM "${table}"`);
                console.log(`Table "${table}": ${res.rows[0].count} rows`);
            } catch (e) {
                console.log(`Table "${table}": DOES NOT EXIST or error: ${e.message}`);
            }
        }

    } catch (err) {
        console.error('❌ Connection error', err.stack);
    } finally {
        await client.end();
    }
}

checkDB();
