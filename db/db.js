const { sequelize, DepartmentTeam, Client, TeamLeader, RecruitmentPosition } = require('../models/sequelizeModels');
const { hashPassword } = require('../utils/bcryptUtils');

const seedDepartmentTeamUsers = async () => {
    const users = [
        {
            name: 'Sachin (HR Recruitment Head)',
            email: 'recruitment.mabicons@gmail.com',
            password: 'Recruitment@123',
            phone: '+91 9876543210',
            role: 'Department Head',
            department: 'HR Recruitment',
            status: 'Active',
            skills: ['Recruitment', 'Interviewing', 'Talent Acquisition']
        },
        {
            name: 'Ramesh (HR Operations Head)',
            email: 'operation.mabicons@gmail.com',
            password: 'Operation@123',
            phone: '+91 9876543211',
            role: 'Department Head',
            department: 'HR Operations',
            status: 'Active',
            skills: ['HR Operations', 'Payroll', 'Compliance']
        }
    ];

    for (const userData of users) {
        try {
            const existing = await DepartmentTeam.findOne({ where: { email: userData.email } });

            if (!existing) {
                const hashedPassword = await hashPassword(userData.password);
                await DepartmentTeam.create({
                    ...userData,
                    password: hashedPassword
                });
                console.log(`Created department user: ${userData.email}`);
            }
        } catch (error) {
            console.error(`Error creating user ${userData.email}:`, error.message);
        }
    }
};

const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 5432,
    ssl: process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
})

pool.on('error', (err) => {
    console.error('Unexpected DB pool error:', err.message)
})

pool.connect((err, client, release) => {
    if (err) {
        console.error('DB CONNECTION FAILED:', err.message)
        console.error('Check .env: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME')
    } else {
        console.log('PostgreSQL connected successfully')
        release()
    }
})

const safeSync = async (syncFn, name, fallbackFn) => {
    try {
        await syncFn();
    } catch (e) {
        if (e && (e.name === 'SequelizeUnknownConstraintError' || e.name === 'SequelizeForeignKeyConstraintError')) {
            console.warn(`[WARN] Ignored ${e.name} during sync for ${name}:`, e.message);
            return;
        }
        if (fallbackFn) {
            console.warn(`[WARN] Sync failed for ${name}, falling back to standard sync (non-destructive):`, e.message);
            try {
                await fallbackFn();
                return;
            } catch (fallbackErr) {
                console.error(`[ERROR] Fallback sync also failed for ${name}:`, fallbackErr.message);
                throw fallbackErr;
            }
        }
        throw e;
    }
};

const dbConnect = async () => {
    try {
        await sequelize.authenticate();
        console.log("Connection established with PostgreSQL database successfully!");

        // Ensure referenced tables exist before full schema sync to avoid FK creation order issues
        await safeSync(() => DepartmentTeam.sync({ alter: true }), 'DepartmentTeam', () => DepartmentTeam.sync());
        // Before syncing clients, ensure any stale constraint drops attempted by Sequelize
        // don't fail the migration when the constraint doesn't exist. Drop if exists.
        try {
            await sequelize.query('ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_teamLeaderId_fkey";');
            console.log('Dropped clients_teamLeaderId_fkey if it existed');
        } catch (dropErr) {
            console.warn('Could not drop clients_teamLeaderId_fkey (non-fatal):', dropErr.message);
        }

        await safeSync(() => Client.sync({ alter: true }), 'Client', () => Client.sync());
        // Attempt to convert existing clients.id column to UUID if it's currently varchar
        try {
            await sequelize.query(`ALTER TABLE clients ALTER COLUMN id TYPE uuid USING (id::uuid);`);
            console.log('Converted clients.id column to UUID');
        } catch (convErr) {
            console.warn('Could not convert clients.id to UUID (may already be uuid or values not castable):', convErr.message);
        }
        await safeSync(() => TeamLeader.sync({ alter: true }), 'TeamLeader', () => TeamLeader.sync());
        // Drop any stale recruitment_positions foreign-key constraints that Sequelize
        // might attempt to DROP without IF EXISTS. This prevents UnknownConstraintError
        // during the alter flow.
        try {
            const drops = [
                'recruitment_positions_departmentTeamId_fkey',
                'recruitment_positions_assignedToId_fkey',
                'recruitment_positions_teamLeaderId_fkey',
                'recruitment_positions_clientId_fkey'
            ];
            for (const c of drops) {
                try {
                    await sequelize.query(`ALTER TABLE "recruitment_positions" DROP CONSTRAINT IF EXISTS "${c}";`);
                    console.log(`Dropped ${c} if it existed`);
                } catch (inner) {
                    console.warn(`Could not drop ${c} (non-fatal):`, inner.message);
                }
            }
        } catch (dropErr) {
            console.warn('Error while attempting to drop recruitment_positions constraints (non-fatal):', dropErr.message);
        }

        await safeSync(() => RecruitmentPosition.sync({ alter: true }), 'RecruitmentPosition', () => RecruitmentPosition.sync());

        // Sync all models (creates tables if they don't exist)
        // Use { force: true } only in development to drop and recreate tables
        // Use { alter: true } to alter existing tables to match models
        // Fall back to standard sync if index query fails due to PG dialect parser bugs
        await safeSync(() => sequelize.sync({ alter: true }), 'sequelize', () => sequelize.sync());
        console.log("All models synchronized successfully!");

        // Ensure missing columns exist in payment_requests table
        try {
            await sequelize.query('ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT;');
            await sequelize.query('ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "clientId" UUID;');
            await sequelize.query('ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "paymentSource" VARCHAR(255) DEFAULT \'Client Side\';');
            await sequelize.query('ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "department" VARCHAR(255);');
            console.log('Ensured columns exist in payment_requests table');
        } catch (colErr) {
            console.warn('Could not patch columns in payment_requests table (non-fatal):', colErr.message);
        }

        // Ensure missing columns exist and have correct nullability in problems table
        try {
            await sequelize.query('ALTER TABLE "problems" ADD COLUMN IF NOT EXISTS "raisedByRole" VARCHAR(255) DEFAULT \'Employee\';');
            await sequelize.query('ALTER TABLE "problems" ALTER COLUMN "raisedByName" DROP NOT NULL;');
            await sequelize.query('ALTER TABLE "problems" ALTER COLUMN "userType" DROP NOT NULL;');
            console.log('Ensured problems table schema matches current model definition');
        } catch (colErr) {
            console.warn('Could not patch problems table schema (non-fatal):', colErr.message);
        }

        // Ensure candidate username unique index exists (safe idempotent operation)
        try {
            await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_candidates_username ON candidates (username)');
            console.log('Ensured unique index on candidates.username');
        } catch (e) {
            console.warn('Could not create unique index for candidates.username:', e.message);
        }

        // Seed default department team users
        await seedDepartmentTeamUsers();
    } catch (error) {
        console.error("Failed to establish connection with database:", error);
        // Rethrow so callers can handle startup failure (avoid proceeding with seeders/crons)
        throw error;
    }
}

module.exports = dbConnect;