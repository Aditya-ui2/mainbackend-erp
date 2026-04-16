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

const { Message, sequelize } = require('./models/sequelizeModels');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

// Global Logger for Recruitment routes debugging
app.use('/recruitment', (req, res, next) => {
    console.log(`[RECRUITMENT REQUEST] ${req.method} ${req.url}`);
    next();
});

const { runAutomaticInterviewReminders } = require('./controllers/interview_sequelize');
const { dbConnect } = require('./config/db');

// Create HTTP server
const server = http.createServer(app); 

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
            "script-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        },
    },
    hsts: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    frameguard: false
}));

app.use(express.json({ limit: '10mb' }));
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const superAdminRoute = require('./routes/superAdmin');
const adminRoute = require('./routes/admin');
const TLroutes = require('./routes/TLroutes');
const employeeRoutes = require('./routes/employeeRoutes');
const clientRoutes = require('./routes/clientRoutes');
const taskRoutes = require('./routes/taskRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const chatRoutes = require('./routes/chatRoutes');
const authRoutes = require('./routes/authRoutes');
const workAgreementRoutes = require('./routes/workAgreement');
const workHandoverRoutes = require('./routes/workHandover');
const recruitmentRoutes = require('./routes/recruitment');
const departmentTeamRoutes = require('./routes/departmentTeam');
const sharePointRoutes = require('./routes/sharepoint');
const interviewRoutes = require('./routes/interview');
const resumeBankRoutes = require('./routes/resumeBank');

app.use('/superAdmin', superAdminRoute);
app.use('/admin', adminRoute);
app.use('/teamLeader', TLroutes);
app.use('/employee', employeeRoutes);
app.use('/client', clientRoutes);
app.use('/task', taskRoutes);
app.use('/notification', notificationRoutes);
app.use('/chat', chatRoutes);
app.use('/auth', authRoutes);
app.use('/workAgreement', workAgreementRoutes);
app.use('/workHandover', workHandoverRoutes);
app.use('/recruitment', recruitmentRoutes);
app.use('/department', departmentTeamRoutes);
app.use('/sharepoint', sharePointRoutes);
app.use('/interview', interviewRoutes);
app.use('/api/resumebank', resumeBankRoutes);

// Database Patch
(async () => {
    try {
        console.log('--- Initializing Safe Database Patch ---');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "username" VARCHAR(255) UNIQUE');
        console.log('--- Database Schema Patch Applied Successfully ---');
    } catch (err) {
        console.error('--- Database Schema Patch Failed ---', err.message);
    }
})();

// Catch-all 404
app.use((req, res) => {
    console.warn(`[404 ERROR] ${req.method} ${req.originalUrl}`);
    res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`--- Server Running on Port ${PORT} ---`);
});
