const mongoose = require('mongoose');
const { Schema } = mongoose;
const crypto = require('crypto');


// Add this function to create a reusable schema mixin
const addPasswordResetFields = (schema) => {
    schema.add({
        resetPasswordToken: String,
        resetPasswordExpires: Date
    });

    schema.methods.createPasswordResetToken = function () {
        const resetToken = crypto.randomBytes(32).toString('hex');
        this.resetPasswordToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');
        this.resetPasswordExpires = Date.now() + 20 * 60 * 1000; // 20 minutes
        return resetToken;
    };
};


// SuperAdmin Schema
const superAdminSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    companyName: { type: String, required: true }
}, { timestamps: true });
addPasswordResetFields(superAdminSchema);
const SuperAdmin = mongoose.model('SuperAdmin', superAdminSchema);

// Admin Schema
const adminSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    teamLeaders: [{ type: Schema.Types.ObjectId, ref: 'TeamLeader' }]

}, { timestamps: true });

addPasswordResetFields(adminSchema);
const Admin = mongoose.model('Admin', adminSchema);


const teamLeaderSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: false }, // Added phone number field
    password: { type: String, required: true },
    admin: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
    department: { 
        type: String, 
        enum: ['HR Operations', 'HR Recruitment', 'Both'], 
        default: 'Both' 
    }, // Department access for role-based dashboard
    employees: [{ type: Schema.Types.ObjectId, ref: 'Employee' }], // Array of Employees under the TeamLeader
    tasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
    clients: [{ type: Schema.Types.ObjectId, ref: 'Client' }]
    // Other relevant fields
}, { timestamps: true });

addPasswordResetFields(teamLeaderSchema);
const TeamLeader = mongoose.model('TeamLeader', teamLeaderSchema);

// employee Schema 
const employeeSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String }, // Optional phone field
    teamLeaders: [{ type: Schema.Types.ObjectId, ref: 'TeamLeader' }], // Array of TeamLeaders to whom the Employee reports
    tasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
    // Other relevant fields can be added here
}, { timestamps: true });
addPasswordResetFields(employeeSchema);

const Employee = mongoose.model('Employee', employeeSchema);

// Client Schema
const clientSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    contactNumber: { type: String },
    password: { type: String, required: true },
    companyName: { type: String, required: true },
    corporateAddress: { type: String },
    gstNumber: { type: String },
    panNumber: { type: String },
    cinNumber: { type: String },
    numberOfCompanies: { type: Number },
    spocName: { type: String },      // Added SPOC Name
    spocContact: { type: String },   // Added SPOC Contact
    ownerDirectorDetails: [{
        name: { type: String, required: true },
        email: { type: String },
        contact: { type: String, required: true }
    }],
    authorizedSignatory: {
        name: { type: String, required: true },
        email: { type: String },
        contact: { type: String, required: true }
    },
    documents: {
        employeeMasterDatabase: { type: String },
        currentSalaryStructure: { type: String },
        previousSalarySheets: { type: String },
        currentHRPolicies: { type: String },
        leaveBalance: { type: String },
        companyLogo: { type: String },
        letterhead: { type: String }
    },
    website: { type: String },
    status: {
        type: String,
        enum: ['Accepted', 'Requested', 'Rejected'],
        default: 'Requested'
    },
    teamLeader: { type: Schema.Types.ObjectId, ref: 'TeamLeader' },
    tasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
}, { timestamps: true });
addPasswordResetFields(clientSchema);
const Client = mongoose.model('Client', clientSchema);


const requestedTaskSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    category: {
        type: String,
        enum: ['Frequency', 'Deadline'],
        default: 'Deadline'
    },
    frequency: {
        type: String,
        default: null
    }, // Only for frequency-based tasks
    dueDate: { type: Date }, // Only for deadline-based tasks
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    status: {
        type: String,
        enum: ['Accepted', 'Requested', 'Rejected'],
        default: 'Requested'
    },
    rejectionReason: { type: String }, // Optional
}, { timestamps: true });

const RequestTask = mongoose.model('RequestedTask', requestedTaskSchema);

// Task Schema
const taskSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    status: {
        type: String,
        enum: ['Active', 'Work in Progress', 'Review', 'Pending', 'Resolved'],
        default: 'Active'
    },
    category: {
        type: String,
        enum: ['Frequency', 'Deadline'],
        default: 'Deadline'
    },
    client: { type: Schema.Types.ObjectId, ref: 'Client' },
    assignedTo: {
        userType: { type: String, enum: ['Employee', 'TeamLeader'], required: true },
        userId: { type: Schema.Types.ObjectId, refPath: 'assignedTo.userType' }
    },
    dueDate: { type: Date },
    frequency: {
        type: String,
        default: null
    }, 
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    parentTaskId: { type: Schema.Types.ObjectId, ref: 'Task' }, // Reference for frequency tasks  
}, { timestamps: true });

const Task = mongoose.model('Task', taskSchema);


const recurringTaskSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    frequency: {
        type: String,
        required: true
    },
    assignedTo: {
        userType: { type: String, enum: ['Employee', 'TeamLeader'], required: true },
        userId: { type: Schema.Types.ObjectId, refPath: 'assignedTo.userType' }
    },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    active: { type: Boolean, default: true }, // Toggle for recurring tasks
}, { timestamps: true });

const RecurringTask = mongoose.model('RecurringTask', recurringTaskSchema);

const notificationSchema = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userType: { type: String, enum: ['Admin', 'TeamLeader', 'Employee', 'Client'], required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ['read', 'unread'], default: 'unread' },
    readAt: { type: Date, default: null }, // Added field for storing the timestamp when read
    type: { type: String, enum: ['alert', 'message', 'system'], default: 'message' },
    priority: { type: String, enum: ['high', 'medium', 'low'], default: 'low' },
}, { timestamps: true });

const Notification = mongoose.model('Notification', notificationSchema);

const messageSchema = new Schema({
    sender: {
        type: Schema.Types.ObjectId,
        required: true,
        refPath: 'senderType'
    },
    senderType: {
        type: String,
        required: true,
        enum: ['TeamLeader', 'Client']
    },
    receiver: {
        type: Schema.Types.ObjectId,
        required: true,
        refPath: 'receiverType'
    },
    receiverType: {
        type: String,
        required: true,
        enum: ['TeamLeader', 'Client']
    },
    content: { type: String },
    document: {
        fileName: String,
        fileId: String,
        webViewLink: String,
        fileType: String,
        fileSize: Number
    },
    messageType: {
        type: String,
        enum: ['text', 'document'],
        default: 'text'
    },
    read: { type: Boolean, default: false },
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);

// Recruitment Position Schema
const recruitmentPositionSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String },
    location: { type: String, required: true },
    type: { type: String, enum: ['Full-time', 'Part-time', 'Contract', 'Internship'], default: 'Full-time' },
    salary: { type: String },
    status: { type: String, enum: ['Open', 'Closed', 'Hold'], default: 'Open' },
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
    openings: { type: Number, default: 1 },
    filled: { type: Number, default: 0 },
    skills: [{ type: String }],
    experience: { type: String },
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    teamLeader: { type: Schema.Types.ObjectId, ref: 'TeamLeader' }, // KAM assigned
    postedDate: { type: Date, default: Date.now },
    deadline: { type: Date },
}, { timestamps: true });

const RecruitmentPosition = mongoose.model('RecruitmentPosition', recruitmentPositionSchema);

// Candidate Schema
const candidateSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    position: { type: Schema.Types.ObjectId, ref: 'RecruitmentPosition', required: true },
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    cvUrl: { type: String },
    cvFileName: { type: String },
    status: { 
        type: String, 
        enum: ['Submitted', 'Shared', 'Shortlisted', 'Interview', 'Selected', 'Rejected', 'OnHold'], 
        default: 'Submitted' 
    },
    sharedAt: { type: Date },
    shortlistedAt: { type: Date },
    interviewDate: { type: Date },
    notes: { type: String },
    skills: [{ type: String }],
    experience: { type: String },
    currentSalary: { type: String },
    expectedSalary: { type: String },
}, { timestamps: true });

const Candidate = mongoose.model('Candidate', candidateSchema);

// Department Team Member Schema - for KAM team members (Manju, Jyoti, etc.)
const departmentTeamSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String },
    role: { type: String, default: 'Team Member' }, // HR Executive, Recruiter, etc.
    department: { 
        type: String, 
        enum: ['HR Operations', 'HR Recruitment'], 
        required: true 
    },
    manager: { type: Schema.Types.ObjectId, ref: 'TeamLeader' }, // KAM Manager (Ramesh/Sachin)
    status: { type: String, enum: ['Active', 'Inactive', 'On Leave'], default: 'Active' },
    avatar: { type: String },
    skills: [{ type: String }],
    joinDate: { type: Date, default: Date.now },
    // Performance metrics
    tasksCompleted: { type: Number, default: 0 },
    tasksAssigned: { type: Number, default: 0 },
    avgResponseTime: { type: Number, default: 0 }, // in hours
}, { timestamps: true });

const DepartmentTeam = mongoose.model('DepartmentTeam', departmentTeamSchema);

// Activity Log Schema - track all department activities
const activityLogSchema = new Schema({
    department: { 
        type: String, 
        enum: ['HR Operations', 'HR Recruitment'], 
        required: true 
    },
    performedBy: {
        type: Schema.Types.ObjectId,
        refPath: 'performedByType',
        required: true
    },
    performedByType: {
        type: String,
        enum: ['TeamLeader', 'DepartmentTeam'],
        required: true
    },
    performedByName: { type: String, required: true },
    action: { type: String, required: true }, // e.g., "approved leave", "screened candidate"
    actionType: { 
        type: String, 
        enum: ['task', 'leave', 'payroll', 'attendance', 'candidate', 'interview', 'offer', 'general'],
        default: 'general'
    },
    description: { type: String, required: true },
    relatedEntity: {
        type: Schema.Types.ObjectId,
        refPath: 'relatedEntityType'
    },
    relatedEntityType: {
        type: String,
        enum: ['Task', 'Employee', 'Client', 'Candidate', 'RecruitmentPosition', 'DepartmentTeam']
    },
    metadata: { type: Schema.Types.Mixed }, // Additional data
}, { timestamps: true });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

// Department Task Assignment Schema
const departmentTaskSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String },
    department: { 
        type: String, 
        enum: ['HR Operations', 'HR Recruitment'], 
        required: true 
    },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'TeamLeader', required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'DepartmentTeam', required: true },
    assignedToName: { type: String },
    status: { 
        type: String, 
        enum: ['Pending', 'In Progress', 'Completed', 'Overdue'], 
        default: 'Pending' 
    },
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
    dueDate: { type: Date },
    completedAt: { type: Date },
    comments: [{
        text: String,
        by: { type: Schema.Types.ObjectId, refPath: 'comments.byType' },
        byType: { type: String, enum: ['TeamLeader', 'DepartmentTeam'] },
        byName: String,
        createdAt: { type: Date, default: Date.now }
    }],
}, { timestamps: true });

const DepartmentTask = mongoose.model('DepartmentTask', departmentTaskSchema);


// Interview Schedule Schema - with evaluation feedback
const interviewSchema = new Schema({
    candidate: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
    position: { type: Schema.Types.ObjectId, ref: 'RecruitmentPosition', required: true },
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    
    // Interview Details
    interviewType: { 
        type: String, 
        enum: ['HR Round', 'Technical Round', 'Client Interview', 'Phone Screening', 'Final Round'], 
        required: true 
    },
    interviewDate: { type: Date, required: true },
    startTime: { type: String, required: true }, // e.g., "10:00 AM"
    duration: { type: Number, default: 45 }, // in minutes
    
    // Meeting Details
    meetingType: { type: String, enum: ['Video', 'In-Person', 'Phone'], default: 'Video' },
    meetingLink: { type: String }, // Auto-generated or manual
    meetingToken: { type: String }, // Unique token for meeting access
    meetingPassword: { type: String },
    
    // Interviewer Details
    interviewer: {
        id: { type: Schema.Types.ObjectId, refPath: 'interviewer.type' },
        type: { type: String, enum: ['TeamLeader', 'DepartmentTeam', 'Client'] },
        name: { type: String, required: true },
        email: { type: String },
        role: { type: String } // e.g., "HR Head", "Tech Lead"
    },
    
    // Status
    status: { 
        type: String, 
        enum: ['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Rescheduled', 'No Show'], 
        default: 'Scheduled' 
    },
    
    // Evaluation/Feedback (filled by interviewer)
    evaluation: {
        skills: { type: Number, min: 1, max: 10 },
        attitude: { type: Number, min: 1, max: 10 },
        knowledge: { type: Number, min: 1, max: 10 },
        communication: { type: Number, min: 1, max: 10 },
        behavior: { type: Number, min: 1, max: 10 },
        overallRating: { type: Number, min: 1, max: 10 },
        strengths: { type: String },
        weaknesses: { type: String },
        recommendation: { 
            type: String, 
            enum: ['Strongly Recommend', 'Recommend', 'Neutral', 'Not Recommend', 'Strongly Not Recommend'] 
        },
        notes: { type: String },
        feedbackSubmittedAt: { type: Date }
    },
    
    // Email Tracking
    emailSentToCandidate: { type: Boolean, default: false },
    emailSentAt: { type: Date },
    reminderSent: { type: Boolean, default: false },
    
    // Rescheduling
    rescheduledFrom: { type: Date },
    rescheduleReason: { type: String },
    
    // Metadata
    notes: { type: String },
    createdBy: {
        id: { type: Schema.Types.ObjectId, refPath: 'createdBy.type' },
        type: { type: String, enum: ['TeamLeader', 'DepartmentTeam'] },
        name: { type: String }
    }
}, { timestamps: true });

// Generate meeting token before saving
interviewSchema.pre('save', function(next) {
    if (!this.meetingToken) {
        this.meetingToken = crypto.randomBytes(32).toString('hex');
    }
    next();
});

const Interview = mongoose.model('Interview', interviewSchema);

// Resume Bank Schema - for syncing 10,000+ resumes from SharePoint
const resumeBankSchema = new Schema({
    // Storage identifiers (supports both S3 and SharePoint)
    sharePointId: { type: String, required: true, unique: true },
    driveId: { type: String, required: true }, // 's3' for S3 storage
    s3Key: { type: String }, // S3 object key for download
    
    // File details
    fileName: { type: String, required: true },
    fileType: { type: String, enum: ['pdf', 'doc', 'docx'], required: true },
    fileSize: { type: Number },
    
    // Role categorization
    roleType: { type: String, required: true, index: true }, // e.g., "Software Engineer", "Product Manager"
    subRole: { type: String }, // e.g., "Frontend Developer", "Backend Developer"
    
    // Candidate details (extracted or manual)
    candidateName: { type: String, index: true },
    email: { type: String },
    phone: { type: String },
    experience: { type: String }, // e.g., "3-5 years"
    skills: [{ type: String }],
    currentCompany: { type: String },
    currentLocation: { type: String },
    preferredLocation: { type: String },
    currentSalary: { type: String },
    expectedSalary: { type: String },
    noticePeriod: { type: String },
    
    // SharePoint URLs
    webUrl: { type: String },
    downloadUrl: { type: String },
    folderPath: { type: String },
    
    // Tracking
    status: { 
        type: String, 
        enum: ['Available', 'Shortlisted', 'Contacted', 'Interview Scheduled', 'Hired', 'Rejected', 'Not Interested'],
        default: 'Available',
        index: true
    },
    lastContactedAt: { type: Date },
    contactNotes: { type: String },
    
    // Assignment
    assignedTo: { type: Schema.Types.ObjectId, ref: 'DepartmentTeam' },
    assignedPosition: { type: Schema.Types.ObjectId, ref: 'RecruitmentPosition' },
    
    // Sync metadata
    lastSyncedAt: { type: Date, default: Date.now },
    sharePointCreatedAt: { type: Date },
    sharePointModifiedAt: { type: Date },
    sharePointCreatedBy: { type: String },
    
    // Tags for filtering
    tags: [{ type: String }],
    rating: { type: Number, min: 1, max: 5 }, // Internal rating
    isStarred: { type: Boolean, default: false },
}, { timestamps: true });

// Indexes for faster search
resumeBankSchema.index({ roleType: 1, status: 1 });
resumeBankSchema.index({ candidateName: 'text', skills: 'text', roleType: 'text' });
resumeBankSchema.index({ lastSyncedAt: -1 });

const ResumeBank = mongoose.model('ResumeBank', resumeBankSchema);

module.exports = {
    SuperAdmin,
    Admin,
    TeamLeader,
    Employee,
    Client,
    RequestTask,
    Task,
    RecurringTask,
    Notification,
    Message,
    RecruitmentPosition,
    Candidate,
    DepartmentTeam,
    ActivityLog,
    DepartmentTask,
    Interview,
    ResumeBank
};



