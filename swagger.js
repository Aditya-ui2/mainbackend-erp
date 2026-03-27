const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'MabiconsERP API',
            version: '1.0.0',
            description: 'API documentation for MabiconsERP Backend - Complete HR/Task Management System',
            contact: {
                name: 'API Support'
            }
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Development server'
            },
            {
                url: 'http://15.206.67.102:3000',
                description: 'Production server (AWS EC2)'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            },
            schemas: {
                // Auth Schemas
                ForgotPassword: {
                    type: 'object',
                    required: ['email', 'userType'],
                    properties: {
                        email: { type: 'string', format: 'email' },
                        userType: { type: 'string', enum: ['superadmin', 'admin', 'teamleader', 'employee', 'client'] }
                    }
                },
                ResetPassword: {
                    type: 'object',
                    required: ['password', 'token', 'userType'],
                    properties: {
                        password: { type: 'string' },
                        token: { type: 'string' },
                        userType: { type: 'string', enum: ['superadmin', 'admin', 'teamleader', 'employee', 'client'] }
                    }
                },

                // SuperAdmin Schemas
                SuperAdminLogin: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string' }
                    }
                },
                SuperAdminEdit: {
                    type: 'object',
                    required: ['superAdminId'],
                    properties: {
                        superAdminId: { type: 'string' },
                        name: { type: 'string' },
                        password: { type: 'string' }
                    }
                },

                // Admin Schemas
                AdminCreate: {
                    type: 'object',
                    required: ['name', 'email'],
                    properties: {
                        name: { type: 'string' },
                        email: { type: 'string', format: 'email' }
                    }
                },
                AdminLogin: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string' }
                    }
                },
                AdminEdit: {
                    type: 'object',
                    required: ['adminId'],
                    properties: {
                        adminId: { type: 'string' },
                        name: { type: 'string' },
                        password: { type: 'string' }
                    }
                },
                AdminHierarchy: {
                    type: 'object',
                    required: ['adminId'],
                    properties: {
                        adminId: { type: 'string' }
                    }
                },

                // TeamLeader Schemas
                TeamLeaderCreate: {
                    type: 'object',
                    required: ['name', 'email', 'adminId'],
                    properties: {
                        name: { type: 'string' },
                        email: { type: 'string', format: 'email' },
                        adminId: { type: 'string' },
                        phone: { type: 'string' }
                    }
                },
                TeamLeaderLogin: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string' }
                    }
                },
                TeamLeaderEdit: {
                    type: 'object',
                    required: ['id'],
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        phone: { type: 'string' },
                        password: { type: 'string' }
                    }
                },
                TeamLeaderDelete: {
                    type: 'object',
                    required: ['teamLeaderId', 'newTeamLeaderId'],
                    properties: {
                        teamLeaderId: { type: 'string' },
                        newTeamLeaderId: { type: 'string' }
                    }
                },
                TeamLeaderPromote: {
                    type: 'object',
                    required: ['oldTeamLeaderId', 'employeeToPromoteId'],
                    properties: {
                        oldTeamLeaderId: { type: 'string' },
                        employeeToPromoteId: { type: 'string' }
                    }
                },

                // Employee Schemas
                EmployeeCreate: {
                    type: 'object',
                    required: ['name', 'email', 'teamLeaderIds'],
                    properties: {
                        name: { type: 'string' },
                        email: { type: 'string', format: 'email' },
                        teamLeaderIds: { type: 'array', items: { type: 'string' } },
                        phone: { type: 'string' }
                    }
                },
                EmployeeLogin: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string' }
                    }
                },
                EmployeeEdit: {
                    type: 'object',
                    required: ['id'],
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        phone: { type: 'string' },
                        password: { type: 'string' }
                    }
                },

                // Client Schemas
                ClientSignup: {
                    type: 'object',
                    required: ['name', 'email', 'companyName', 'corporateAddress', 'contactNumber', 'gstNumber', 'panNumber', 'numberOfCompanies', 'spocName', 'spocContact', 'authorizedSignatory', 'ownerDirectorDetails'],
                    properties: {
                        name: { type: 'string' },
                        email: { type: 'string', format: 'email' },
                        companyName: { type: 'string' },
                        corporateAddress: { type: 'string' },
                        contactNumber: { type: 'string' },
                        gstNumber: { type: 'string' },
                        panNumber: { type: 'string' },
                        cinNumber: { type: 'string' },
                        numberOfCompanies: { type: 'number' },
                        spocName: { type: 'string' },
                        spocContact: { type: 'string' },
                        website: { type: 'string' },
                        authorizedSignatory: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                contact: { type: 'string' },
                                email: { type: 'string', format: 'email' }
                            }
                        },
                        ownerDirectorDetails: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    contact: { type: 'string' },
                                    email: { type: 'string', format: 'email' }
                                }
                            }
                        }
                    }
                },
                ClientLogin: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string' }
                    }
                },
                ClientOnboard: {
                    type: 'object',
                    required: ['clientId', 'action'],
                    properties: {
                        clientId: { type: 'string' },
                        action: { type: 'string', enum: ['Accepted', 'Rejected'] },
                        teamLeaderId: { type: 'string', description: 'Required if action is Accepted' }
                    }
                },

                // Task Schemas
                TaskRequest: {
                    type: 'object',
                    required: ['title', 'description', 'clientId', 'category'],
                    properties: {
                        title: { type: 'string' },
                        description: { type: 'string' },
                        clientId: { type: 'string' },
                        category: { type: 'string', enum: ['Frequency', 'Deadline'] },
                        frequency: { type: 'string', description: 'Required if category is Frequency' },
                        dueDate: { type: 'string', format: 'date', description: 'Required if category is Deadline' },
                        priority: { type: 'string', enum: ['Low', 'Medium', 'High'] }
                    }
                },
                TaskAcceptReject: {
                    type: 'object',
                    required: ['requestedTaskId', 'action'],
                    properties: {
                        requestedTaskId: { type: 'string' },
                        action: { type: 'string', enum: ['accept', 'reject'] },
                        assignedUserId: { type: 'string', description: 'Required if action is accept' },
                        assignedUserType: { type: 'string', enum: ['Employee', 'TeamLeader'], description: 'Required if action is accept' },
                        rejectionReason: { type: 'string', description: 'Required if action is reject' }
                    }
                },
                TaskCreate: {
                    type: 'object',
                    required: ['title', 'description', 'clientId', 'category', 'priority', 'assignedUserId', 'assignedUserType'],
                    properties: {
                        title: { type: 'string' },
                        description: { type: 'string' },
                        clientId: { type: 'string' },
                        category: { type: 'string', enum: ['Deadline', 'Frequency'] },
                        frequency: { type: 'string' },
                        dueDate: { type: 'string', format: 'date' },
                        priority: { type: 'string', enum: ['Low', 'Medium', 'High'] },
                        assignedUserId: { type: 'string' },
                        assignedUserType: { type: 'string', enum: ['Employee', 'TeamLeader'] }
                    }
                },
                TaskUpdateStatus: {
                    type: 'object',
                    required: ['taskId', 'status'],
                    properties: {
                        taskId: { type: 'string' },
                        status: { type: 'string', enum: ['Active', 'Work in Progress', 'Review', 'Pending', 'Resolved'] }
                    }
                },

                // Notification Schemas
                NotificationGet: {
                    type: 'object',
                    required: ['userId'],
                    properties: {
                        userId: { type: 'string' }
                    }
                },
                NotificationMarkRead: {
                    type: 'object',
                    required: ['notificationId'],
                    properties: {
                        notificationId: { type: 'string' }
                    }
                },

                // Chat Schemas
                MessageMarkRead: {
                    type: 'object',
                    required: ['senderId', 'receiverId'],
                    properties: {
                        senderId: { type: 'string' },
                        receiverId: { type: 'string' }
                    }
                },

                // Response Schemas
                SuccessResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        message: { type: 'string' }
                    }
                },
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string' }
                    }
                },
                LoginResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        message: { type: 'string' },
                        token: { type: 'string' },
                        user: { type: 'object' }
                    }
                }
            }
        },
        tags: [
            { name: 'Auth', description: 'Authentication and Password Reset' },
            { name: 'SuperAdmin', description: 'SuperAdmin management' },
            { name: 'Admin', description: 'Admin management' },
            { name: 'TeamLeader', description: 'Team Leader management' },
            { name: 'Employee', description: 'Employee management' },
            { name: 'Client', description: 'Client management' },
            { name: 'Task', description: 'Task and Recurring Task management' },
            { name: 'Notification', description: 'Notification management' },
            { name: 'Chat', description: 'Real-time messaging' }
        ],
        paths: {
            // ============ AUTH ROUTES ============
            '/auth/forgot-password': {
                post: {
                    tags: ['Auth'],
                    summary: 'Request password reset link',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/ForgotPassword' } } }
                    },
                    responses: {
                        200: { description: 'Reset link sent to email' },
                        400: { description: 'Invalid request' }
                    }
                }
            },
            '/auth/reset-password': {
                post: {
                    tags: ['Auth'],
                    summary: 'Reset password with token',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/ResetPassword' } } }
                    },
                    responses: {
                        200: { description: 'Password reset successful' },
                        400: { description: 'Invalid or expired token' }
                    }
                }
            },

            // ============ SUPERADMIN ROUTES ============
            '/superAdmin/login': {
                post: {
                    tags: ['SuperAdmin'],
                    summary: 'SuperAdmin login',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/SuperAdminLogin' } } }
                    },
                    responses: {
                        200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
                        401: { description: 'Invalid credentials' }
                    }
                }
            },
            '/superAdmin/edit': {
                put: {
                    tags: ['SuperAdmin'],
                    summary: 'Edit SuperAdmin profile',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/SuperAdminEdit' } } }
                    },
                    responses: {
                        200: { description: 'Profile updated successfully' },
                        401: { description: 'Unauthorized' }
                    }
                }
            },

            // ============ ADMIN ROUTES ============
            '/admin/create': {
                post: {
                    tags: ['Admin'],
                    summary: 'Create new Admin (SuperAdmin only)',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminCreate' } } }
                    },
                    responses: {
                        201: { description: 'Admin created successfully' },
                        401: { description: 'Unauthorized' }
                    }
                }
            },
            '/admin/login': {
                post: {
                    tags: ['Admin'],
                    summary: 'Admin login',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminLogin' } } }
                    },
                    responses: {
                        200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
                        401: { description: 'Invalid credentials' }
                    }
                }
            },
            '/admin/edit': {
                put: {
                    tags: ['Admin'],
                    summary: 'Edit Admin details',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminEdit' } } }
                    },
                    responses: {
                        200: { description: 'Admin updated successfully' },
                        401: { description: 'Unauthorized' }
                    }
                }
            },
            '/admin/delete': {
                delete: {
                    tags: ['Admin'],
                    summary: 'Delete Admin',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'object', required: ['adminId'], properties: { adminId: { type: 'string' } } } } }
                    },
                    responses: {
                        200: { description: 'Admin deleted successfully' }
                    }
                }
            },
            '/admin/hierarchy': {
                post: {
                    tags: ['Admin'],
                    summary: 'Get Admin team hierarchy (Admin→TeamLeaders→Employees)',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminHierarchy' } } }
                    },
                    responses: {
                        200: { description: 'Hierarchy retrieved successfully' }
                    }
                }
            },
            '/admin/update-password': {
                post: {
                    tags: ['Admin'],
                    summary: 'Update Admin password',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'object', properties: { adminId: { type: 'string' }, newPassword: { type: 'string' } } } } }
                    },
                    responses: {
                        200: { description: 'Password updated successfully' }
                    }
                }
            },

            // ============ TEAMLEADER ROUTES ============
            '/teamLeader/create': {
                post: {
                    tags: ['TeamLeader'],
                    summary: 'Create new TeamLeader',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/TeamLeaderCreate' } } }
                    },
                    responses: {
                        201: { description: 'TeamLeader created successfully' },
                        401: { description: 'Unauthorized' }
                    }
                }
            },
            '/teamLeader/login': {
                post: {
                    tags: ['TeamLeader'],
                    summary: 'TeamLeader login',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/TeamLeaderLogin' } } }
                    },
                    responses: {
                        200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
                        401: { description: 'Invalid credentials' }
                    }
                }
            },
            '/teamLeader/edit': {
                put: {
                    tags: ['TeamLeader'],
                    summary: 'Edit TeamLeader profile',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/TeamLeaderEdit' } } }
                    },
                    responses: {
                        200: { description: 'TeamLeader updated successfully' },
                        401: { description: 'Unauthorized' }
                    }
                }
            },
            '/teamLeader/deleteTeamLeaderWithReassignment': {
                delete: {
                    tags: ['TeamLeader'],
                    summary: 'Delete TeamLeader and reassign to another',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/TeamLeaderDelete' } } }
                    },
                    responses: {
                        200: { description: 'TeamLeader deleted and reassigned' }
                    }
                }
            },
            '/teamLeader/deleteTeamLeaderAndPromoteEmployee': {
                delete: {
                    tags: ['TeamLeader'],
                    summary: 'Delete TeamLeader and promote Employee',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/TeamLeaderPromote' } } }
                    },
                    responses: {
                        200: { description: 'TeamLeader deleted and employee promoted' }
                    }
                }
            },
            '/teamLeader/hierarchy': {
                post: {
                    tags: ['TeamLeader'],
                    summary: 'Get TeamLeader organizational hierarchy',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'object', required: ['teamLeaderId'], properties: { teamLeaderId: { type: 'string' } } } } }
                    },
                    responses: {
                        200: { description: 'Hierarchy retrieved' }
                    }
                }
            },
            '/teamLeader/teamLeaderTasks': {
                post: {
                    tags: ['TeamLeader'],
                    summary: 'Get all tasks for TeamLeader',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'object', required: ['teamLeaderId'], properties: { teamLeaderId: { type: 'string' } } } } }
                    },
                    responses: {
                        200: { description: 'Tasks retrieved successfully' }
                    }
                }
            },
            '/teamLeader/getTeamLeaderDetails': {
                post: {
                    tags: ['TeamLeader'],
                    summary: 'Get TeamLeader details with clients and tasks',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'object', required: ['teamLeaderId'], properties: { teamLeaderId: { type: 'string' } } } } }
                    },
                    responses: {
                        200: { description: 'TeamLeader details retrieved' }
                    }
                }
            },

            // ============ EMPLOYEE ROUTES ============
            '/employee/create': {
                post: {
                    tags: ['Employee'],
                    summary: 'Create new Employee',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/EmployeeCreate' } } }
                    },
                    responses: {
                        201: { description: 'Employee created successfully' },
                        401: { description: 'Unauthorized' }
                    }
                }
            },
            '/employee/login': {
                post: {
                    tags: ['Employee'],
                    summary: 'Employee login',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/EmployeeLogin' } } }
                    },
                    responses: {
                        200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
                        401: { description: 'Invalid credentials' }
                    }
                }
            },
            '/employee/edit': {
                put: {
                    tags: ['Employee'],
                    summary: 'Edit Employee profile',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/EmployeeEdit' } } }
                    },
                    responses: {
                        200: { description: 'Employee updated successfully' },
                        401: { description: 'Unauthorized' }
                    }
                }
            },
            '/employee/delete': {
                delete: {
                    tags: ['Employee'],
                    summary: 'Delete Employee',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'object', required: ['employeeId'], properties: { employeeId: { type: 'string' } } } } }
                    },
                    responses: {
                        200: { description: 'Employee deleted successfully' }
                    }
                }
            },
            '/employee/employeeTasks': {
                post: {
                    tags: ['Employee'],
                    summary: 'Get Employee assigned tasks',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'object', required: ['employeeId'], properties: { employeeId: { type: 'string' } } } } }
                    },
                    responses: {
                        200: { description: 'Tasks retrieved successfully' }
                    }
                }
            },

            // ============ CLIENT ROUTES ============
            '/client/signup': {
                post: {
                    tags: ['Client'],
                    summary: 'Client self-registration',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/ClientSignup' } } }
                    },
                    responses: {
                        201: { description: 'Client registered (pending approval)' }
                    }
                }
            },
            '/client/login': {
                post: {
                    tags: ['Client'],
                    summary: 'Client login',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/ClientLogin' } } }
                    },
                    responses: {
                        200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
                        401: { description: 'Invalid credentials' }
                    }
                }
            },
            '/client/onboard-client': {
                post: {
                    tags: ['Client'],
                    summary: 'Accept/Reject client onboarding request',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/ClientOnboard' } } }
                    },
                    responses: {
                        200: { description: 'Client onboarding processed' }
                    }
                }
            },
            '/client/edit': {
                put: {
                    tags: ['Client'],
                    summary: 'Edit Client details',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/ClientSignup' } } }
                    },
                    responses: {
                        200: { description: 'Client updated successfully' },
                        401: { description: 'Unauthorized' }
                    }
                }
            },
            '/client/delete': {
                delete: {
                    tags: ['Client'],
                    summary: 'Delete Client',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'object', required: ['clientId'], properties: { clientId: { type: 'string' } } } } }
                    },
                    responses: {
                        200: { description: 'Client deleted successfully' },
                        401: { description: 'Unauthorized' }
                    }
                }
            },
            '/client/getClientDetails': {
                post: {
                    tags: ['Client'],
                    summary: 'Get complete Client details with tasks',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'object', required: ['clientId'], properties: { clientId: { type: 'string' } } } } }
                    },
                    responses: {
                        200: { description: 'Client details retrieved' }
                    }
                }
            },
            '/client/all': {
                get: {
                    tags: ['Client'],
                    summary: 'Get all Clients in system',
                    responses: {
                        200: { description: 'All clients retrieved' }
                    }
                }
            },
            '/client/getClientsForTeamLeader': {
                post: {
                    tags: ['Client'],
                    summary: 'Get Clients managed by specific TeamLeader',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'object', required: ['teamLeaderId'], properties: { teamLeaderId: { type: 'string' } } } } }
                    },
                    responses: {
                        200: { description: 'Clients retrieved' }
                    }
                }
            },
            '/client/upload-documents': {
                post: {
                    tags: ['Client'],
                    summary: 'Upload client documents to Google Drive',
                    requestBody: {
                        required: true,
                        content: {
                            'multipart/form-data': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        clientId: { type: 'string' },
                                        employeeMasterDatabase: { type: 'string', format: 'binary' },
                                        currentSalaryStructure: { type: 'string', format: 'binary' },
                                        previousSalarySheets: { type: 'string', format: 'binary' },
                                        currentHRPolicies: { type: 'string', format: 'binary' },
                                        leaveBalance: { type: 'string', format: 'binary' },
                                        companyLogo: { type: 'string', format: 'binary' },
                                        letterhead: { type: 'string', format: 'binary' }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        200: { description: 'Documents uploaded successfully' }
                    }
                }
            },
            '/client/getClientDocuments': {
                post: {
                    tags: ['Client'],
                    summary: 'Get uploaded Client documents metadata',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'object', required: ['clientId'], properties: { clientId: { type: 'string' } } } } }
                    },
                    responses: {
                        200: { description: 'Documents metadata retrieved' }
                    }
                }
            },

            // ============ TASK ROUTES ============
            '/task/requestTask': {
                post: {
                    tags: ['Task'],
                    summary: 'Client requests a new task',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskRequest' } } }
                    },
                    responses: {
                        201: { description: 'Task request created' }
                    }
                }
            },
            '/task/requested-tasks': {
                post: {
                    tags: ['Task'],
                    summary: 'Get all task requests for TeamLeader clients',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'object', required: ['teamLeaderId'], properties: { teamLeaderId: { type: 'string' } } } } }
                    },
                    responses: {
                        200: { description: 'Task requests retrieved' }
                    }
                }
            },
            '/task/accept-or-reject': {
                post: {
                    tags: ['Task'],
                    summary: 'Accept/Reject requested task and assign it',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskAcceptReject' } } }
                    },
                    responses: {
                        200: { description: 'Task processed successfully' }
                    }
                }
            },
            '/task/createTaskByTL': {
                post: {
                    tags: ['Task'],
                    summary: 'TeamLeader directly creates task',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskCreate' } } }
                    },
                    responses: {
                        201: { description: 'Task created successfully' }
                    }
                }
            },
            '/task/delete': {
                post: {
                    tags: ['Task'],
                    summary: 'Delete a task',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'object', required: ['taskId'], properties: { taskId: { type: 'string' } } } } }
                    },
                    responses: {
                        200: { description: 'Task deleted' }
                    }
                }
            },
            '/task/update-status': {
                put: {
                    tags: ['Task'],
                    summary: 'Update task status',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskUpdateStatus' } } }
                    },
                    responses: {
                        200: { description: 'Status updated' }
                    }
                }
            },
            '/task/allTasks': {
                get: {
                    tags: ['Task'],
                    summary: 'Get all tasks in system',
                    responses: {
                        200: { description: 'All tasks retrieved' }
                    }
                }
            },
            '/task/getClientTasks': {
                post: {
                    tags: ['Task'],
                    summary: 'Get all tasks for specific Client',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'object', required: ['clientId'], properties: { clientId: { type: 'string' } } } } }
                    },
                    responses: {
                        200: { description: 'Client tasks retrieved' }
                    }
                }
            },
            '/task/getTasksByAssignedUser': {
                post: {
                    tags: ['Task'],
                    summary: 'Get tasks assigned to specific user',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'object', required: ['userId'], properties: { userId: { type: 'string' } } } } }
                    },
                    responses: {
                        200: { description: 'User tasks retrieved' }
                    }
                }
            },
            '/task/getAllRecurringTasks': {
                get: {
                    tags: ['Task'],
                    summary: 'Get all recurring/frequency tasks',
                    responses: {
                        200: { description: 'Recurring tasks retrieved' }
                    }
                }
            },
            '/task/getRecurringTasksForTL': {
                post: {
                    tags: ['Task'],
                    summary: 'Get recurring tasks for TeamLeader clients',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'object', required: ['teamLeaderId'], properties: { teamLeaderId: { type: 'string' } } } } }
                    },
                    responses: {
                        200: { description: 'Recurring tasks retrieved' }
                    }
                }
            },
            '/task/getRecurringTasksByClient': {
                post: {
                    tags: ['Task'],
                    summary: 'Get recurring tasks for specific Client',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'object', required: ['clientId'], properties: { clientId: { type: 'string' } } } } }
                    },
                    responses: {
                        200: { description: 'Client recurring tasks retrieved' }
                    }
                }
            },
            '/task/deleteOrDeactivateRecurringTask': {
                post: {
                    tags: ['Task'],
                    summary: 'Delete or deactivate recurring task',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'object', required: ['recurringTaskId', 'action'], properties: { recurringTaskId: { type: 'string' }, action: { type: 'string', enum: ['delete', 'deactivate'] } } } } }
                    },
                    responses: {
                        200: { description: 'Recurring task processed' }
                    }
                }
            },

            // ============ NOTIFICATION ROUTES ============
            '/notification/get-all': {
                post: {
                    tags: ['Notification'],
                    summary: 'Get all notifications for user',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/NotificationGet' } } }
                    },
                    responses: {
                        200: { description: 'Notifications retrieved' }
                    }
                }
            },
            '/notification/mark-read': {
                post: {
                    tags: ['Notification'],
                    summary: 'Mark single notification as read',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/NotificationMarkRead' } } }
                    },
                    responses: {
                        200: { description: 'Notification marked as read' }
                    }
                }
            },
            '/notification/mark-unread': {
                post: {
                    tags: ['Notification'],
                    summary: 'Mark single notification as unread',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/NotificationMarkRead' } } }
                    },
                    responses: {
                        200: { description: 'Notification marked as unread' }
                    }
                }
            },
            '/notification/mark-all-read': {
                post: {
                    tags: ['Notification'],
                    summary: 'Mark all notifications as read for user',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/NotificationGet' } } }
                    },
                    responses: {
                        200: { description: 'All notifications marked as read' }
                    }
                }
            },
            '/notification/delete-one': {
                delete: {
                    tags: ['Notification'],
                    summary: 'Delete single notification',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/NotificationMarkRead' } } }
                    },
                    responses: {
                        200: { description: 'Notification deleted' }
                    }
                }
            },
            '/notification/delete-all': {
                delete: {
                    tags: ['Notification'],
                    summary: 'Delete all notifications for user',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/NotificationGet' } } }
                    },
                    responses: {
                        200: { description: 'All notifications deleted' }
                    }
                }
            },

            // ============ CHAT ROUTES ============
            '/chat/messages/{userId1}/{userId2}': {
                get: {
                    tags: ['Chat'],
                    summary: 'Get chat history between two users',
                    parameters: [
                        { name: 'userId1', in: 'path', required: true, schema: { type: 'string' } },
                        { name: 'userId2', in: 'path', required: true, schema: { type: 'string' } }
                    ],
                    responses: {
                        200: { description: 'Chat history retrieved' }
                    }
                }
            },
            '/chat/messages/read': {
                put: {
                    tags: ['Chat'],
                    summary: 'Mark messages as read',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageMarkRead' } } }
                    },
                    responses: {
                        200: { description: 'Messages marked as read' }
                    }
                }
            },
            '/chat/messages/unread/{userId}': {
                get: {
                    tags: ['Chat'],
                    summary: 'Get unread message count for user',
                    parameters: [
                        { name: 'userId', in: 'path', required: true, schema: { type: 'string' } }
                    ],
                    responses: {
                        200: { description: 'Unread count retrieved' }
                    }
                }
            }
        }
    },
    apis: ['./routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
