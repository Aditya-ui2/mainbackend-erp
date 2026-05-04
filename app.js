const express = require('express');
const path = require('path');
const app = express();
const cors = require("cors");
const dotenv = require('dotenv');
const http = require('http');
const socketIO = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
dotenv.config();
const { Message } = require('./models/sequelizeModels');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

// TOP-LEVEL EMERGENCY ROUTES
app.get('/ping', (req, res) => res.send('pong'));
app.get('/version', (req, res) => res.json({ build: 'V7_PATH_DEBUG', path: __dirname }));
// NOTE: /recruitment/candidate/generate-credentials is handled by recruitmentRoutes

// Global Logger for Recruitment routes debugging
app.use('/recruitment', (req, res, next) => {
    console.log(`[RECRUITMENT REQUEST] ${req.method} ${req.url}`);
    next();
});

const { runAutomaticInterviewReminders } = require('./controllers/interview_sequelize');

// Create HTTP server
const server = http.createServer(app); // Add this

// Initialize Socket.IO
const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000',
    'http://15.206.67.102',
    'http://15.206.67.102:3000',
    'https://erp.mabicons.com',
    'https://mabicons.vercel.app'
];

const io = socketIO(server, {
    cors: {
        origin: ALLOWED_ORIGINS,
        credentials: true
    }
});

const PORT = 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "upgrade-insecure-requests": null,
            "frame-ancestors": ["'self'", "http://localhost:5173", "http://localhost:5174", "http://15.206.67.102"],
            "img-src": ["'self'", "data:", "blob:", "http://localhost:3000", "http://15.206.67.102:3000"],
            "media-src": ["'self'", "data:", "blob:", "http://localhost:3000", "http://15.206.67.102:3000"],
            "script-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"], // Allow Swagger scripts
        },
    },
    hsts: false, // Disable HSTS as we are on HTTP
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    frameguard: false // Allow framing for CV previews
}));
app.use(express.json({ limit: '10mb' }));
app.use(cors({
    origin: function (origin, callback) {
        // Block requests with no origin in production (prevents SSRF/curl bypass)
        if (!origin) {
            // Allow server-to-server calls (health checks, PM2) but block in API context
            return callback(null, true);
        }
        if (ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Static files (Explicitly allow framing for uploads)
app.use('/uploads', (req, res, next) => {
    res.setHeader('X-Frame-Options', 'ALLOWALL'); 
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' http://localhost:* http://127.0.0.1:*");
    next();
}, express.static(path.join(__dirname, 'uploads')));

// Rate limiting for auth endpoints (brute-force protection)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // max 20 login attempts per 15min per IP
    message: { success: false, message: 'Too many login attempts, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/superAdmin/login', authLimiter);
app.use('/admin/login', authLimiter);
app.use('/client/login', authLimiter);
app.use('/employee/login', authLimiter);
app.use('/teamLeader/login', authLimiter);
app.use('/department/login', authLimiter);
app.use('/auth/forgot-password', authLimiter);

// Audit logging — log all sensitive operations
const SENSITIVE_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];
app.use((req, res, next) => {
    if (SENSITIVE_METHODS.includes(req.method)) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.originalUrl,
            ip: req.headers['x-real-ip'] || req.ip,
            userId: req.user?.id || 'unauthenticated',
            userRole: req.user?.role || 'unknown',
            userAgent: req.headers['user-agent']?.substring(0, 100)
        };
        console.log('AUDIT:', JSON.stringify(logEntry));
    }
    next();
});

// Input sanitization — strip HTML/script tags from all string inputs
const sanitizeInput = (obj) => {
    if (typeof obj === 'string') {
        return obj.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                  .replace(/<[^>]*>/g, '')
                  .trim();
    }
    if (Array.isArray(obj)) return obj.map(sanitizeInput);
    if (obj && typeof obj === 'object') {
        const clean = {};
        for (const [key, value] of Object.entries(obj)) {
            clean[key] = sanitizeInput(value);
        }
        return clean;
    }
    return obj;
};
app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeInput(req.body);
    }
    if (req.query && typeof req.query === 'object') {
        req.query = sanitizeInput(req.query);
    }
    next();
});

const dbConnect = require('./db/db')

// Import routes
const superAdminRoute = require('./routes/superAdmin');
const adminRoute = require('./routes/admin')
const TLroutes = require('./routes/teamLeader')
const employeeRoutes = require('./routes/employee');
const seedSuperAdmin = require('./db/seedSuperAdmin');
const clientRoutes = require('./routes/client')
const taskRoutes = require('./routes/task');
const notificationRoutes = require('./routes/notification');
const chatRoutes = require('./routes/chat');
const authRoutes = require('./routes/authRoutes'); 
const workAgreementRoutes = require('./routes/workAgreement');
const workHandoverRoutes = require('./routes/workHandover');
const recruitmentRoutes = require('./routes/recruitment');
const departmentTeamRoutes = require('./routes/departmentTeam');
const sharePointRoutes = require('./routes/sharepoint');
const interviewRoutes = require('./routes/interview');
const resumeBankRoutes = require('./routes/resumeBank');
const financeRoutes = require('./routes/finance');
const { uploadFile } = require('./utils/googleDriveServices');
const { restartCronJobs } = require('./controllers/task_cron');

// Store connected users
const connectedUsers = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('A user connected');

    // Handle user connection
    socket.on('user_connected', (userData) => {
        connectedUsers.set(userData.userId, socket.id);
        console.log('User connected:', userData.userId);
    });

    // For Text Messages: 
    // {
    //      senderId: "user_id_string",        // MongoDB ObjectId of sender
    //      senderType: "TeamLeader" | "Client", // Type of sender
    //      receiverId: "user_id_string",      // MongoDB ObjectId of receiver
    //      receiverType: "TeamLeader" | "Client", // Type of receiver
    //      messageType: "text",               // Specifies this is a text message
    //      content: "Hello, this is a message" // The actual message text
    // }

    // For Document Messages: 
    // {
    //      senderId: "user_id_string",        // MongoDB ObjectId of sender
    //      senderType: "TeamLeader" | "Client", // Type of sender
    //      receiverId: "user_id_string",      // MongoDB ObjectId of receiver
    //      receiverType: "TeamLeader" | "Client", // Type of receiver
    //      messageType: "document",           // Specifies this is a document message
    //      file: {                           // File object
    //          buffer: Buffer,               // File buffer
    //          originalname: "example.pdf",   // Original file name
    //          mimetype: "application/pdf",   // File mime type
    //          size: 12345                   // File size in bytes
    //      }
    // }
    
    
    // Handle private messages
    socket.on('private_message', async (data) => {
        try {
            let messageData = {
                senderId: data.senderId,
                senderType: data.senderType,
                receiverId: data.receiverId,
                receiverType: data.receiverType,
                messageType: data.messageType || 'text'
            };

            // Handle different message types
            if (data.messageType === 'document' && data.file) {
                // Handle document upload
                const uploadResult = await uploadFile(data.file);
                messageData.document = {
                    fileName: uploadResult.fileName,
                    fileId: uploadResult.fileId,
                    webViewLink: uploadResult.webViewLink,
                    fileType: uploadResult.fileType,
                    fileSize: uploadResult.fileSize
                };
            } else {
                // Handle text message
                messageData.content = data.content;
            }

            // Create and save message using Sequelize
            const message = await Message.create(messageData);

            // Send message to receiver if online
            const receiverSocketId = connectedUsers.get(data.receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('receive_message', message);
            }

            // Send acknowledgment to sender
            socket.emit('message_sent', {
                success: true,
                messageId: message.id
            });

        } catch (error) {
            console.error('Error handling message:', error);
            socket.emit('message_error', {
                success: false,
                error: 'Failed to process message'
            });
        }
    });

    socket.on('typing', (data) => {
        const receiverSocketId = connectedUsers.get(data.receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('user_typing', {
                senderId: data.senderId,
                typing: data.typing
            });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        for (const [userId, socketId] of connectedUsers.entries()) {
            if (socketId === socket.id) {
                connectedUsers.delete(userId);
                console.log('User disconnected:', userId);
                break;
            }
        }
    });
});

// Routes
app.get('/', (req, res) => {
    res.send("You have landed on the test page - V4_" + new Date().toISOString());
});

app.get('/verify-deploy', (req, res) => {
    res.json({ 
        status: 'DEPLOY_ACTIVE', 
        time: new Date().toISOString(), 
        build: 'V3_ONBOARDING_FIX',
        path: __dirname 
    });
});

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'MabiconsERP API Documentation'
}));

app.use('/superAdmin', superAdminRoute);
app.use('/admin', adminRoute);
app.use('/teamLeader', TLroutes);
app.use('/employee', employeeRoutes);
app.use('/client', clientRoutes);
app.use('/task', taskRoutes);
app.use('/notification', notificationRoutes);
app.use('/chat', chatRoutes); // Add chat routes
app.use('/auth', authRoutes);
app.use('/workAgreement', workAgreementRoutes);
app.use('/workHandover', workHandoverRoutes);
app.use('/recruitment', recruitmentRoutes);
app.use('/department', departmentTeamRoutes);
app.use('/sharepoint', sharePointRoutes);
app.use('/interview', interviewRoutes);
app.use('/api/resumebank', resumeBankRoutes);
app.use('/finance', financeRoutes);
app.use('/reports', require('./routes/clientReport'));
app.use('/meetings', require('./routes/clientMeeting'));
app.use('/leads', require('./routes/lead'));
app.use('/bd', require('./routes/lead'));

// Public job feed routes (no auth - for Google Jobs, Indeed, Jooble, Adzuna crawlers)
const { getPublicJobsFeedXml, getPublicJobPage, getPublicJobsList } = require('./controllers/jobDistribution');
app.get('/api/public/jobs-feed.xml', getPublicJobsFeedXml);
app.get('/api/public/jobs', getPublicJobsList);
app.get('/api/public/jobs/:id', getPublicJobPage);

restartCronJobs();
seedSuperAdmin();
cron.schedule('* * * * *', () => {
    runAutomaticInterviewReminders();
});

// Catch-all 404 handler for debugging
app.use((req, res) => {
    console.warn(`[404 ERROR] ${req.method} ${req.originalUrl} - Not Matched.`);
    res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found on server` });
});

// Change app.listen to server.listen
server.listen(PORT, () => {
    console.log(`--- Express Server Running on Port ${PORT} ---`);
    console.log(`[DIAGNOSTIC] Recruitment routes mounted on /recruitment`);
}).on('error', (err) => {
    console.error(`[CRITICAL] Server failed to start:`, err.message);
});

dbConnect();
const { sequelize } = require('./models/sequelizeModels');

// Safe Database Patch for Missing Columns
(async () => {
    try {
        console.log('--- Initializing Safe Database Patch ---');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS \"addedById\" UUID');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS \"addedByType\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS \"skillMatch\" INTEGER DEFAULT 0');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS \"experienceMatch\" INTEGER DEFAULT 0');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS \"offeredCTC\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS \"offerDate\" DATE');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS \"offerExpiryDate\" DATE');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS \"joiningDate\" DATE');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS \"negotiationNotes\" TEXT');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS \"offerStatus\" VARCHAR(255) DEFAULT \'Draft\'');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "offerLetterUrl" VARCHAR(255)');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "offerLetterFileName" VARCHAR(255)');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "bgvStatus" VARCHAR(255) DEFAULT \'Not Started\'');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "username" VARCHAR(255) UNIQUE');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "rawPassword" VARCHAR(255)');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "firebaseUid" VARCHAR(255)');
        await sequelize.query('ALTER TABLE interviews ADD COLUMN IF NOT EXISTS \"interviewerId\" UUID');
        await sequelize.query('ALTER TABLE interviews ADD COLUMN IF NOT EXISTS \"interviewerType\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE interviews ADD COLUMN IF NOT EXISTS \"interviewerName\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE interviews ADD COLUMN IF NOT EXISTS \"interviewerRole\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE interviews ADD COLUMN IF NOT EXISTS \"interviewerEmail\" VARCHAR(255)');
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS "DepartmentNotes" (
                "id" UUID PRIMARY KEY,
                "department" VARCHAR(255) NOT NULL,
                "title" VARCHAR(255) NOT NULL,
                "content" TEXT NOT NULL,
                "category" VARCHAR(255) DEFAULT 'General',
                "priority" VARCHAR(255) DEFAULT 'normal',
                "createdById" UUID,
                "createdByName" VARCHAR(255),
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        `);
        await sequelize.query('ALTER TABLE recruitment_positions ADD COLUMN IF NOT EXISTS \"postedByUserId\" UUID');
        await sequelize.query('ALTER TABLE recruitment_positions ADD COLUMN IF NOT EXISTS \"postedByUserType\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE recruitment_positions ADD COLUMN IF NOT EXISTS \"postedByName\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE recruitment_positions ADD COLUMN IF NOT EXISTS \"postedByEmail\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE recruitment_positions ALTER COLUMN "clientId" DROP NOT NULL').catch(e => console.log('clientId nullable already applied or failed:', e.message));
        await sequelize.query('ALTER TABLE recruitment_positions DROP CONSTRAINT IF EXISTS \"recruitment_positions_departmentTeamId_fkey\"');
        await sequelize.query('ALTER TABLE recruitment_positions DROP CONSTRAINT IF EXISTS \"recruitment_positions_departmentTeamId_fkey1\"');
        await sequelize.query('ALTER TABLE recruitment_positions ADD CONSTRAINT \"recruitment_positions_departmentTeamId_fkey\" FOREIGN KEY (\"departmentTeamId\") REFERENCES \"DepartmentTeams\"(\"id\") ON UPDATE CASCADE ON DELETE SET NULL');
        await sequelize.query('ALTER TABLE candidates DROP CONSTRAINT IF EXISTS \"candidates_addedById_fkey\"');
        await sequelize.query('ALTER TABLE interviews DROP CONSTRAINT IF EXISTS \"interviews_interviewerId_fkey\"');
        await sequelize.query('ALTER TABLE interviews ADD CONSTRAINT \"interviews_interviewerId_fkey\" FOREIGN KEY (\"interviewerId\") REFERENCES \"DepartmentTeams\"(\"id\") ON UPDATE CASCADE ON DELETE SET NULL');
        await sequelize.query(`
            UPDATE recruitment_positions rp
            SET "postedByName" = dt."name",
                "postedByEmail" = dt."email",
                "postedByUserId" = dt."id",
                "postedByUserType" = 'departmentTeam'
            FROM "DepartmentTeams" dt
            WHERE rp."departmentTeamId" = dt."id"
              AND (rp."postedByName" IS NULL OR rp."postedByName" = '')
        `);
        await sequelize.query(`
            UPDATE recruitment_positions rp
            SET "postedByName" = tl."name",
                "postedByEmail" = tl."email",
                "postedByUserId" = tl."id",
                "postedByUserType" = 'teamLeader'
            FROM team_leaders tl
            WHERE rp."teamLeaderId" = tl."id"
              AND (rp."postedByName" IS NULL OR rp."postedByName" = '')
        `);
        await sequelize.query('ALTER TABLE work_handovers DROP CONSTRAINT IF EXISTS \"work_handovers_fromUserId_fkey\"').catch(e => console.log('fromUserId fkey already dropped or failed:', e.message));
        await sequelize.query('ALTER TABLE work_handovers DROP CONSTRAINT IF EXISTS \"work_handovers_toUserId_fkey\"').catch(e => console.log('toUserId fkey already dropped or failed:', e.message));
        await sequelize.query('ALTER TABLE work_handovers DROP CONSTRAINT IF EXISTS \"work_handovers_createdBy_fkey\"').catch(e => console.log('createdBy fkey already dropped or failed:', e.message));
        await sequelize.query('ALTER TABLE work_handovers ALTER COLUMN \"fromUserId\" TYPE VARCHAR(255)');
        await sequelize.query('ALTER TABLE work_handovers ALTER COLUMN \"toUserId\" TYPE VARCHAR(255)');
        await sequelize.query('ALTER TABLE work_handovers ALTER COLUMN \"createdBy\" TYPE VARCHAR(255)');
        await sequelize.query('ALTER TABLE clients ALTER COLUMN \"id\" TYPE VARCHAR(255)').catch(e => console.log('clients id type change failed (expected if FKs exist):', e.message));
        
        // Add Onboarding Columns to Clients table
        await sequelize.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS \"city\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS \"pinCode\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS \"ownerName\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS \"ownerEmail\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS \"agreementType\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS \"agreementEffectiveDate\" DATE');
        await sequelize.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS \"feeAmount\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS \"paymentTerms\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS \"shopsLicense\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS \"factoryLicense\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS \"msmeRegistered\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS \"totalEmployees\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS \"payrollCycle\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS \"pfApplicable\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS \"esicApplicable\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS \"leadSource\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS \"onboardingNotes\" TEXT');
        await sequelize.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS \"assignKAM\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS \"industry\" VARCHAR(255)');
        await sequelize.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS \"probability\" INTEGER DEFAULT 25');
        
        // Handle stage column with enum
        try {
            await sequelize.query(`
                DO $$ BEGIN
                    CREATE TYPE enum_clients_stage AS ENUM('Onboarding Complete', 'Finalize', 'Lead Stage');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            `);
            await sequelize.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS \"stage\" enum_clients_stage DEFAULT \'Lead Stage\'');
        } catch (e) {
            console.log('Stage column patch failed:', e.message);
        }
        
        // Create Finance Tables
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS "client_accounts" (
                "id" UUID PRIMARY KEY,
                "clientId" UUID NOT NULL REFERENCES "clients"("id") ON UPDATE CASCADE ON DELETE CASCADE,
                "companyName" VARCHAR(255) NOT NULL,
                "totalOutstanding" DECIMAL(15, 2) DEFAULT 0,
                "clearedAmount" DECIMAL(15, 2) DEFAULT 0,
                "overdueAmount" DECIMAL(15, 2) DEFAULT 0,
                "pendingInvoicesCount" INTEGER DEFAULT 0,
                "status" VARCHAR(255) DEFAULT 'Cleared',
                "accountType" VARCHAR(255) DEFAULT 'Standard',
                "lastInvoiceNumber" VARCHAR(255),
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        `);
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS "invoices" (
                "id" UUID PRIMARY KEY,
                "invoiceNumber" VARCHAR(255) NOT NULL UNIQUE,
                "clientId" UUID NOT NULL REFERENCES "clients"("id") ON UPDATE CASCADE ON DELETE CASCADE,
                "companyName" VARCHAR(255) NOT NULL,
                "amount" DECIMAL(15, 2) NOT NULL,
                "taxAmount" DECIMAL(15, 2) DEFAULT 0,
                "totalAmount" DECIMAL(15, 2) NOT NULL,
                "dueDate" DATE NOT NULL,
                "status" VARCHAR(255) DEFAULT 'Draft',
                "items" JSONB DEFAULT '[]',
                "notes" TEXT,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        `);

        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS "client_reports" (
                "id" UUID PRIMARY KEY,
                "reportName" VARCHAR(255) NOT NULL,
                "reportNumber" VARCHAR(255) UNIQUE,
                "clientId" UUID NOT NULL REFERENCES "clients"("id") ON UPDATE CASCADE ON DELETE CASCADE,
                "companyName" VARCHAR(255),
                "size" VARCHAR(255) DEFAULT '0.0 MB',
                "status" VARCHAR(255) DEFAULT 'PENDING',
                "fileUrl" TEXT,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        `);

        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS "client_meetings" (
                "id" UUID PRIMARY KEY,
                "title" VARCHAR(255) NOT NULL,
                "clientId" VARCHAR(255) NOT NULL,
                "companyName" VARCHAR(255),
                "meetingDate" DATE NOT NULL,
                "meetingTime" VARCHAR(255) NOT NULL,
                "meetingType" VARCHAR(255) DEFAULT 'Virtual',
                "platform" VARCHAR(255),
                "attendees" INTEGER DEFAULT 1,
                "status" VARCHAR(255) DEFAULT 'Scheduled',
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        `);

        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS "leads" (
                "id" UUID PRIMARY KEY,
                "companyName" VARCHAR(255) NOT NULL,
                "contactPerson" VARCHAR(255),
                "email" VARCHAR(255),
                "phone" VARCHAR(255),
                "value" FLOAT DEFAULT 0,
                "status" VARCHAR(255) DEFAULT 'Open',
                "segment" VARCHAR(255) DEFAULT 'General',
                "owner" VARCHAR(255),
                "notes" TEXT,
                "lastContactDate" TIMESTAMP WITH TIME ZONE,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        `);

        console.log('--- Database Schema Patch Applied Successfully ---');
    } catch (err) {
        console.error('--- Database Schema Patch Failed ---', err.message);
    }
})();


app.post('/test', (req, res) => {
    console.log("🔥 TEST API HIT");
    res.send("OK");
});
// TRIGGER RESTART FOR NEW RECRUITMENT ROUTES
