const { DepartmentTeam, ActivityLog, DepartmentTask, TeamLeader } = require('../models/models');
const { hashPassword, comparePassword } = require('../utils/bcryptUtils');
const { generateToken } = require('../utils/jwtUtils');

// ============== TEAM MEMBER CRUD ==============

// Get all team members for a department
const getTeamMembers = async (req, res) => {
    try {
        const { department } = req.query;
        const managerId = req.user?.id;

        const filter = {};
        if (department) filter.department = department;
        if (managerId) filter.manager = managerId;

        const members = await DepartmentTeam.find(filter)
            .populate('manager', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, members });
    } catch (error) {
        console.error('Error fetching team members:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch team members' });
    }
};

// Get single team member
const getTeamMember = async (req, res) => {
    try {
        const member = await DepartmentTeam.findById(req.params.id)
            .populate('manager', 'name email');
        
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
        const { name, email, password, phone, role, department, skills } = req.body;
        const managerId = req.user?.id;

        if (!password) {
            return res.status(400).json({ success: false, message: 'Password is required' });
        }

        const existing = await DepartmentTeam.findOne({ email });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }

        const hashedPassword = await hashPassword(password);

        const member = new DepartmentTeam({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            phone,
            role,
            department,
            manager: managerId,
            skills: skills || [],
        });

        await member.save();

        // Log activity
        await logActivity({
            department,
            performedBy: managerId,
            performedByType: 'TeamLeader',
            performedByName: req.user?.name || 'Manager',
            action: 'added_team_member',
            actionType: 'general',
            description: `Added ${name} to the team as ${role}`,
            relatedEntity: member._id,
            relatedEntityType: 'DepartmentTeam'
        });

        res.status(201).json({ success: true, member, message: 'Team member added successfully' });
    } catch (error) {
        console.error('Error adding team member:', error);
        res.status(500).json({ success: false, message: 'Failed to add team member' });
    }
};

// Update team member
const updateTeamMember = async (req, res) => {
    try {
        const { name, email, phone, role, status, skills } = req.body;
        const managerId = req.user?.id;

        const member = await DepartmentTeam.findByIdAndUpdate(
            req.params.id,
            { name, email, phone, role, status, skills },
            { new: true }
        );

        if (!member) {
            return res.status(404).json({ success: false, message: 'Team member not found' });
        }

        // Log activity
        await logActivity({
            department: member.department,
            performedBy: managerId,
            performedByType: 'TeamLeader',
            performedByName: req.user?.name || 'Manager',
            action: 'updated_team_member',
            actionType: 'general',
            description: `Updated ${name}'s profile`,
            relatedEntity: member._id,
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
        const member = await DepartmentTeam.findByIdAndDelete(req.params.id);
        
        if (!member) {
            return res.status(404).json({ success: false, message: 'Team member not found' });
        }

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
        const activity = new ActivityLog(data);
        await activity.save();
        return activity;
    } catch (error) {
        console.error('Error logging activity:', error);
    }
};

// Get activity logs for department
const getActivityLogs = async (req, res) => {
    try {
        const { department, limit = 50, actionType } = req.query;

        const filter = {};
        if (department) filter.department = department;
        if (actionType) filter.actionType = actionType;

        const activities = await ActivityLog.find(filter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

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

        const filter = {};
        if (department) filter.department = department;
        if (status) filter.status = status;
        if (assignedTo) filter.assignedTo = assignedTo;
        if (managerId) filter.assignedBy = managerId;

        const tasks = await DepartmentTask.find(filter)
            .populate('assignedTo', 'name email role')
            .populate('assignedBy', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, tasks });
    } catch (error) {
        console.error('Error fetching department tasks:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
    }
};

// Create department task
const createDepartmentTask = async (req, res) => {
    try {
        const { title, description, department, assignedTo, priority, dueDate } = req.body;
        const assignedBy = req.user?.id;

        // Get assignee name
        const assignee = await DepartmentTeam.findById(assignedTo);
        if (!assignee) {
            return res.status(404).json({ success: false, message: 'Assignee not found' });
        }

        const task = new DepartmentTask({
            title,
            description,
            department,
            assignedBy,
            assignedTo,
            assignedToName: assignee.name,
            priority,
            dueDate,
        });

        await task.save();

        // Update assignee's task count
        await DepartmentTeam.findByIdAndUpdate(assignedTo, {
            $inc: { tasksAssigned: 1 }
        });

        // Log activity
        await logActivity({
            department,
            performedBy: assignedBy,
            performedByType: 'TeamLeader',
            performedByName: req.user?.name || 'Manager',
            action: 'assigned_task',
            actionType: 'task',
            description: `Assigned "${title}" to ${assignee.name}`,
            relatedEntity: task._id,
            relatedEntityType: 'Task'
        });

        res.status(201).json({ success: true, task, message: 'Task assigned successfully' });
    } catch (error) {
        console.error('Error creating department task:', error);
        res.status(500).json({ success: false, message: 'Failed to create task' });
    }
};

// Update department task
const updateDepartmentTask = async (req, res) => {
    try {
        const { status, comments } = req.body;
        const userId = req.user?.id;
        const userType = req.user?.userType || 'TeamLeader';

        const updateData = { ...req.body };
        
        // If marking as completed
        if (status === 'Completed') {
            updateData.completedAt = new Date();
        }

        // Add comment if provided
        if (comments) {
            const task = await DepartmentTask.findById(req.params.id);
            updateData.comments = [
                ...(task.comments || []),
                {
                    text: comments,
                    by: userId,
                    byType: userType,
                    byName: req.user?.name || 'User',
                    createdAt: new Date()
                }
            ];
        }

        const task = await DepartmentTask.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).populate('assignedTo', 'name email role');

        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        // Update team member stats if completed
        if (status === 'Completed') {
            await DepartmentTeam.findByIdAndUpdate(task.assignedTo._id, {
                $inc: { tasksCompleted: 1 }
            });

            // Log activity
            await logActivity({
                department: task.department,
                performedBy: task.assignedTo._id,
                performedByType: 'DepartmentTeam',
                performedByName: task.assignedToName,
                action: 'completed_task',
                actionType: 'task',
                description: `Completed task "${task.title}"`,
                relatedEntity: task._id,
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
        const task = await DepartmentTask.findByIdAndDelete(req.params.id);
        
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

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

        const filter = { department };
        if (managerId) filter.manager = managerId;

        // Team stats
        const teamMembers = await DepartmentTeam.find(filter);
        const activeMembers = teamMembers.filter(m => m.status === 'Active').length;
        const onLeave = teamMembers.filter(m => m.status === 'On Leave').length;

        // Task stats
        const taskFilter = { department };
        if (managerId) taskFilter.assignedBy = managerId;
        
        const allTasks = await DepartmentTask.find(taskFilter);
        const pendingTasks = allTasks.filter(t => t.status === 'Pending').length;
        const inProgressTasks = allTasks.filter(t => t.status === 'In Progress').length;
        const completedTasks = allTasks.filter(t => t.status === 'Completed').length;
        const overdueTasks = allTasks.filter(t => t.status === 'Overdue' || (t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Completed')).length;

        // Recent activities
        const recentActivities = await ActivityLog.find({ department })
            .sort({ createdAt: -1 })
            .limit(10);

        // Workload distribution
        const workload = await DepartmentTask.aggregate([
            { $match: { department, status: { $ne: 'Completed' } } },
            { $group: { _id: '$assignedTo', count: { $sum: 1 } } }
        ]);

        // Map workload to team members
        const workloadWithNames = await Promise.all(
            workload.map(async (w) => {
                const member = await DepartmentTeam.findById(w._id);
                return { name: member?.name || 'Unknown', tasks: w.count };
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
                recentActivities,
            }
        });
    } catch (error) {
        console.error('Error fetching department stats:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch stats' });
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

        const member = await DepartmentTeam.findOne({ email: email.toLowerCase() });
        
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

        const isPasswordValid = await comparePassword(password, member.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }

        const token = generateToken({
            id: member._id,
            email: member.email,
            name: member.name,
            role: member.role,
            department: member.department,
            userType: 'departmentTeam'
        });

        // Log activity
        await logActivity(
            member.department,
            'LOGIN',
            `${member.name} logged in`,
            member._id,
            null
        );

        res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: member._id,
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
};
