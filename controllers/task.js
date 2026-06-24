
const { RequestTask, Task, TeamLeader, Employee, Client, RecurringTask, DepartmentTask, sequelize } = require('../models/sequelizeModels');
const { addNotification } = require('./notification');
const { scheduleCronJob, cronJobs } = require('./task_cron');
const { validateTaskAgainstAgreement } = require('./workAgreement');
const { Op } = require('sequelize');



// Function for a client to request a task
const requestTask = async (req, res) => {
    try {
        const { title, description, clientId, category, frequency, dueDate, priority } = req.body;

        // Validate required fields
        if (!title || !description || !clientId || !category) {
            return res.status(400).json({
                message: 'Title, description, client ID, and category are required.',
            });
        }

        // Validate category-specific fields
        if (category === 'Frequency') {
            if (!frequency) {
                return res.status(400).json({
                    message: 'Frequency is required for Frequency-based tasks.',
                });
            }
        } else if (category === 'Deadline') {
            if (!dueDate) {
                return res.status(400).json({
                    message: 'Due date is required for Deadline-based tasks.',
                });
            }

            // Validate dueDate value
            const parsedDueDate = new Date(dueDate);
            if (isNaN(parsedDueDate)) {
                return res.status(400).json({
                    message: 'Invalid due date format.',
                });
            }
        } else {
            return res.status(400).json({
                message: 'Invalid category. Allowed values: Frequency, Deadline.',
            });
        }

        // Create the requested task
        // ── Validate against work agreement scope ──
        const scopeCheck = await validateTaskAgainstAgreement(clientId, title);
        if (!scopeCheck.allowed) {
            return res.status(403).json({
                message: scopeCheck.reason,
                scopeViolation: true
            });
        }

        const newRequestTask = await RequestTask.create({
            title,
            description,
            clientId: clientId,
            category,
            frequency: category === 'Frequency' ? frequency : null,
            dueDate: category === 'Deadline' ? new Date(dueDate) : null,
            priority,
        });

        res.status(201).json({
            message: 'Task requested successfully.',
            requestedTask: newRequestTask,
        });
    } catch (error) {
        console.error('Error requesting task:', error);
        res.status(500).json({
            message: 'Server error. Unable to request task.',
            error: error.message,
        });
    }
};

const getRequestedTasksForTeamLeader = async (req, res) => {
    try {
        const { teamLeaderId } = req.body;

        // Ensure the team leader ID is provided
        if (!teamLeaderId) {
            return res.status(400).json({ message: 'Team Leader ID is required.' });
        }

        // Find all clients connected to the Team Leader
        const clients = await Client.findAll({ where: { teamLeaderId: teamLeaderId } });

        // If no clients are found, return an appropriate message
        if (!clients.length) {
            return res.status(404).json({ message: 'No clients found for this Team Leader.' });
        }

        // Extract client IDs
        const clientIds = clients.map(client => client.id);

        // Find all requested tasks for the clients managed by this Team Leader
        const requestedTasks = await RequestTask.findAll({
            where: { clientId: { [Op.in]: clientIds } },
            include: [{
                model: Client,
                as: 'client',
                attributes: ['id', 'name', 'email', 'companyName', 'contactNumber']
            }],
            order: [['createdAt', 'DESC']]
        });

        // Check if there are any requested tasks
        if (!requestedTasks.length) {
            return res.status(404).json({ message: 'No requested tasks found for this Team Leader.' });
        }

        // Return the requested tasks
        res.status(200).json({
            message: 'Requested tasks retrieved successfully.',
            requestedTasks,
        });
    } catch (error) {
        console.error('Error retrieving requested tasks for Team Leader:', error);
        res.status(500).json({
            message: 'Server error. Unable to retrieve requested tasks.',
            error: error.message,
        });
    }
};


const acceptTask = async (requestedTask, assignedUserId, assignedUserType) => {
    if (!assignedUserId || !assignedUserType) {
        throw new Error('Assigned user ID and user type are required for accepting the task.');
    }

    if (!['Employee', 'TeamLeader'].includes(assignedUserType)) {
        throw new Error('Assigned user type must be "Employee" or "TeamLeader".');
    }

    // Get client details to fetch teamLeaderId
    const client = await Client.findByPk(requestedTask.clientId);
    if (!client) {
        throw new Error('Client not found');
    }

    if (!client.teamLeaderId) {
        throw new Error('No team leader assigned to this client');
    }

    const teamLeaderId = client.teamLeaderId;

    if (requestedTask.category === 'Deadline') {
        const newTask = await Task.create({
            title: requestedTask.title,
            description: requestedTask.description,
            status: 'Active',
            category: 'Deadline',
            clientId: requestedTask.clientId,
            assignedToType: assignedUserType,
            assignedToId: assignedUserId,
            dueDate: requestedTask.dueDate,
            priority: requestedTask.priority,
            parentTaskId: requestedTask.id
        });

        try {
            const formattedDueDate = new Date(requestedTask.dueDate).toLocaleDateString();
            const notificationMessage = `New task "${requestedTask.title}" has been assigned to you by Team Leader. Due date: ${formattedDueDate}`;

            await addNotification(
                assignedUserId,
                assignedUserType,
                notificationMessage
            );
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
        }

        return newTask;
    }

    if (requestedTask.category === 'Frequency') {
        const newRecurringTask = await RecurringTask.create({
            title: requestedTask.title,
            description: requestedTask.description,
            clientId: requestedTask.clientId,
            frequency: requestedTask.frequency,
            assignedToType: assignedUserType,
            assignedToId: assignedUserId,
            priority: requestedTask.priority,
            active: true
        });

        await scheduleCronJob(newRecurringTask, teamLeaderId);
        return newRecurringTask;
    }

    throw new Error('Invalid category. Only "Deadline" and "Frequency" tasks are supported.');
};


const rejectTask = async (requestedTask, rejectionReason) => {
    if (!rejectionReason) {
        throw new Error('Rejection reason is required.');
    }

    await requestedTask.update({
        status: 'Rejected',
        rejectionReason: rejectionReason
    });

    return requestedTask;
};


const acceptOrRejectTask = async (req, res) => {
    try {
        const { requestedTaskId, action, assignedUserId, assignedUserType, rejectionReason } = req.body;

        // Validate input
        if (!requestedTaskId || !action) {
            return res.status(400).json({ message: 'Requested Task ID and action are required.' });
        }

        // Find the requested task
        const requestedTask = await RequestTask.findByPk(requestedTaskId);
        if (!requestedTask) {
            return res.status(404).json({ message: 'Requested task not found.' });
        }

        if (requestedTask.status !== 'Requested') {
            return res.status(400).json({ message: 'Task has already been processed.' });
        }

        if (action === 'accept') {
            const result = await acceptTask(requestedTask, assignedUserId, assignedUserType);
            await requestedTask.update({ status: 'Accepted' });

            return res.status(201).json({
                message: 'Task accepted successfully.',
                task: result
            });
        }

        if (action === 'reject') {
            const result = await rejectTask(requestedTask, rejectionReason);
            return res.status(200).json({
                message: 'Task rejected successfully.',
                task: result
            });
        }

        return res.status(400).json({ message: 'Invalid action. Use "accept" or "reject".' });
    } catch (error) {
        console.error('Error processing task:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const createTaskByTL = async (req, res) => {
    try {
        const {
            title,
            description,
            clientId,
            category,
            frequency,
            dueDate,
            priority,
            assignedUserId,
            assignedUserType
        } = req.body;

        if (!title || !description || !clientId || !category || !assignedUserId || !assignedUserType) {
            return res.status(400).json({
                message: 'Title, description, client ID, category, assigned user ID, and user type are required.'
            });
        }

        // Get client details to fetch teamLeaderId
        const client = await Client.findByPk(clientId);
        if (!client) {
            return res.status(404).json({
                message: 'Client not found'
            });
        }

        if (!client.teamLeaderId) {
            return res.status(400).json({
                message: 'No team leader assigned to this client'
            });
        }

        const teamLeaderId = client.teamLeaderId;

        if (category === 'Frequency' && !frequency) {
            return res.status(400).json({
                message: 'Frequency is required for frequency-based tasks.'
            });
        }

        if (category === 'Deadline' && !dueDate) {
            return res.status(400).json({
                message: 'Due date is required for deadline-based tasks.'
            });
        }

        if (!['Employee', 'TeamLeader'].includes(assignedUserType)) {
            return res.status(400).json({
                message: 'Assigned user type must be "Employee" or "TeamLeader".'
            });
        }

        // ── Validate against work agreement scope ──
        const scopeCheck = await validateTaskAgainstAgreement(clientId, title);
        if (!scopeCheck.allowed) {
            return res.status(403).json({
                message: scopeCheck.reason,
                scopeViolation: true
            });
        }

        if (category === 'Deadline') {
            const newTask = await Task.create({
                title,
                description,
                category,
                clientId: clientId,
                assignedToType: assignedUserType,
                assignedToId: assignedUserId,
                dueDate,
                priority,
                status: 'Active'
            });

            try {
                const formattedDueDate = new Date(dueDate).toLocaleDateString();
                const notificationMessage = `New task "${title}" has been assigned to you by Team Leader. Due date: ${formattedDueDate}`;

                await addNotification(
                    assignedUserId,
                    assignedUserType,
                    notificationMessage
                );
            } catch (notificationError) {
                console.error('Error sending notification:', notificationError);
            }

            return res.status(201).json({
                message: 'Deadline task created successfully.',
                task: newTask
            });
        }

        if (category === 'Frequency') {
            const newRecurringTask = await RecurringTask.create({
                title,
                description,
                clientId: clientId,
                frequency,
                assignedToType: assignedUserType,
                assignedToId: assignedUserId,
                priority,
                active: true
            });

            await scheduleCronJob(newRecurringTask);

            return res.status(201).json({
                message: 'Frequency task created successfully and scheduled.',
                recurringTask: newRecurringTask
            });
        }

        return res.status(400).json({
            message: 'Invalid category. Use "Deadline" or "Frequency".'
        });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({
            message: 'Server error.',
            error: error.message
        });
    }
};

const deleteTask = async (req, res) => {
    try {
        const { taskId } = req.body;

        // Validate the task ID
        if (!taskId) {
            return res.status(400).json({ message: 'Task ID is required.' });
        }

        // Find the task by ID
        const task = await Task.findByPk(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found.' });
        }

        // Delete the task from the database
        await task.destroy();

        res.status(200).json({ message: 'Task deleted successfully.' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};


// Function to update the status of a task
const updateTaskStatus = async (req, res) => {
    try {
        const { taskId, status } = req.body;

        // Validate required fields
        if (!taskId || !status) {
            return res.status(400).json({ message: 'Task ID and status are required.' });
        }

        // Validate status value
        const validStatuses = ['Active', 'Work in Progress', 'Review', 'Pending', 'Resolved'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid task status provided.' });
        }

        // Find and update the task
        const task = await Task.findByPk(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found.' });
        }

        await task.update({ status });

        res.status(200).json({
            message: 'Task status updated successfully.',
            task
        });
    } catch (error) {
        console.error('Error updating task status:', error);
        res.status(500).json({ message: 'Server error while updating task status.' });
    }
};


// Get all tasks
const getAllTasks = async (req, res) => {
    try {
        // Fetch all tasks from the database
        const tasks = await Task.findAll({
            include: [{
                model: Client,
                as: 'client',
                attributes: ['id', 'name', 'email', 'companyName']
            }],
            order: [['createdAt', 'DESC']]
        });

        if (!tasks.length) {
            return res.status(404).json({ message: 'No tasks found.' });
        }

        res.status(200).json({
            message: 'All tasks fetched successfully.',
            tasks
        });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Server error while fetching tasks.', error: error.message });
    }
};


// Function to get all tasks for a specific client
const getClientTasks = async (req, res) => {
    try {
        const { clientId } = req.body;

        // Validate clientId parameter
        if (!clientId) {
            return res.status(400).json({ message: 'Client ID is required.' });
        }

        // Validate if the client exists
        const client = await Client.findByPk(clientId);
        if (!client) {
            return res.status(404).json({ message: 'Client not found.' });
        }

        // Fetch tasks associated with the client
        const tasks = await Task.findAll({
            where: { clientId: clientId },
            include: [{
                model: Client,
                as: 'client',
                attributes: ['id', 'name', 'email', 'companyName']
            }],
            order: [['createdAt', 'DESC']]
        });

        // Respond with the tasks
        res.status(200).json({
            message: `Tasks for client: ${client.name}`,
            tasks
        });
    } catch (error) {
        console.error('Error fetching client tasks:', error);
        res.status(500).json({ message: 'Error fetching client tasks.', error });
    }
};

const getTasksByAssignedUser = async (req, res) => {
    try {
        const { userId } = req.body;

        // Validate if the userId is provided
        if (!userId) {
            return res.status(400).json({ message: 'User ID is required.' });
        }

        // Find standard tasks assigned to the specific userId
        const tasks = await Task.findAll({
            where: {
                assignedToId: userId
            },
            include: [{
                model: Client,
                as: 'client',
                attributes: ['id', 'name', 'email', 'companyName']
            }],
            order: [['createdAt', 'DESC']]
        });

        // Also check for DepartmentTasks assigned to this userId
        let deptTasks = [];
        try {
            deptTasks = await DepartmentTask.findAll({
                where: {
                    assignedTo: userId
                },
                order: [['createdAt', 'DESC']]
            });
        } catch (deptError) {
            console.error('Error fetching department tasks in getTasksByAssignedUser:', deptError);
        }

        // Map department tasks to match the standard task structure
        const mappedDeptTasks = deptTasks.map(t => {
            const raw = t.toJSON ? t.toJSON() : t;
            // Map status values to match standard task status values
            let mappedStatus = raw.status;
            if (raw.status === 'Completed') {
                mappedStatus = 'Resolved';
            } else if (raw.status === 'In Progress') {
                mappedStatus = 'Work in Progress';
            } else if (raw.status === 'Pending') {
                mappedStatus = 'Pending';
            } else if (raw.status === 'Overdue') {
                mappedStatus = 'Pending'; // fallback
            }

            return {
                ...raw,
                assignedToId: raw.assignedTo,
                status: mappedStatus,
                client: null
            };
        });

        // Combine standard tasks and department tasks
        const combinedTasks = [...tasks, ...mappedDeptTasks];

        // Sort combined tasks by createdAt descending
        combinedTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.status(200).json({
            message: `Tasks assigned to user: ${userId} fetched successfully.`,
            tasks: combinedTasks
        });
    } catch (error) {
        console.error('Error fetching tasks for assigned user:', error);
        res.status(500).json({ message: 'Server error while fetching tasks.', error: error.message });
    }
};

// Recurring Task Functions -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const getAllRecurringTasks = async (req, res) => {
    try {
        const recurringTasks = await RecurringTask.findAll({
            include: [{
                model: Client,
                as: 'client',
                attributes: ['id', 'name', 'email', 'companyName']
            }],
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            message: recurringTasks.length ? 'Recurring tasks fetched successfully.' : 'No recurring tasks found.',
            totalTasks: recurringTasks.length,
            recurringTasks
        });
    } catch (error) {
        console.error('Error fetching recurring tasks:', error);
        res.status(500).json({ 
            message: 'Server error while fetching recurring tasks.', 
            error: error.message 
        });
    }
};

const getRecurringTasksByClient = async (req, res) => {
    try {
        const { clientId } = req.body;

        // Validate input
        if (!clientId) {
            return res.status(400).json({ 
                message: 'Client ID is required.',
                required: ['clientId']
            });
        }

        // Verify client exists
        const clientExists = await Client.findByPk(clientId);
        if (!clientExists) {
            return res.status(404).json({ 
                message: 'Client not found.',
                clientId
            });
        }

        // Build filter
        const whereClause = { clientId: clientId };
        if (req.query.active !== undefined) {
            whereClause.active = req.query.active === 'true';
        }

        const recurringTasks = await RecurringTask.findAll({
            where: whereClause,
            include: [{
                model: Client,
                as: 'client',
                attributes: ['id', 'name', 'email', 'companyName']
            }],
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            message: recurringTasks.length 
                ? `Recurring tasks for client fetched successfully.`
                : 'No recurring tasks found for this client.',
            clientId,
            totalTasks: recurringTasks.length,
            recurringTasks
        });
    } catch (error) {
        console.error('Error fetching recurring tasks:', error);
        res.status(500).json({ 
            message: 'Server error while fetching recurring tasks.',
            error: error.message
        });
    }
};

const deleteOrDeactivateRecurringTask = async (req, res) => {
    try {
        const { recurringTaskId, action } = req.body;

        // Input validation
        if (!recurringTaskId || !action) {
            return res.status(400).json({ 
                message: 'Recurring Task ID and action are required.',
                required: ['recurringTaskId', 'action']
            });
        }

        if (!['delete', 'deactivate'].includes(action)) {
            return res.status(400).json({ 
                message: 'Invalid action. Use "delete" or "deactivate".',
                allowedActions: ['delete', 'deactivate']
            });
        }

        // Fetch the recurring task
        const recurringTask = await RecurringTask.findByPk(recurringTaskId);
        if (!recurringTask) {
            return res.status(404).json({ 
                message: 'Recurring task not found.',
                taskId: recurringTaskId
            });
        }

        // Stop the cron job if exists
        if (cronJobs[recurringTaskId]) {
            cronJobs[recurringTaskId].stop();
            delete cronJobs[recurringTaskId];
        }

        // Perform action
        if (action === 'delete') {
            await recurringTask.destroy();
            return res.status(200).json({ 
                message: 'Recurring task deleted and cron job stopped successfully.',
                taskId: recurringTaskId
            });
        } else {
            await recurringTask.update({ active: false });
            return res.status(200).json({ 
                message: 'Recurring task deactivated and cron job stopped successfully.',
                taskId: recurringTaskId,
                task: recurringTask
            });
        }
    } catch (error) {
        console.error('Error deleting or deactivating recurring task:', error);
        return res.status(500).json({ 
            message: 'Server error.',
            error: error.message
        });
    }
};


const getRecurringTasksByTeamLeader = async (req, res) => {
    try {
        const { teamLeaderId } = req.body;

        // Validate if teamLeaderId is provided
        if (!teamLeaderId) {
            return res.status(400).json({ message: 'Team Leader ID is required.' });
        }

        // First, find the team leader
        const teamLeader = await TeamLeader.findByPk(teamLeaderId);

        if (!teamLeader) {
            return res.status(404).json({ message: 'Team Leader not found.' });
        }

        // Get clients associated with this team leader
        const clients = await Client.findAll({
            where: { teamLeaderId: teamLeaderId },
            attributes: ['id']
        });

        // Get array of client IDs associated with the team leader
        const clientIds = clients.map(client => client.id);

        // Fetch recurring tasks for all clients associated with the team leader
        const recurringTasks = await RecurringTask.findAll({
            where: { clientId: { [Op.in]: clientIds } },
            include: [{
                model: Client,
                as: 'client',
                attributes: ['id', 'name', 'email', 'companyName']
            }],
            order: [['createdAt', 'DESC']]
        });

        if (!recurringTasks.length) {
            return res.status(404).json({
                message: 'No recurring tasks found for clients associated with this team leader.'
            });
        }

        // Group tasks by client for better organization
        const tasksGroupedByClient = recurringTasks.reduce((acc, task) => {
            const clientId = task.clientId;
            if (!acc[clientId]) {
                acc[clientId] = {
                    clientName: task.client.name,
                    companyName: task.client.companyName,
                    tasks: []
                };
            }
            acc[clientId].tasks.push(task);
            return acc;
        }, {});

        res.status(200).json({
            message: 'Recurring tasks fetched successfully.',
            teamLeaderName: teamLeader.name,
            totalTasks: recurringTasks.length,
            recurringTasks,
            tasksGroupedByClient
        });

    } catch (error) {
        console.error('Error fetching recurring tasks for team leader:', error);
        res.status(500).json({
            message: 'Server error while fetching recurring tasks.',
            error: error.message
        });
    }
};


// Function to restart cron jobs on server restart


// KAM Productivity Dashboard - aggregated stats for managers
const getKamProductivity = async (req, res) => {
    try {
        const now = new Date();

        // ── All tasks ──
        const allTasks = await Task.findAll({
            include: [{
                model: Client,
                as: 'client',
                attributes: ['id', 'name', 'companyName']
            }],
            order: [['createdAt', 'DESC']]
        });

        // ── Status counts ──
        const statusCounts = { Active: 0, 'Work in Progress': 0, Review: 0, Pending: 0, Resolved: 0 };
        const priorityCounts = { High: 0, Medium: 0, Low: 0 };
        let overdueCount = 0;
        const assigneeMap = {};   // userId -> { name, type, tasks[] }
        const clientMap = {};     // clientId -> { name, company, total, resolved }

        // ── 30-day window for trend ──
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const weeklyBuckets = {};

        for (const task of allTasks) {
            // Status
            if (statusCounts[task.status] !== undefined) statusCounts[task.status]++;

            // Priority
            if (task.priority && priorityCounts[task.priority] !== undefined) priorityCounts[task.priority]++;

            // Overdue
            if (task.dueDate && new Date(task.dueDate) < now && task.status !== 'Resolved') {
                overdueCount++;
            }

            // Per-assignee
            const aType = task.assignedToType || (task.assignedTo && task.assignedTo.userType);
            const aId = task.assignedToId || (task.assignedTo && task.assignedTo.userId);
            if (aId) {
                if (!assigneeMap[aId]) {
                    assigneeMap[aId] = { id: aId, type: aType, total: 0, resolved: 0, overdue: 0, inProgress: 0 };
                }
                assigneeMap[aId].total++;
                if (task.status === 'Resolved') assigneeMap[aId].resolved++;
                if (task.status === 'Work in Progress') assigneeMap[aId].inProgress++;
                if (task.dueDate && new Date(task.dueDate) < now && task.status !== 'Resolved') assigneeMap[aId].overdue++;
            }

            // Per-client
            if (task.clientId && task.client) {
                if (!clientMap[task.clientId]) {
                    clientMap[task.clientId] = {
                        id: task.clientId,
                        name: task.client.name,
                        company: task.client.companyName,
                        total: 0,
                        resolved: 0
                    };
                }
                clientMap[task.clientId].total++;
                if (task.status === 'Resolved') clientMap[task.clientId].resolved++;
            }

            // Weekly trend (resolved in last 30 days)
            if (task.status === 'Resolved' && task.updatedAt && new Date(task.updatedAt) >= thirtyDaysAgo) {
                const weekStart = new Date(task.updatedAt);
                weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                const key = weekStart.toISOString().slice(0, 10);
                weeklyBuckets[key] = (weeklyBuckets[key] || 0) + 1;
            }
        }

        // Resolve assignee names
        const assigneeIds = Object.keys(assigneeMap);
        const [teamLeaders, employees] = await Promise.all([
            TeamLeader.findAll({ where: { id: { [Op.in]: assigneeIds } }, attributes: ['id', 'name'] }),
            Employee.findAll({ where: { id: { [Op.in]: assigneeIds } }, attributes: ['id', 'name'] })
        ]);
        const nameMap = {};
        for (const tl of teamLeaders) nameMap[tl.id] = tl.name;
        for (const emp of employees) nameMap[emp.id] = emp.name;

        const assigneeStats = Object.values(assigneeMap).map(a => ({
            ...a,
            name: nameMap[a.id] || 'Unknown',
            completionRate: a.total > 0 ? Math.round((a.resolved / a.total) * 100) : 0
        })).sort((a, b) => b.completionRate - a.completionRate);

        const clientStats = Object.values(clientMap).sort((a, b) => b.total - a.total);

        // Weekly trend sorted by date
        const weeklyTrend = Object.entries(weeklyBuckets)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([week, count]) => ({ week, resolved: count }));

        // Recurring tasks summary
        const activeRecurring = await RecurringTask.count({ where: { active: true } });
        const totalRecurring = await RecurringTask.count();

        const totalTasks = allTasks.length;
        const resolvedTasks = statusCounts.Resolved;
        const completionRate = totalTasks > 0 ? Math.round((resolvedTasks / totalTasks) * 100) : 0;

        res.status(200).json({
            message: 'KAM productivity data fetched successfully.',
            summary: {
                totalTasks,
                resolvedTasks,
                overdueCount,
                completionRate,
                activeRecurring,
                totalRecurring
            },
            statusCounts,
            priorityCounts,
            assigneeStats,
            clientStats,
            weeklyTrend,
            recentTasks: allTasks.slice(0, 10).map(t => ({
                id: t.id,
                title: t.title,
                status: t.status,
                priority: t.priority,
                dueDate: t.dueDate,
                client: t.client ? t.client.name : null,
                createdAt: t.createdAt
            }))
        });
    } catch (error) {
        console.error('Error fetching KAM productivity:', error);
        res.status(500).json({ message: 'Server error fetching KAM productivity.', error: error.message });
    }
};


module.exports = {
    requestTask,
    getRequestedTasksForTeamLeader,
    acceptOrRejectTask,
    deleteTask,
    updateTaskStatus,
    getAllTasks,
    createTaskByTL,
    getClientTasks,

    getTasksByAssignedUser,

    // Recurring Tasks 
    getRecurringTasksByTeamLeader,
    getAllRecurringTasks,
    deleteOrDeactivateRecurringTask,
    getRecurringTasksByClient,

    // KAM Productivity
    getKamProductivity,
};
