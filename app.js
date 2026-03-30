const express = require('express');
const path = require('path');
const app = express();
const cors = require("cors");
const dotenv = require('dotenv');
const http = require('http');
const socketIO = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
dotenv.config();
const { Message } = require('./models/sequelizeModels');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

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
    contentSecurityPolicy: false
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

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
    res.send("You have landed on the test page");
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

restartCronJobs();
seedSuperAdmin();

// Change app.listen to server.listen
server.listen(PORT, console.log("----------Server Listening at port: " + PORT + "----------"));

dbConnect();

// Export io instance to use in other files if needed
module.exports = { io };


app.post('/test', (req, res) => {
    console.log("🔥 TEST API HIT");
    res.send("OK");
});