const { Sequelize, DataTypes, Model } = require('sequelize');
const crypto = require('crypto');

// Initialize Sequelize with PostgreSQL
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false, // Set to console.log for debugging
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        dialectOptions: {
            ssl: process.env.DB_SSL === 'false' ? false : {
                require: true,
                rejectUnauthorized: false
            }
        }
    }
);

// Password reset token helper
const createPasswordResetToken = (instance) => {
    const resetToken = crypto.randomBytes(32).toString('hex');
    instance.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
    instance.resetPasswordExpires = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes
    return resetToken;
};

// ============ SUPERADMIN MODEL ============
class SuperAdmin extends Model {
    createPasswordResetToken() {
        return createPasswordResetToken(this);
    }
}

SuperAdmin.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    companyName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    resetPasswordToken: DataTypes.STRING,
    resetPasswordExpires: DataTypes.DATE
}, {
    sequelize,
    modelName: 'SuperAdmin',
    tableName: 'super_admins',
    timestamps: true
});

// ============ ADMIN MODEL ============
class Admin extends Model {
    createPasswordResetToken() {
        return createPasswordResetToken(this);
    }
}

Admin.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    resetPasswordToken: DataTypes.STRING,
    resetPasswordExpires: DataTypes.DATE
}, {
    sequelize,
    modelName: 'Admin',
    tableName: 'admins',
    timestamps: true
});

// ============ TEAMLEADER MODEL ============
class TeamLeader extends Model {
    createPasswordResetToken() {
        return createPasswordResetToken(this);
    }
}

TeamLeader.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true }
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    department: {
        type: DataTypes.ENUM('HR Operations', 'HR Recruitment', 'Both'),
        defaultValue: 'Both',
        allowNull: false
    },
    adminId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'admins',
            key: 'id'
        }
    },
    resetPasswordToken: DataTypes.STRING,
    resetPasswordExpires: DataTypes.DATE
}, {
    sequelize,
    modelName: 'TeamLeader',
    tableName: 'team_leaders',
    timestamps: true
});

// ============ EMPLOYEE MODEL ============
class Employee extends Model {
    createPasswordResetToken() {
        return createPasswordResetToken(this);
    }
}

Employee.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    resetPasswordToken: DataTypes.STRING,
    resetPasswordExpires: DataTypes.DATE
}, {
    sequelize,
    modelName: 'Employee',
    tableName: 'employees',
    timestamps: true
});

// ============ EMPLOYEE-TEAMLEADER JUNCTION TABLE ============
const EmployeeTeamLeader = sequelize.define('EmployeeTeamLeader', {
    employeeId: {
        type: DataTypes.UUID,
        references: {
            model: 'employees',
            key: 'id'
        }
    },
    teamLeaderId: {
        type: DataTypes.UUID,
        references: {
            model: 'team_leaders',
            key: 'id'
        }
    }
}, {
    tableName: 'employee_team_leaders',
    timestamps: true
});

// ============ CLIENT MODEL ============
class Client extends Model {
    createPasswordResetToken() {
        return createPasswordResetToken(this);
    }
}

Client.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true }
    },
    contactNumber: {
        type: DataTypes.STRING,
        allowNull: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    companyName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    corporateAddress: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    gstNumber: {
        type: DataTypes.STRING,
        allowNull: true
    },
    panNumber: {
        type: DataTypes.STRING,
        allowNull: true
    },
    cinNumber: {
        type: DataTypes.STRING,
        allowNull: true
    },
    numberOfCompanies: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    spocName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    spocContact: {
        type: DataTypes.STRING,
        allowNull: true
    },
    website: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Store complex objects as JSONB
    ownerDirectorDetails: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    authorizedSignatory: {
        type: DataTypes.JSONB,
        defaultValue: {}
    },
    documents: {
        type: DataTypes.JSONB,
        defaultValue: {}
    },
    status: {
        type: DataTypes.ENUM('Accepted', 'Requested', 'Rejected'),
        defaultValue: 'Requested'
    },
    teamLeaderId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'team_leaders',
            key: 'id'
        }
    },
    resetPasswordToken: DataTypes.STRING,
    resetPasswordExpires: DataTypes.DATE
}, {
    sequelize,
    modelName: 'Client',
    tableName: 'clients',
    timestamps: true
});

// ============ REQUESTED TASK MODEL ============
const RequestTask = sequelize.define('RequestTask', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    clientId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'clients',
            key: 'id'
        }
    },
    category: {
        type: DataTypes.ENUM('Frequency', 'Deadline'),
        defaultValue: 'Deadline'
    },
    frequency: {
        type: DataTypes.STRING,
        allowNull: true
    },
    dueDate: {
        type: DataTypes.DATE,
        allowNull: true
    },
    priority: {
        type: DataTypes.ENUM('Low', 'Medium', 'High'),
        defaultValue: 'Medium'
    },
    status: {
        type: DataTypes.ENUM('Accepted', 'Requested', 'Rejected'),
        defaultValue: 'Requested'
    },
    rejectionReason: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'requested_tasks',
    timestamps: true
});

// ============ TASK MODEL ============
const Task = sequelize.define('Task', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('Active', 'Work in Progress', 'Review', 'Pending', 'Resolved'),
        defaultValue: 'Active'
    },
    category: {
        type: DataTypes.ENUM('Frequency', 'Deadline'),
        defaultValue: 'Deadline'
    },
    clientId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'clients',
            key: 'id'
        }
    },
    // Polymorphic assignment
    assignedToType: {
        type: DataTypes.ENUM('Employee', 'TeamLeader'),
        allowNull: true
    },
    assignedToId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    dueDate: {
        type: DataTypes.DATE,
        allowNull: true
    },
    frequency: {
        type: DataTypes.STRING,
        allowNull: true
    },
    priority: {
        type: DataTypes.ENUM('Low', 'Medium', 'High'),
        defaultValue: 'Medium'
    },
    parentTaskId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'tasks',
            key: 'id'
        }
    }
}, {
    tableName: 'tasks',
    timestamps: true
});

// ============ RECURRING TASK MODEL ============
const RecurringTask = sequelize.define('RecurringTask', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    clientId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'clients',
            key: 'id'
        }
    },
    frequency: {
        type: DataTypes.STRING,
        allowNull: false
    },
    assignedToType: {
        type: DataTypes.ENUM('Employee', 'TeamLeader'),
        allowNull: true
    },
    assignedToId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    priority: {
        type: DataTypes.ENUM('Low', 'Medium', 'High'),
        defaultValue: 'Medium'
    },
    active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'recurring_tasks',
    timestamps: true
});

// ============ NOTIFICATION MODEL ============
const Notification = sequelize.define('Notification', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    userType: {
        type: DataTypes.ENUM('Admin', 'TeamLeader', 'Employee', 'Client'),
        allowNull: false
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('read', 'unread'),
        defaultValue: 'unread'
    },
    readAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    type: {
        type: DataTypes.ENUM('alert', 'message', 'system'),
        defaultValue: 'message'
    },
    priority: {
        type: DataTypes.ENUM('high', 'medium', 'low'),
        defaultValue: 'low'
    }
}, {
    tableName: 'notifications',
    timestamps: true
});

// ============ MESSAGE MODEL ============
const Message = sequelize.define('Message', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    senderId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    senderType: {
        type: DataTypes.ENUM('TeamLeader', 'Client'),
        allowNull: false
    },
    receiverId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    receiverType: {
        type: DataTypes.ENUM('TeamLeader', 'Client'),
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    document: {
        type: DataTypes.JSONB,
        allowNull: true
    },
    messageType: {
        type: DataTypes.ENUM('text', 'document'),
        defaultValue: 'text'
    },
    read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'messages',
    timestamps: true
});

// ============ RECRUITMENT POSITION MODEL ============
const RecruitmentPosition = sequelize.define('RecruitmentPosition', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    location: {
        type: DataTypes.STRING,
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM('Full-time', 'Part-time', 'Contract', 'Internship'),
        defaultValue: 'Full-time'
    },
    salary: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('Open', 'Closed', 'Hold'),
        defaultValue: 'Open'
    },
    priority: {
        type: DataTypes.ENUM('Low', 'Medium', 'High', 'Urgent'),
        defaultValue: 'Medium'
    },
    openings: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    filled: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    skills: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    experience: {
        type: DataTypes.STRING,
        allowNull: true
    },
    clientId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'clients',
            key: 'id'
        }
    },
    teamLeaderId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'team_leaders',
            key: 'id'
        }
    },
        departmentTeamId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'DepartmentTeams',
                key: 'id'
            }
        },
    postedByUserId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    postedByUserType: {
        type: DataTypes.STRING,
        allowNull: true
    },
    postedByName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    postedByEmail: {
        type: DataTypes.STRING,
        allowNull: true
    },
    postedDate: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    deadline: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    postPlatforms: {
        type: DataTypes.JSONB,
        defaultValue: [],
        allowNull: true
    },
    distributedPlatforms: {
        type: DataTypes.JSONB,
        defaultValue: [],
        allowNull: true
    },
    distributionResults: {
        type: DataTypes.JSONB,
        defaultValue: [],
        allowNull: true
    },
    lastDistributedAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'recruitment_positions',
    timestamps: true
});

// ============ CANDIDATE MODEL ============
const Candidate = sequelize.define('Candidate', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    positionId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'recruitment_positions',
            key: 'id'
        }
    },
    clientId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'clients',
            key: 'id'
        }
    },
    cvUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    cvFileName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('Submitted', 'Shared', 'Shortlisted', 'Interview', 'Selected', 'Rejected', 'OnHold'),
        defaultValue: 'Submitted'
    },
    stage: {
        type: DataTypes.ENUM('Screening', 'Phone Interview', 'Technical Round', 'HR Round', 'Client Interview', 'Offer Sent', 'Joined', 'Rejected'),
        defaultValue: 'Screening'
    },
    pipelineStatus: {
        type: DataTypes.ENUM('pending', 'hold', 'approved', 'rejected'),
        defaultValue: 'pending'
    },
    location: {
        type: DataTypes.STRING,
        allowNull: true
    },
    rating: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    noticePeriod: {
        type: DataTypes.STRING,
        allowNull: true
    },
    rejectionReason: {
        type: DataTypes.STRING,
        allowNull: true
    },
    source: {
        type: DataTypes.STRING,
        allowNull: true
    },
    sharedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    shortlistedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    interviewDate: {
        type: DataTypes.DATE,
        allowNull: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    skills: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    experience: {
        type: DataTypes.STRING,
        allowNull: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Password for candidate portal login'
    },
    kycDocuments: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: 'Stores KYC document info { aadhar: { url, verified, verifiedAt }, ... }'
    },
    addedById: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'DepartmentTeams',
            key: 'id'
        }
    },
    addedByType: {
        type: DataTypes.ENUM('Employee', 'TeamLeader', 'DepartmentTeam'),
        allowNull: true
    },
    currentSalary: {
        type: DataTypes.STRING,
        allowNull: true
    },
    expectedSalary: {
        type: DataTypes.STRING,
        allowNull: true
    },
    offeredCTC: {
        type: DataTypes.STRING,
        allowNull: true
    },
    offerDate: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    offerExpiryDate: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    joiningDate: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    negotiationNotes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    offerStatus: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'Draft'
    },
    offerLetterUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    offerLetterFileName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    bgvStatus: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'Not Started'
    },
    addedById: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'DepartmentTeams',
            key: 'id'
        },
        comment: 'The user who added/sourced this candidate'
    },
    skillMatch: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    experienceMatch: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    // For data migration fallback
    teamLeaderId: {
        type: DataTypes.UUID,
        allowNull: true
    }
}, {
    tableName: 'candidates',
    timestamps: true
});

// ============ OFFER TEMPLATE MODEL ============
const OfferTemplate = sequelize.define('OfferTemplate', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    clientId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'clients',
            key: 'id'
        }
    },
    templateUrl: {
        type: DataTypes.STRING,
        allowNull: false
    },
    templateFileName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    fieldMap: {
        type: DataTypes.JSONB,
        defaultValue: {}
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'Active'
    }
}, {
    tableName: 'offer_templates',
    timestamps: true,
    indexes: [
        { fields: ['clientId'] },
        { fields: ['status'] }
    ]
});

// ============ INTERVIEW MODEL ============
const Interview = sequelize.define('Interview', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    candidateId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'candidates',
            key: 'id'
        }
    },
    positionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'recruitment_positions',
            key: 'id'
        }
    },
    clientId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'clients',
            key: 'id'
        }
    },
    // Interview Details
    interviewType: {
        type: DataTypes.ENUM('HR Round', 'Technical Round', 'Client Interview', 'Phone Screening', 'Final Round'),
        allowNull: false
    },
    interviewDate: {
        type: DataTypes.DATE,
        allowNull: false
    },
    startTime: {
        type: DataTypes.STRING,
        allowNull: false
    },
    duration: {
        type: DataTypes.INTEGER,
        defaultValue: 45
    },
    // Meeting Details
    meetingType: {
        type: DataTypes.ENUM('Video', 'In-Person', 'Phone'),
        defaultValue: 'Video',
        allowNull: false
    },
    meetingLink: {
        type: DataTypes.STRING,
        allowNull: true
    },
    meetingToken: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    },
    meetingPassword: {
        type: DataTypes.STRING,
        allowNull: true
    },
    interviewerId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'DepartmentTeams',
            key: 'id'
        }
    },
    interviewerType: {
        type: DataTypes.ENUM('TeamLeader', 'DepartmentTeam', 'Client'),
        allowNull: true
    },
    interviewerName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    interviewerEmail: {
        type: DataTypes.STRING,
        allowNull: true
    },
    interviewerRole: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Rescheduled', 'No Show'),
        defaultValue: 'Scheduled',
        allowNull: false
    },
    evaluation: {
        type: DataTypes.JSONB,
        allowNull: true
    },
    emailSentToCandidate: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    emailSentAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    reminderSent: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    rescheduledFrom: {
        type: DataTypes.DATE,
        allowNull: true
    },
    rescheduleReason: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'interviews',
    timestamps: true
});

// ============ WORK AGREEMENT MODEL ============
const WorkAgreement = sequelize.define('WorkAgreement', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    clientId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'clients',
            key: 'id'
        }
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // JSONB array of allowed service scopes e.g. ["Payroll", "Compliance", "Recruitment"]
    allowedScopes: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: []
    },
    maxTasks: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Maximum concurrent active tasks allowed. null = unlimited'
    },
    startDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    endDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'null = no expiry'
    },
    status: {
        type: DataTypes.ENUM('Active', 'Expired', 'Terminated'),
        defaultValue: 'Active'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'work_agreements',
    timestamps: true
});

// ============ WORK HANDOVER MODEL ============
const WorkHandover = sequelize.define('WorkHandover', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    fromUserId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'The KAM/TeamLeader who is absent'
    },
    toUserId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'The KAM/TeamLeader taking over'
    },
    reason: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Reason for handover (e.g. sick leave, vacation)'
    },
    startDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    endDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    clientIds: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
        comment: 'Array of client UUIDs being handed over'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('Active', 'Completed', 'Cancelled'),
        defaultValue: 'Active'
    },
    createdBy: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'Who created the handover (could be the absent KAM or an admin)'
    }
}, {
    tableName: 'work_handovers',
    timestamps: true
});

// ============ DEFINE ASSOCIATIONS ============

// Admin -> TeamLeader (One to Many)
Admin.hasMany(TeamLeader, { foreignKey: 'adminId', as: 'teamLeaders' });
TeamLeader.belongsTo(Admin, { foreignKey: 'adminId', as: 'admin' });

// TeamLeader <-> Employee (Many to Many)
TeamLeader.belongsToMany(Employee, { through: EmployeeTeamLeader, foreignKey: 'teamLeaderId', as: 'employees' });
Employee.belongsToMany(TeamLeader, { through: EmployeeTeamLeader, foreignKey: 'employeeId', as: 'teamLeaders' });

// TeamLeader -> Client (One to Many)
TeamLeader.hasMany(Client, { foreignKey: 'teamLeaderId', as: 'clients' });
Client.belongsTo(TeamLeader, { foreignKey: 'teamLeaderId', as: 'teamLeader' });

// Client -> RequestTask (One to Many)
Client.hasMany(RequestTask, { foreignKey: 'clientId', as: 'requestedTasks' });
RequestTask.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });

// Client -> Task (One to Many)
Client.hasMany(Task, { foreignKey: 'clientId', as: 'tasks' });
Task.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });

// Task -> Task (Self-referential for parent task)
Task.hasMany(Task, { foreignKey: 'parentTaskId', as: 'childTasks' });
Task.belongsTo(Task, { foreignKey: 'parentTaskId', as: 'parentTask' });

// Client -> RecurringTask (One to Many)
Client.hasMany(RecurringTask, { foreignKey: 'clientId', as: 'recurringTasks' });
RecurringTask.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });

// Client -> WorkAgreement (One to Many)
Client.hasMany(WorkAgreement, { foreignKey: 'clientId', as: 'workAgreements' });
WorkAgreement.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });

// Client -> RecruitmentPosition (One to Many)
Client.hasMany(RecruitmentPosition, { foreignKey: 'clientId', as: 'recruitmentPositions' });
RecruitmentPosition.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });

Client.hasMany(OfferTemplate, { foreignKey: 'clientId', as: 'offerTemplates' });
OfferTemplate.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });

// TeamLeader -> RecruitmentPosition (One to Many)
TeamLeader.hasMany(RecruitmentPosition, { foreignKey: 'teamLeaderId', as: 'recruitmentPositions' });
RecruitmentPosition.belongsTo(TeamLeader, { foreignKey: 'teamLeaderId', as: 'teamLeader' });

// RecruitmentPosition -> Candidate (One to Many)
RecruitmentPosition.hasMany(Candidate, { foreignKey: 'positionId', as: 'candidates' });
Candidate.belongsTo(RecruitmentPosition, { foreignKey: 'positionId', as: 'position' });

// Client -> Candidate (One to Many)
Client.hasMany(Candidate, { foreignKey: 'clientId', as: 'candidates' });
Candidate.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });

// Candidate/Position/Client -> Interview (One to Many)
Candidate.hasMany(Interview, { foreignKey: 'candidateId', as: 'interviews' });
Interview.belongsTo(Candidate, { foreignKey: 'candidateId', as: 'candidate' });

RecruitmentPosition.hasMany(Interview, { foreignKey: 'positionId', as: 'interviews' });
Interview.belongsTo(RecruitmentPosition, { foreignKey: 'positionId', as: 'position' });

Client.hasMany(Interview, { foreignKey: 'clientId', as: 'interviews' });
Interview.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });

// TeamLeader -> WorkHandover (One to Many, from)
TeamLeader.hasMany(WorkHandover, { foreignKey: 'fromUserId', as: 'handoversOut' });
WorkHandover.belongsTo(TeamLeader, { foreignKey: 'fromUserId', as: 'fromUser' });

// TeamLeader -> WorkHandover (One to Many, to)
TeamLeader.hasMany(WorkHandover, { foreignKey: 'toUserId', as: 'handoversIn' });
WorkHandover.belongsTo(TeamLeader, { foreignKey: 'toUserId', as: 'toUser' });

// Helper function to get assigned user for Task/RecurringTask
Task.prototype.getAssignedUser = async function() {
    if (this.assignedToType === 'Employee') {
        return await Employee.findByPk(this.assignedToId);
    } else if (this.assignedToType === 'TeamLeader') {
        return await TeamLeader.findByPk(this.assignedToId);
    }
    return null;
};

RecurringTask.prototype.getAssignedUser = async function() {
    if (this.assignedToType === 'Employee') {
        return await Employee.findByPk(this.assignedToId);
    } else if (this.assignedToType === 'TeamLeader') {
        return await TeamLeader.findByPk(this.assignedToId);
    }
    return null;
};

// ============ DEPARTMENT TEAM MODEL ============
class DepartmentTeam extends Model {}

DepartmentTeam.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    phone: {
        type: DataTypes.STRING
    },
    role: {
        type: DataTypes.STRING,
        defaultValue: 'Team Member'
    },
    department: {
        type: DataTypes.ENUM('HR Operations', 'HR Recruitment', 'Operations', 'KAM Operations'),
        allowNull: false
    },
    managerId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('Active', 'Inactive', 'On Leave'),
        defaultValue: 'Active'
    },
    avatar: {
        type: DataTypes.STRING
    },
    skills: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    joinDate: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    tasksCompleted: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    tasksAssigned: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    avgResponseTime: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    }
}, {
    sequelize,
    modelName: 'DepartmentTeam',
    tableName: 'DepartmentTeams',
    timestamps: true
});

// DepartmentTeam self-referential relationship (Head managing KAMs)
DepartmentTeam.hasMany(DepartmentTeam, { foreignKey: 'managerId', as: 'managedMembers' });
DepartmentTeam.belongsTo(DepartmentTeam, { foreignKey: 'managerId', as: 'manager' });

// DepartmentTeam -> RecruitmentPosition (One to Many, posted by)
DepartmentTeam.hasMany(RecruitmentPosition, { foreignKey: 'departmentTeamId', as: 'postedPositions' });
RecruitmentPosition.belongsTo(DepartmentTeam, { foreignKey: 'departmentTeamId', as: 'postedBy' });
Candidate.belongsTo(DepartmentTeam, { foreignKey: 'addedById', as: 'addedBy' });

// ============== RESUME BANK MODEL ==============
class ResumeBank extends Model {}

ResumeBank.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    // Storage identifiers
    sharePointId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    driveId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    s3Key: {
        type: DataTypes.STRING
    },
    // File details
    fileName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    fileType: {
        type: DataTypes.ENUM('pdf', 'doc', 'docx'),
        allowNull: false
    },
    fileSize: {
        type: DataTypes.INTEGER
    },
    // Role categorization
    roleType: {
        type: DataTypes.STRING,
        allowNull: false
    },
    subRole: {
        type: DataTypes.STRING
    },
    // Candidate details
    candidateName: {
        type: DataTypes.STRING
    },
    email: {
        type: DataTypes.STRING
    },
    phone: {
        type: DataTypes.STRING
    },
    experience: {
        type: DataTypes.STRING
    },
    skills: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    currentCompany: {
        type: DataTypes.STRING
    },
    currentLocation: {
        type: DataTypes.STRING
    },
    preferredLocation: {
        type: DataTypes.STRING
    },
    currentSalary: {
        type: DataTypes.STRING
    },
    expectedSalary: {
        type: DataTypes.STRING
    },
    noticePeriod: {
        type: DataTypes.STRING
    },
    // URLs
    webUrl: {
        type: DataTypes.STRING
    },
    downloadUrl: {
        type: DataTypes.STRING
    },
    folderPath: {
        type: DataTypes.STRING
    },
    // Status tracking
    status: {
        type: DataTypes.ENUM('Available', 'Shortlisted', 'Contacted', 'Interview Scheduled', 'Hired', 'Rejected', 'Not Interested'),
        defaultValue: 'Available'
    },
    lastContactedAt: {
        type: DataTypes.DATE
    },
    contactNotes: {
        type: DataTypes.TEXT
    },
    // Assignment
    assignedToId: {
        type: DataTypes.UUID
    },
    assignedPositionId: {
        type: DataTypes.UUID
    },
    // Sync metadata
    lastSyncedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    sharePointCreatedAt: {
        type: DataTypes.DATE
    },
    sharePointModifiedAt: {
        type: DataTypes.DATE
    },
    sharePointCreatedBy: {
        type: DataTypes.STRING
    },
    // Tags and rating
    tags: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    rating: {
        type: DataTypes.INTEGER
    },
    isStarred: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    sequelize,
    modelName: 'ResumeBank',
    tableName: 'ResumeBanks',
    timestamps: true,
    indexes: [
        { fields: ['roleType'] },
        { fields: ['status'] },
        { fields: ['sharePointId'], unique: true }
    ]
});

// ResumeBank -> RecruitmentPosition (One to Many)
ResumeBank.belongsTo(RecruitmentPosition, { foreignKey: 'assignedPositionId', as: 'position' });
RecruitmentPosition.hasMany(ResumeBank, { foreignKey: 'assignedPositionId', as: 'resumes' });

// ============== DEPARTMENT TASK MODEL ==============
class DepartmentTask extends Model {}

DepartmentTask.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT
    },
    department: {
        type: DataTypes.ENUM('HR Operations', 'HR Recruitment'),
        allowNull: false
    },
    assignedBy: {
        type: DataTypes.UUID,
        allowNull: false
    },
    assignedByName: {
        type: DataTypes.STRING
    },
    assignedTo: {
        type: DataTypes.UUID,
        allowNull: false
    },
    assignedToName: {
        type: DataTypes.STRING
    },
    status: {
        type: DataTypes.ENUM('Pending', 'In Progress', 'Completed', 'Overdue'),
        defaultValue: 'Pending'
    },
    priority: {
        type: DataTypes.ENUM('Low', 'Medium', 'High', 'Urgent'),
        defaultValue: 'Medium'
    },
    dueDate: {
        type: DataTypes.DATE
    },
    completedAt: {
        type: DataTypes.DATE
    },
    comments: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    positionId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'recruitment_positions',
            key: 'id'
        }
    },
    candidateId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'candidates',
            key: 'id'
        }
    }
}, {
    sequelize,
    modelName: 'DepartmentTask',
    tableName: 'DepartmentTasks',
    timestamps: true
});

// RecruitmentPosition -> DepartmentTask (One to Many)
RecruitmentPosition.hasMany(DepartmentTask, { foreignKey: 'positionId', as: 'tasks' });
DepartmentTask.belongsTo(RecruitmentPosition, { foreignKey: 'positionId', as: 'position' });

// Candidate -> DepartmentTask (One to Many)
Candidate.hasMany(DepartmentTask, { foreignKey: 'candidateId', as: 'tasks' });
DepartmentTask.belongsTo(Candidate, { foreignKey: 'candidateId', as: 'candidate' });

// ============== ACTIVITY LOG MODEL ==============
class ActivityLog extends Model {}

ActivityLog.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    department: {
        type: DataTypes.ENUM('HR Operations', 'HR Recruitment'),
        allowNull: false
    },
    performedBy: {
        type: DataTypes.STRING,
        allowNull: false
    },
    performedByType: {
        type: DataTypes.ENUM('TeamLeader', 'DepartmentTeam'),
        allowNull: false
    },
    performedByName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    action: {
        type: DataTypes.STRING,
        allowNull: false
    },
    actionType: {
        type: DataTypes.ENUM('task', 'leave', 'payroll', 'attendance', 'candidate', 'interview', 'offer', 'general'),
        defaultValue: 'general'
    },
    description: {
        type: DataTypes.STRING,
        allowNull: false
    },
    relatedEntity: {
        type: DataTypes.STRING
    },
    relatedEntityType: {
        type: DataTypes.STRING
    },
    metadata: {
        type: DataTypes.JSONB
    }
}, {
    sequelize,
    modelName: 'ActivityLog',
    tableName: 'ActivityLogs',
    timestamps: true
});

// ============== LEAVE REQUEST MODEL ==============
const LeaveRequest = sequelize.define('LeaveRequest', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    memberId: { type: DataTypes.UUID, allowNull: false },
    memberName: { type: DataTypes.STRING, allowNull: false },
    department: { type: DataTypes.ENUM('HR Operations', 'HR Recruitment', 'Operations', 'KAM Operations'), allowNull: false },
    leaveType: { type: DataTypes.ENUM('Casual Leave', 'Sick Leave', 'Earned Leave', 'Half Day', 'Work From Home', 'Compensatory Off', 'Maternity Leave', 'Casual', 'Sick', 'Earned'), allowNull: false },
    startDate: { type: DataTypes.DATEONLY, allowNull: false },
    endDate: { type: DataTypes.DATEONLY, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'), defaultValue: 'Pending' },
    approvedBy: { type: DataTypes.UUID },
    approverName: { type: DataTypes.STRING },
    approverComment: { type: DataTypes.TEXT },
    totalDays: { type: DataTypes.FLOAT, defaultValue: 1 },
}, { tableName: 'LeaveRequests', timestamps: true });

// ============== ATTENDANCE MODEL ==============
const Attendance = sequelize.define('Attendance', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    memberId: { type: DataTypes.UUID, allowNull: false },
    clientId: { type: DataTypes.UUID, allowNull: true },
    memberName: { type: DataTypes.STRING, allowNull: false },
    department: { type: DataTypes.ENUM('HR Operations', 'HR Recruitment'), allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    checkIn: { type: DataTypes.DATE },
    checkOut: { type: DataTypes.DATE },
    status: { type: DataTypes.ENUM('Present', 'Absent', 'Half Day', 'On Leave', 'WFH'), defaultValue: 'Present' },
    workHours: { type: DataTypes.FLOAT, defaultValue: 0 },
    notes: { type: DataTypes.STRING },
}, { tableName: 'Attendances', timestamps: true });

// ============== DAILY REPORT MODEL ==============
const DailyReport = sequelize.define('DailyReport', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    memberId: { type: DataTypes.UUID, allowNull: false },
    memberName: { type: DataTypes.STRING, allowNull: false },
    department: { type: DataTypes.ENUM('HR Operations', 'HR Recruitment'), allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    // Work Timing (MIS)
    checkInTime: { type: DataTypes.STRING, allowNull: true },  // e.g. '09:05'
    checkOutTime: { type: DataTypes.STRING, allowNull: true }, // e.g. '18:35'
    workHours: { type: DataTypes.FLOAT, defaultValue: 0 },
    // KPI Metrics (MIS)
    callsCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    profilesVisited: { type: DataTypes.INTEGER, defaultValue: 0 },
    profilesShared: { type: DataTypes.INTEGER, defaultValue: 0 },
    candidatesContacted: { type: DataTypes.INTEGER, defaultValue: 0 },
    interviewsArranged: { type: DataTypes.INTEGER, defaultValue: 0 },
    // Existing fields
    summary: { type: DataTypes.TEXT, allowNull: false },
    tasksCompleted: { type: DataTypes.JSONB, defaultValue: [] },
    tasksPlanned: { type: DataTypes.JSONB, defaultValue: [] },
    blockers: { type: DataTypes.TEXT },
    mood: { type: DataTypes.ENUM('Great', 'Good', 'Okay', 'Tough'), defaultValue: 'Good' },
    headComment: { type: DataTypes.TEXT },
    headCommentBy: { type: DataTypes.STRING, allowNull: true },
    headCommentAt: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'DailyReports', timestamps: true });

// ============== ANNOUNCEMENT MODEL ==============
const Announcement = sequelize.define('Announcement', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    department: { type: DataTypes.ENUM('HR Operations', 'HR Recruitment'), allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    priority: { type: DataTypes.ENUM('Low', 'Medium', 'High', 'Urgent'), defaultValue: 'Medium' },
    postedBy: { type: DataTypes.UUID, allowNull: false },
    postedByName: { type: DataTypes.STRING, allowNull: false },
    expiresAt: { type: DataTypes.DATE },
    pinned: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'Announcements', timestamps: true });

// ============== DEPARTMENT DOCUMENT MODEL ==============
const DeptDocument = sequelize.define('DeptDocument', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    department: { type: DataTypes.ENUM('HR Operations', 'HR Recruitment'), allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    fileUrl: { type: DataTypes.STRING, allowNull: false },
    fileType: { type: DataTypes.STRING },
    fileSize: { type: DataTypes.INTEGER },
    uploadedBy: { type: DataTypes.UUID, allowNull: false },
    uploadedByName: { type: DataTypes.STRING, allowNull: false },
    category: { type: DataTypes.ENUM('Policy', 'Template', 'Report', 'Training', 'Other'), defaultValue: 'Other' },
}, { tableName: 'DeptDocuments', timestamps: true });

// ============== TRAINING MODEL ==============
const Training = sequelize.define('Training', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    memberId: { type: DataTypes.UUID, allowNull: false },
    memberName: { type: DataTypes.STRING, allowNull: false },
    department: { type: DataTypes.ENUM('HR Operations', 'HR Recruitment'), allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    category: { type: DataTypes.ENUM('Skill Development', 'Certification', 'Workshop', 'Webinar', 'On-the-Job'), defaultValue: 'Skill Development' },
    status: { type: DataTypes.ENUM('Not Started', 'In Progress', 'Completed'), defaultValue: 'Not Started' },
    startDate: { type: DataTypes.DATEONLY },
    completedDate: { type: DataTypes.DATEONLY },
    certificateUrl: { type: DataTypes.STRING },
    progress: { type: DataTypes.INTEGER, defaultValue: 0 },
    assignedBy: { type: DataTypes.UUID },
    assignedByName: { type: DataTypes.STRING },
}, { tableName: 'Trainings', timestamps: true });

// ============== PAYSLIP MODEL ==============
const Payslip = sequelize.define('Payslip', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    memberId: { type: DataTypes.UUID, allowNull: false },
    memberName: { type: DataTypes.STRING, allowNull: false },
    department: { type: DataTypes.ENUM('HR Operations', 'HR Recruitment'), allowNull: false },
    month: { type: DataTypes.STRING, allowNull: false },
    year: { type: DataTypes.INTEGER, allowNull: false },
    basicSalary: { type: DataTypes.FLOAT, defaultValue: 0 },
    hra: { type: DataTypes.FLOAT, defaultValue: 0 },
    otherAllowances: { type: DataTypes.FLOAT, defaultValue: 0 },
    deductions: { type: DataTypes.FLOAT, defaultValue: 0 },
    netSalary: { type: DataTypes.FLOAT, defaultValue: 0 },
    status: { type: DataTypes.ENUM('Generated', 'Paid'), defaultValue: 'Generated' },
    paidDate: { type: DataTypes.DATEONLY },
    fileUrl: { type: DataTypes.STRING },
}, { tableName: 'Payslips', timestamps: true });


// ============== DEPARTMENT CHAT MODEL ==============
const DeptChat = sequelize.define('DeptChat', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    department: { type: DataTypes.ENUM('HR Operations', 'HR Recruitment'), allowNull: false },
    senderId: { type: DataTypes.UUID, allowNull: false },
    senderName: { type: DataTypes.STRING, allowNull: false },
    senderRole: { type: DataTypes.STRING },
    message: { type: DataTypes.TEXT, allowNull: false },
    messageType: { type: DataTypes.ENUM('text', 'file', 'image'), defaultValue: 'text' },
    fileUrl: { type: DataTypes.STRING },
    replyTo: { type: DataTypes.UUID },
}, { tableName: 'DeptChats', timestamps: true });

// ============== DEPARTMENT NOTE MODEL ==============
const DepartmentNote = sequelize.define('DepartmentNote', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    department: { type: DataTypes.ENUM('HR Operations', 'HR Recruitment'), allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    category: { type: DataTypes.STRING, defaultValue: 'General' },
    priority: { type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'), defaultValue: 'normal' },
    createdById: { type: DataTypes.UUID, allowNull: true },
    createdByName: { type: DataTypes.STRING, allowNull: true },
}, { tableName: 'DepartmentNotes', timestamps: true });

// ============== SHAREPOINT CANDIDATE MODEL ============== 
const SharePointCandidate = sequelize.define('SharePointCandidate', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    sharePointId: { type: DataTypes.STRING, allowNull: false, unique: true },
    name: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING },
    position: { type: DataTypes.STRING },
    client: { type: DataTypes.STRING },
    stage: { type: DataTypes.STRING, defaultValue: 'Screening' },
    status: { type: DataTypes.STRING, defaultValue: 'Active' },
    assignedTo: { type: DataTypes.STRING },
    notes: { type: DataTypes.TEXT },
    lastSyncedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    sharePointCreatedAt: { type: DataTypes.DATE },
    sharePointModifiedAt: { type: DataTypes.DATE },
}, {
    tableName: 'sharepoint_candidates',
    timestamps: true,
    indexes: [
        { fields: ['sharePointId'], unique: true },
        { fields: ['client'] },
        { fields: ['status'] }
    ]
});

// ============== SHAREPOINT INTERVIEW MODEL ==============
const SharePointInterview = sequelize.define('SharePointInterview', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    sharePointId: { type: DataTypes.STRING, allowNull: false, unique: true },
    candidateName: { type: DataTypes.STRING },
    position: { type: DataTypes.STRING },
    client: { type: DataTypes.STRING },
    round: { type: DataTypes.STRING },
    interviewType: { type: DataTypes.STRING },
    interviewDate: { type: DataTypes.DATE },
    interviewTime: { type: DataTypes.STRING },
    interviewer: { type: DataTypes.STRING },
    status: { type: DataTypes.STRING, defaultValue: 'Scheduled' },
    meetLink: { type: DataTypes.STRING },
    assignedTo: { type: DataTypes.STRING },
    notes: { type: DataTypes.TEXT },
    lastSyncedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    sharePointCreatedAt: { type: DataTypes.DATE },
}, {
    tableName: 'sharepoint_interviews',
    timestamps: true,
    indexes: [
        { fields: ['sharePointId'], unique: true },
        { fields: ['client'] },
        { fields: ['status'] }
    ]
});

// ============== SHAREPOINT CLIENT MODEL ==============
const SharePointClient = sequelize.define('SharePointClient', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    sharePointId: { type: DataTypes.STRING, allowNull: false, unique: true },
    name: { type: DataTypes.STRING },
    industry: { type: DataTypes.STRING },
    contactPerson: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING },
    location: { type: DataTypes.STRING },
    status: { type: DataTypes.STRING, defaultValue: 'Active' },
    assignedKAM: { type: DataTypes.STRING },
    openPositions: { type: DataTypes.INTEGER, defaultValue: 0 },
    lastSyncedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    sharePointCreatedAt: { type: DataTypes.DATE },
}, {
    tableName: 'sharepoint_clients',
    timestamps: true,
    indexes: [
        { fields: ['sharePointId'], unique: true },
        { fields: ['status'] }
    ]
});

// ============== SHAREPOINT SYNC LOG ==============
const SharePointSyncLog = sequelize.define('SharePointSyncLog', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    syncType: { type: DataTypes.STRING, allowNull: false }, // 'candidates', 'interviews', 'clients', 'resumes', 'all'
    status: { type: DataTypes.ENUM('success', 'partial', 'failed'), defaultValue: 'success' },
    totalFetched: { type: DataTypes.INTEGER, defaultValue: 0 },
    created: { type: DataTypes.INTEGER, defaultValue: 0 },
    updated: { type: DataTypes.INTEGER, defaultValue: 0 },
    errors: { type: DataTypes.INTEGER, defaultValue: 0 },
    errorDetails: { type: DataTypes.JSONB, defaultValue: [] },
    syncedById: { type: DataTypes.UUID },
    syncedByName: { type: DataTypes.STRING },
    syncedByRole: { type: DataTypes.STRING },
    durationMs: { type: DataTypes.INTEGER },
}, {
    tableName: 'sharepoint_sync_logs',
    timestamps: true,
});

// ============== REGULARIZATION REQUEST MODEL ==============
const RegularizationRequest = sequelize.define('RegularizationRequest', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    memberId: { type: DataTypes.UUID, allowNull: false },
    memberName: { type: DataTypes.STRING, allowNull: false },
    department: { type: DataTypes.ENUM('HR Operations', 'HR Recruitment'), allowNull: false },
    attendanceId: { type: DataTypes.UUID, allowNull: true },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    requestType: { type: DataTypes.STRING, allowNull: false }, // 'Missed In', 'Missed Out', 'Full Day', 'Half Day'
    proposedCheckIn: { type: DataTypes.DATE },
    proposedCheckOut: { type: DataTypes.DATE },
    reason: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'), defaultValue: 'Pending' },
    approvedBy: { type: DataTypes.UUID },
    approverName: { type: DataTypes.STRING },
    approverComment: { type: DataTypes.TEXT },
}, { tableName: 'RegularizationRequests', timestamps: true });

module.exports = {
    sequelize,
    SuperAdmin,
    Admin,
    TeamLeader,
    Employee,
    EmployeeTeamLeader,
    Client,
    RequestTask,
    Task,
    RecurringTask,
    Notification,
    Message,
    RecruitmentPosition,
    Candidate,
    OfferTemplate,
    Interview,
    WorkAgreement,
    WorkHandover,
    DepartmentTeam,
    ResumeBank,
    DepartmentTask,
    ActivityLog,
    LeaveRequest,
    Attendance,
    DailyReport,
    Announcement,
    DeptDocument,
    Training,
    Payslip,
    DeptChat,
    DepartmentNote,
    SharePointCandidate,
    SharePointInterview,
    SharePointClient,
    SharePointSyncLog,
    RegularizationRequest,
};
