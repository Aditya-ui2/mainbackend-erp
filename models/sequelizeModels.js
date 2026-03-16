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
            ssl: {
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
    Message
};
