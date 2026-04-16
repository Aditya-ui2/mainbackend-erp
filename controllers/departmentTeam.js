// Use Sequelize models for all operations (PostgreSQL)
const { 
    DepartmentTeam, TeamLeader, DepartmentTask, ActivityLog,
    RecruitmentPosition, Candidate, Interview,
    Employee, Attendance, Payslip, LeaveRequest
} = require('../models/sequelizeModels');
const { hashPassword, comparePasswords } = require('../utils/bcryptUtils');
const { generateToken, generateRefreshToken } = require('../utils/jwtUtils');
const { Op } = require('sequelize');
const { addNotification } = require('./notification');

// ============== TEAM MEMBER CRUD ==============

// Get all team members for a department
const getTeamMembers = async (req, res) => {
    try {
        const { department } = req.query;
        const managerId = req.user?.id;

        const where = {};
        if (department) {
            // Map short names to full ENUM values for DB safety
            const deptMap = {
                'recruitment': 'HR Recruitment',
                'operations': 'HR Operations'
            };
            where.department = deptMap[department] || department;
        }
        
        // If not a Head/SuperAdmin, only show direct reports
        if (req.user?.role !== 'Department Head' && req.user?.role !== 'SuperAdmin' && managerId) {
            where.managerId = managerId;
        }

        const members = await DepartmentTeam.findAll({
            where,
            include: [{
                model: DepartmentTeam,
                as: 'manager',
                attributes: ['id', 'name', 'email']
            }],
            order: [['createdAt', 'DESC']]
        });

        // 7-day window for "This Week Hires"
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        // Fetch stats for each member
        const membersWithStats = await Promise.all(members.map(async (member) => {
            const m = member.toJSON();
            
            // Parallelize counts for better performance
            const [activePositions, candidatesPipeline, interviewsScheduled, thisWeekHires] = await Promise.all([
                RecruitmentPosition.count({ 
                    where: { 
                        [Op.or]: [
                            { departmentTeamId: member.id },
                            { teamLeaderId: member.id }
                        ],
                        status: 'Open'
                    } 
                }),
                Candidate.count({ where: { addedById: member.id } }),
                Interview.count({ 
                    where: { interviewerId: member.id, status: 'Scheduled' } 
                }),
                Candidate.count({ 
                    where: { 
                        addedById: member.id, 
                        [Op.or]: [
                            { status: 'Selected' },
                            { stage: 'Joined' }
                        ],
                        updatedAt: { [Op.gte]: weekAgo }
                    } 
                })
            ]);

            return {
                ...m,
                stats: {
                    activePositions,
                    candidatesPipeline,
                    interviewsScheduled,
                    thisWeekHires,
                    offersExtended: 0 // Default for now until Offer model is integrated
                }
            };
        }));

        res.status(200).json({ success: true, members: membersWithStats });
    } catch (error) {
        console.error('Error fetching team members:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch team members', error: error.message });
    }
};

// Get single team member
const getTeamMember = async (req, res) => {
    try {
        const member = await DepartmentTeam.findByPk(req.params.id, {
            include: [{
                model: DepartmentTeam,
                as: 'manager',
                attributes: ['id', 'name', 'email']
            }]
        });
        
        if (!member) {
            return res.status(404).json({ success: false, message: 'Team member not found' });
        }

        res.status(200).json({ success: true, member });
    } catch (error) {
        console.error('Error fetching team member:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch team member' });
    }
};

// Add new team member
const addTeamMember = async (req, res) => {
    try {
        const { name, email, password, phone, role, department, skills, supervisorId } = req.body;
        // Use provided supervisorId if present, otherwise use logged-in user's ID
        const managerId = supervisorId || req.user?.id;

        console.log('Adding team member with payload:', { name, email, role, department, managerId });

        if (!password) {
            return res.status(400).json({ success: false, message: 'Password is required' });
        }

        if (!name || !email) {
            return res.status(400).json({ success: false, message: 'Name and Email are required' });
        }

        const emailLower = email.toLowerCase().trim();
        const existing = await DepartmentTeam.findOne({ where: { email: emailLower } });
        if (existing) {
            console.log('Duplicate email found:', emailLower);
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }

        const hashedPassword = await hashPassword(password);

        const member = await DepartmentTeam.create({
            name,
            email: emailLower,
            password: hashedPassword,
            phone,
            role,
            department: department || 'HR Recruitment',
            managerId: managerId,
            skills: skills || [],
        });

        console.log('✅ Team member created:', member.id);
        res.status(201).json({ success: true, data: member, message: 'Team member added successfully' });
    } catch (error) {
        console.error('❌ CRITICAL ERROR ADDING TEAM MEMBER:', error);
        res.status(400).json({ 
            success: false, 
            message: 'Failed to add team member', 
            error: error.message,
            details: error.errors?.map(e => e.message) || [error.name]
        });
    }
};

// Update team member
const updateTeamMember = async (req, res) => {
    try {
        const { name, email, phone, role, status, skills } = req.body;
        const managerId = req.user?.id;

        const member = await DepartmentTeam.findByPk(req.params.id);

        if (!member) {
            return res.status(404).json({ success: false, message: 'Team member not found' });
        }

        await member.update({ name, email, phone, role, status, skills });

        // Log activity
        await logActivity({
            department: member.department,
            performedBy: managerId,
            performedByType: 'TeamLeader',
            performedByName: req.user?.name || 'Manager',
            action: 'updated_team_member',
            actionType: 'general',
            description: `Updated ${name}'s profile`,
            relatedEntity: member.id,
            relatedEntityType: 'DepartmentTeam'
        });

        res.status(200).json({ success: true, member, message: 'Team member updated successfully' });
    } catch (error) {
        console.error('Error updating team member:', error);
        res.status(500).json({ success: false, message: 'Failed to update team member' });
    }
};

// Delete team member
const deleteTeamMember = async (req, res) => {
    try {
        const member = await DepartmentTeam.findByPk(req.params.id);
        
        if (!member) {
            return res.status(404).json({ success: false, message: 'Team member not found' });
        }

        await member.destroy();
        res.status(200).json({ success: true, message: 'Team member removed successfully' });
    } catch (error) {
        console.error('Error deleting team member:', error);
        res.status(500).json({ success: false, message: 'Failed to delete team member' });
    }
};

// ============== ACTIVITY LOGS ==============

// Helper function to log activity
const logActivity = async (data) => {
    try {
        const activity = await ActivityLog.create(data);
        return activity;
    } catch (error) {
        console.error('Error logging activity:', error);
    }
};

// Get activity logs for department
const getActivityLogs = async (req, res) => {
    try {
        const { department, limit = 50, actionType } = req.query;

        const where = {};
        if (department) where.department = department;
        if (actionType) where.actionType = actionType;

        const activities = await ActivityLog.findAll({
            where,
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit)
        });

        res.status(200).json({ success: true, activities });
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch activity logs' });
    }
};

// Create activity log (for external calls)
const createActivityLog = async (req, res) => {
    try {
        const activity = await logActivity(req.body);
        res.status(201).json({ success: true, activity });
    } catch (error) {
        console.error('Error creating activity log:', error);
        res.status(500).json({ success: false, message: 'Failed to create activity log' });
    }
};

// ============== DEPARTMENT TASKS ==============

// Get tasks for department
const getDepartmentTasks = async (req, res) => {
    try {
        const { department, status, assignedTo } = req.query;
        const managerId = req.user?.id;

        const where = {};
        if (department) where.department = department;
        if (status) where.status = status;
        
        const userRole = (req.user?.role || '').toLowerCase();
        const isAdminRole = ['admin', 'superadmin', 'department head', 'recruitment head', 'recruitmenthead', 'hr recruitment head'].includes(userRole);

        // If assignedTo is provided (e.g. employee fetching their tasks), use it
        if (assignedTo) {
            where.assignedTo = assignedTo;
        } else if (!isAdminRole) {
            // Otherwise, non-admin users only see tasks assigned by them or to them
            where[Op.or] = [
                { assignedBy: managerId },
                { assignedTo: managerId }
            ];
        }

        const tasks = await DepartmentTask.findAll({
            where,
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({ success: true, tasks });
    } catch (error) {
        console.error('Error fetching department tasks:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
    }
};

// Create department task
const createDepartmentTask = async (req, res) => {
    try {
        const { title, description, department, assignedTo, priority, dueDate, positionId, candidateId } = req.body;
        const assignedBy = req.user?.id;

        // Get assignee name (DepartmentTeam is Sequelize/PostgreSQL)
        const assignee = await DepartmentTeam.findByPk(assignedTo);
        if (!assignee) {
            return res.status(404).json({ success: false, message: 'Assignee not found' });
        }

        const task = await DepartmentTask.create({
            title,
            description,
            department,
            assignedBy,
            assignedByName: req.user?.name || 'Manager',
            assignedTo,
            assignedToName: assignee.name,
            priority,
            dueDate,
            positionId,
            candidateId,
        });

        // Update assignee's task count (Sequelize)
        await assignee.increment('tasksAssigned', { by: 1 });

        // Log activity
        await logActivity({
            department,
            performedBy: assignedBy,
            performedByType: 'TeamLeader',
            performedByName: req.user?.name || 'Manager',
            action: 'assigned_task',
            actionType: 'task',
            description: `Assigned "${title}" to ${assignee.name}`,
            relatedEntity: task.id,
            relatedEntityType: 'Task'
        });

        res.status(201).json({ success: true, task, message: 'Task assigned successfully' });
    } catch (error) {
        console.error('Error creating department task:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create task', 
            error: error.message,
            details: error.errors?.map(e => e.message) 
        });
    }
};

// Update department task
const updateDepartmentTask = async (req, res) => {
    try {
        const { status, comments } = req.body;
        const userId = req.user?.id;
        const userType = req.user?.userType || 'TeamLeader';

        const task = await DepartmentTask.findByPk(req.params.id);

        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        const updateData = { ...req.body };
        
        // If marking as completed
        if (status === 'Completed') {
            updateData.completedAt = new Date();
        }

        // Add comment if provided
        if (comments) {
            const existingComments = task.comments || [];
            updateData.comments = [
                ...existingComments,
                {
                    text: comments,
                    by: userId,
                    byType: userType,
                    byName: req.user?.name || 'User',
                    createdAt: new Date()
                }
            ];
        }

        await task.update(updateData);

        // Send notifications for comment
        if (comments) {
            const commenterName = req.user?.name || 'User';
            if (userType === 'TeamLeader') {
                // Head commented → notify team member
                addNotification(task.assignedTo, 'DepartmentTeam', `💬 ${commenterName} commented on "${task.title}": ${comments}`, 'comment', 'medium');
            } else {
                // Member commented → notify head
                if (task.assignedBy) {
                    addNotification(task.assignedBy, 'TeamLeader', `💬 ${commenterName} commented on "${task.title}": ${comments}`, 'comment', 'medium');
                }
            }
        }

        // Send notification for status change
        if (status && status !== task.getDataValue('status')) {
            const changerName = req.user?.name || 'User';
            if (task.assignedBy) {
                addNotification(task.assignedBy, 'TeamLeader', `📋 ${changerName} changed "${task.title}" to ${status}`, 'task', 'medium');
            }
        }

        // Update team member stats if completed (Sequelize)
        if (status === 'Completed') {
            const member = await DepartmentTeam.findByPk(task.assignedTo);
            if (member) {
                await member.increment('tasksCompleted', { by: 1 });
            }

            // Log activity
            await logActivity({
                department: task.department,
                performedBy: task.assignedTo,
                performedByType: 'DepartmentTeam',
                performedByName: task.assignedToName,
                action: 'completed_task',
                actionType: 'task',
                description: `Completed task "${task.title}"`,
                relatedEntity: task.id,
                relatedEntityType: 'Task'
            });
        }

        res.status(200).json({ success: true, task, message: 'Task updated successfully' });
    } catch (error) {
        console.error('Error updating department task:', error);
        res.status(500).json({ success: false, message: 'Failed to update task' });
    }
};

// Delete department task
const deleteDepartmentTask = async (req, res) => {
    try {
        const task = await DepartmentTask.findByPk(req.params.id);
        
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        await task.destroy();
        res.status(200).json({ success: true, message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Error deleting department task:', error);
        res.status(500).json({ success: false, message: 'Failed to delete task' });
    }
};

// ============== DASHBOARD STATS ==============

// Get department dashboard stats
const getDepartmentStats = async (req, res) => {
    try {
        const { department } = req.query;
        const managerId = req.user?.id;

        // Auto-hierarchy sync for Sachin (Recruitment Head)
        const sachinId = '60de4380-0140-49ff-b26d-a8d06333af11';
        if (managerId === sachinId) {
            const kamIds = [
                'bdcdd80c-4812-45f0-9862-39594bfe7475', // Manju
                '13b9f804-91ea-4d5a-afc0-8a9da6e27e0f', // Jyoti
                'ffd606f2-459c-4bc1-8f4b-52b88663fed3'  // Priyanshi
            ];
            await DepartmentTeam.update({ managerId: sachinId }, { where: { id: kamIds, managerId: null } });
            await DepartmentTeam.update({ role: 'Department Head' }, { where: { id: sachinId, role: { [Op.ne]: 'Department Head' } } });
        }

        // --- SPECIFIC LOGIC FOR HR OPERATIONS ---
        if (department === 'HR Operations' || department === 'operations') {
            const todayStr = new Date().toISOString().split('T')[0];
            const now = new Date();
            const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            
            // For Month-wise trend (Last 12 months)
            const months = [];
            for (let i = 11; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                months.push({
                    name: d.toLocaleString('default', { month: 'short' }),
                    start: new Date(d.getFullYear(), d.getMonth(), 1),
                    end: new Date(d.getFullYear(), d.getMonth() + 1, 0)
                });
            }

            const activeOnboardingStages = ['Screening', 'Phone Interview', 'Technical Round', 'HR Round', 'Client Interview', 'Offer Sent', 'Joined'];

            const [
                realTotalEmployees,
                onLeaveCount,
                presentToday,
                pendingTasksCount,
                totalDisbursed,
                processedPayslips,
                totalExpectedPayslips,
                newHiresCount,
                openPositionsCount,
                recentActivitiesData,
                attendanceHistory,
                deptDistData
            ] = await Promise.all([
                Employee.count(),
                Attendance.count({ where: { date: todayStr, status: 'On Leave' } }),
                Attendance.count({ where: { date: todayStr, status: 'Present' } }),
                DepartmentTask.count({ where: { department: 'HR Operations', status: { [Op.ne]: 'Completed' } } }),
                Payslip.sum('netSalary', { where: { status: 'Paid', department: 'HR Operations' } }),
                Payslip.count({ where: { status: 'Paid', department: 'HR Operations', month: now.toLocaleString('default', { month: 'long' }), year: now.getFullYear() } }),
                Employee.count(), // For payroll completion percentage
                Candidate.count({ where: { stage: 'Joined', createdAt: { [Op.gte]: firstOfCurrentMonth } } }),
                RecruitmentPosition.count({ where: { status: 'Open' } }),
                ActivityLog.findAll({
                    where: { department: 'HR Operations' },
                    order: [['createdAt', 'DESC']],
                    limit: 10
                }),
                // Attendance Trend for 12 months
                Promise.all(months.map(async m => {
                    const present = await Attendance.count({ 
                        where: { 
                            status: 'Present', 
                            date: { [Op.between]: [m.start.toISOString().split('T')[0], m.end.toISOString().split('T')[0]] } 
                        } 
                    });
                    const total = await Attendance.count({ 
                        where: { 
                            date: { [Op.between]: [m.start.toISOString().split('T')[0], m.end.toISOString().split('T')[0]] } 
                        } 
                    });
                    return total > 0 ? Math.round((present / total) * 100) : 0;
                })),
                // Department Distribution (mocked with real total, grouped by role proxy if available, but let's use a safe breakdown)
                (async () => {
                    const total = await Employee.count();
                    return [
                        { name: 'Operations', count: total, color: 'bg-violet-500', hex: '#8b5cf6' }
                    ];
                })()
            ]);

            const attendanceRateVal = realTotalEmployees > 0 
                ? Math.round((presentToday / realTotalEmployees) * 100) 
                : 0;

            const payrollCompletion = realTotalEmployees > 0 
                ? Math.round((processedPayslips / realTotalEmployees) * 100) 
                : 0;

            return res.status(200).json({
                success: true,
                stats: {
                    overview: {
                        totalEmployees: realTotalEmployees,
                        attendanceRate: `${attendanceRateVal}%`,
                        attendanceTrend: attendanceHistory
                    },
                    bar: {
                        onLeave: onLeaveCount,
                        pendingActions: pendingTasksCount,
                        satisfaction: '4.8/5' // Real performance logic could be added here
                    },
                    quickStats: {
                        newHires: newHiresCount,
                        exits: 0, 
                        openPositions: openPositionsCount,
                        docsVerified: 92 // Percentage logic could be added here
                    },
                    payroll: {
                        totalDisbursed: totalDisbursed || 0,
                        processed: processedPayslips,
                        total: realTotalEmployees,
                        completion: payrollCompletion
                    },
                    attendanceTrend: attendanceHistory,
                    departmentDistribution: deptDistData,
                    recentActivities: recentActivitiesData
                }
            });
        }

        // --- DEFAULT LOGIC (RECRUITMENT, ETC) ---

        const teamWhere = {};
        if (department) teamWhere.department = department;
        if (managerId) teamWhere.managerId = managerId;

        const teamMembers = await DepartmentTeam.findAll({ where: teamWhere });
        const activeMembers = teamMembers.filter(m => m.status === 'Active').length;
        const onLeave = teamMembers.filter(m => m.status === 'On Leave').length;

        // Task stats (PostgreSQL)
        const taskWhere = {};
        if (department) taskWhere.department = department;
        if (managerId) taskWhere.assignedBy = managerId;
        
        const allTasks = await DepartmentTask.findAll({ where: taskWhere });
        const pendingTasks = allTasks.filter(t => t.status === 'Pending').length;
        const inProgressTasks = allTasks.filter(t => t.status === 'In Progress').length;
        const completedTasks = allTasks.filter(t => t.status === 'Completed').length;
        const overdueTasks = allTasks.filter(t => t.status === 'Overdue' || (t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Completed')).length;

        // Recent activities
        const activityWhere = {};
        if (department) activityWhere.department = department;
        const defaultRecentActivities = await ActivityLog.findAll({
            where: activityWhere,
            order: [['createdAt', 'DESC']],
            limit: 10
        });

        // Workload distribution
        const activeTasks = allTasks.filter(t => t.status !== 'Completed');
        const workloadMap = {};
        for (const t of activeTasks) {
            workloadMap[t.assignedTo] = (workloadMap[t.assignedTo] || 0) + 1;
        }

        // Map workload to team members (Sequelize)
        const workloadWithNames = await Promise.all(
            Object.entries(workloadMap).map(async ([memberId, count]) => {
                const member = await DepartmentTeam.findByPk(memberId);
                return { name: member?.name || 'Unknown', tasks: count };
            })
        );

        res.status(200).json({
            success: true,
            stats: {
                team: {
                    total: teamMembers.length,
                    active: activeMembers,
                    onLeave,
                },
                tasks: {
                    total: allTasks.length,
                    pending: pendingTasks,
                    inProgress: inProgressTasks,
                    completed: completedTasks,
                    overdue: overdueTasks,
                },
                workload: workloadWithNames,
                recentActivities: defaultRecentActivities,
            }

        });
    } catch (error) {
        console.error('❌ CRITICAL ERROR FETCHING DEPARTMENT STATS:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch stats', 
            error: error.message 
        });
    }
};

// ============== AUTHENTICATION ==============

// Login department team member
const loginDepartmentTeam = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email and password are required' 
            });
        }

        const member = await DepartmentTeam.findOne({ 
            where: { email: email.toLowerCase() } 
        });
        
        if (!member) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }

        if (member.status !== 'Active') {
            return res.status(401).json({ 
                success: false, 
                message: 'Account is inactive. Please contact administrator.' 
            });
        }

        const isPasswordValid = await comparePasswords(password, member.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }

        const token = generateToken({
            id: member.id,
            email: member.email,
            name: member.name,
            role: member.role,
            department: member.department,
            userType: 'departmentTeam'
        });

        const refreshToken = generateRefreshToken({
            id: member.id,
            role: member.role
        });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            refreshToken,
            user: {
                id: member.id,
                name: member.name,
                email: member.email,
                role: member.role,
                department: member.department,
                avatar: member.avatar
            }
        });
    } catch (error) {
        console.error('Error logging in department team member:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
};

// ============== MEMBER SELF-SERVICE ==============

// Get tasks assigned to the logged-in team member
const getMyTasks = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { status } = req.query;

        const where = { assignedTo: userId };
        if (status) where.status = status;

        const tasks = await DepartmentTask.findAll({
            where,
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({ success: true, tasks });
    } catch (error) {
        console.error('Error fetching my tasks:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
    }
};

// Get personal stats for logged-in team member
const getMyStats = async (req, res) => {
    try {
        const userId = req.user?.id;

        const allTasks = await DepartmentTask.findAll({ where: { assignedTo: userId } });

        const stats = {
            total: allTasks.length,
            pending: allTasks.filter(t => t.status === 'Pending').length,
            inProgress: allTasks.filter(t => t.status === 'In Progress').length,
            completed: allTasks.filter(t => t.status === 'Completed').length,
            overdue: allTasks.filter(t => t.status === 'Overdue' || (t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Completed')).length,
        };

        res.status(200).json({ success: true, stats });
    } catch (error) {
        console.error('Error fetching my stats:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch stats' });
    }
};

module.exports = {
    // Authentication
    loginDepartmentTeam,
    // Team members
    getTeamMembers,
    getTeamMember,
    addTeamMember,
    updateTeamMember,
    deleteTeamMember,
    // Activity logs
    getActivityLogs,
    createActivityLog,
    logActivity,
    // Department tasks
    getDepartmentTasks,
    createDepartmentTask,
    updateDepartmentTask,
    deleteDepartmentTask,
    // Stats
    getDepartmentStats,
    // Member self-service
    getMyTasks,
    getMyStats,
};

const seedDemoData = async (req, res) => {
    try {
        console.log('🌱 Starting Demo Data Seeding for HR Operations...');
        
        // FORCING DB SCHEMA SYNC (to ensure new Payslip columns exist)
        const { sequelize } = require('../models/sequelizeModels');
        await sequelize.sync({ alter: true });
        console.log('✅ Database Schema Synced');

        // 1. Create Employees
        const employeeData = [
            { name: 'Tanmay Saxena', email: 'tanmay@mabicons.com', password: 'password123', phone: '9876543210' },
            { name: 'Arpit Agrawal', email: 'arpit@mabicons.com', password: 'password123', phone: '9876543211' },
            { name: 'Vaibhav Yadav', email: 'vaibhav@mabicons.com', password: 'password123', phone: '9876543212' },
            { name: 'Anshul Soni', email: 'anshul@mabicons.com', password: 'password123', phone: '9876543213' },
            { name: 'Harshvardhan Singh', email: 'harsh@mabicons.com', password: 'password123', phone: '9876543214' }
        ];

        const employees = await Promise.all(employeeData.map(async (data) => {
            const [emp] = await Employee.findOrCreate({ where: { email: data.email }, defaults: data });
            return emp;
        }));

        // 2. Create Attendance for last 30 days
        const today = new Date();
        const attendanceRecords = [];
        for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(today.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            employees.forEach((emp) => {
                let status = 'Present';
                const rand = Math.random();
                if (rand < 0.1) status = 'On Leave';
                else if (rand < 0.15) status = 'Half Day';
                else if (rand < 0.05) status = 'Absent';

                if (date.getDay() === 0) return; // Sunday

                attendanceRecords.push({
                    memberId: emp.id,
                    memberName: emp.name,
                    department: 'HR Operations',
                    date: dateStr,
                    status: status,
                    checkIn: status === 'Present' ? new Date(date.setHours(9, 0, 0)) : null,
                    checkOut: status === 'Present' ? new Date(date.setHours(18, 0, 0)) : null
                });
            });
        }
        await Attendance.bulkCreate(attendanceRecords, { ignoreDuplicates: true });

        // 3. (SKIPPED) Recruitment Data is handled in a separate recruitment seeder.
        // Moving directly to Performance Data initialization.

        // 4. Create Tasks for all employees to show performance
        console.log(`🌱 Seeding Tasks for ${employees.length} employees...`);
        const taskPromises = [];
        for (const emp of employees) {
            // Give every employee 3 tasks: 2 completed, 1 in progress
            taskPromises.push(
                DepartmentTask.create({ title: `Onboard Team Member for ${emp.name}`, department: 'HR Operations', status: 'Completed', priority: 'High', assignedByName: 'Admin', assignedTo: emp.id, assignedToName: emp.name, assignedBy: '855bfbac-a49a-4e76-afc6-fbcf6e95d58b', completedAt: new Date() }),
                DepartmentTask.create({ title: `Quarterly Review for ${emp.name}`, department: 'HR Operations', status: 'Completed', priority: 'Medium', assignedByName: 'Admin', assignedTo: emp.id, assignedToName: emp.name, assignedBy: '855bfbac-a49a-4e76-afc6-fbcf6e95d58b', completedAt: new Date() }),
                DepartmentTask.create({ title: `Process Documentation`, department: 'HR Operations', status: 'In Progress', priority: 'Low', assignedByName: 'Admin', assignedTo: emp.id, assignedToName: emp.name, assignedBy: '855bfbac-a49a-4e76-afc6-fbcf6e95d58b' })
            );
        }
        await Promise.all(taskPromises);

        // 5. Create Attendance for all employees (to show 100% reliability)
        console.log(`🌱 Seeding Attendance for ${employees.length} employees...`);
        const attendPromises = [];
        for (const emp of employees) {
            // Give 5 days of attendance
            for(let i=0; i<5; i++) {
                const d = new Date(); d.setDate(d.getDate() - i);
                attendPromises.push(Attendance.create({ memberId: emp.id, memberName: emp.name, department: 'HR Operations', date: d.toISOString().split('T')[0], checkIn: new Date(), status: 'Present' }));
            }
        }
        await Promise.all(attendPromises);

        // 6. Create Daily Reports (Engagement)
        console.log(`🌱 Seeding Reports for ${employees.length} employees...`);
        const reportPromises = [];
        for (const emp of employees) {
            reportPromises.push(DailyReport.create({ memberId: emp.id, memberName: emp.name, department: 'HR Operations', content: 'Completed my onboarding tasks and documentation.', status: 'Submitted' }));
        }
        await Promise.all(reportPromises);

        // 7. Create Payslips
        console.log(`🌱 Seeding Payslips for ${employees.length} employees...`);
        const currentMonth = today.toLocaleString('default', { month: 'long' });
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1).toLocaleString('default', { month: 'long' });
        
        let payslipCount = 0;
        for (const emp of employees) {
            const baseData = {
                memberId: emp.id,
                memberName: emp.name,
                department: 'HR Operations',
                year: today.getFullYear(),
                basicSalary: 30000,
                hra: 15000,
                conveyance: 2000,
                medical: 1500,
                special: 1500,
                otherAllowances: 5000,
                designation: 'HR Executive'
            };

            try {
                // Last month's paid payslip
                await Payslip.create({
                    ...baseData,
                    month: lastMonth,
                    deductions: 2000,
                    totalDeductions: 2000,
                    netSalary: 48000,
                    status: 'Paid',
                    paidDate: new Date(today.getFullYear(), today.getMonth() - 1, 5).toISOString().split('T')[0]
                });
                
                // This month's generated payslip
                await Payslip.create({
                    ...baseData,
                    month: currentMonth,
                    deductions: 2500,
                    totalDeductions: 2500,
                    netSalary: 47500,
                    status: 'Generated'
                });
                payslipCount += 2;
            } catch (err) {
                console.error(`❌ Error creating payslip for ${emp.name}:`, err.message);
            }
        }
        console.log(`✅ ${payslipCount} Payslips Seeded`);

        // 8. Create activities
        await ActivityLog.bulkCreate([
            { action: 'Task Assigned', description: 'Assigned Onboarding task to Tanmay', department: 'HR Operations', actionType: 'task', performedByName: 'Admin' },
            { action: 'Candidate Joined', description: 'Anshul Soni successfully joined the team', department: 'HR Operations', actionType: 'candidate', performedByName: 'Sachin' },
            { action: 'Leave Approved', description: 'Approved Sick leave for Harshvardhan', department: 'HR Operations', actionType: 'leave', performedByName: 'Sachin' }
        ], { ignoreDuplicates: true });

        const report = {
            employees: employees.length,
            attendance: employees.length * 5,
            payslips: payslipCount,
            tasks: employees.length * 3,
            activities: 3
        };

        console.log('✅ SEED REPORT:', report);
        res.json({ 
            success: true, 
            message: '✅ Comprehensive Performance & Demo data seeded successfully.',
            report: report
        });
    } catch (err) {
        console.error('❌ SEED ERROR:', err);
        res.status(500).json({ success: false, message: 'Failed to seed data', error: err.message });
    }
};

module.exports.seedDemoData = seedDemoData;
