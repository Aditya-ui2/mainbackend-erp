const { WorkAgreement, Client, Task, RecurringTask } = require('../models/sequelizeModels');
const { Op } = require('sequelize');

// ── Create a new work agreement for a client ──
const createWorkAgreement = async (req, res) => {
    try {
        const { clientId, title, description, allowedScopes, maxTasks, startDate, endDate, notes } = req.body;

        if (!clientId || !title || !allowedScopes || !startDate) {
            return res.status(400).json({
                message: 'clientId, title, allowedScopes, and startDate are required.'
            });
        }

        if (!Array.isArray(allowedScopes) || allowedScopes.length === 0) {
            return res.status(400).json({
                message: 'allowedScopes must be a non-empty array of scope strings.'
            });
        }

        const client = await Client.findByPk(clientId);
        if (!client) {
            return res.status(404).json({ message: 'Client not found.' });
        }

        // Check if there's already an active agreement for this client
        const existing = await WorkAgreement.findOne({
            where: { clientId, status: 'Active' }
        });
        if (existing) {
            return res.status(409).json({
                message: 'An active work agreement already exists for this client. Terminate or expire it first.',
                existingAgreementId: existing.id
            });
        }

        const agreement = await WorkAgreement.create({
            clientId,
            title,
            description: description || null,
            allowedScopes,
            maxTasks: maxTasks || null,
            startDate,
            endDate: endDate || null,
            notes: notes || null
        });

        res.status(201).json({ message: 'Work agreement created successfully.', agreement });
    } catch (error) {
        console.error('Error creating work agreement:', error);
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

// ── Get all work agreements (optionally filter by clientId) ──
const getWorkAgreements = async (req, res) => {
    try {
        const { clientId, status } = req.query;
        const where = {};
        if (clientId) where.clientId = clientId;
        if (status) where.status = status;

        const agreements = await WorkAgreement.findAll({
            where,
            include: [{
                model: Client,
                as: 'client',
                attributes: ['id', 'name', 'companyName', 'email']
            }],
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({ message: 'Work agreements fetched.', agreements });
    } catch (error) {
        console.error('Error fetching work agreements:', error);
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

// ── Get a single work agreement by ID ──
const getWorkAgreementById = async (req, res) => {
    try {
        const { id } = req.params;
        const agreement = await WorkAgreement.findByPk(id, {
            include: [{
                model: Client,
                as: 'client',
                attributes: ['id', 'name', 'companyName', 'email']
            }]
        });

        if (!agreement) {
            return res.status(404).json({ message: 'Work agreement not found.' });
        }

        // Count current active tasks for this client
        const activeTasks = await Task.count({
            where: {
                clientId: agreement.clientId,
                status: { [Op.notIn]: ['Resolved'] }
            }
        });

        res.status(200).json({
            message: 'Work agreement fetched.',
            agreement,
            activeTasks,
            taskLimitReached: agreement.maxTasks ? activeTasks >= agreement.maxTasks : false
        });
    } catch (error) {
        console.error('Error fetching work agreement:', error);
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

// ── Update a work agreement ──
const updateWorkAgreement = async (req, res) => {
    try {
        const { agreementId, title, description, allowedScopes, maxTasks, startDate, endDate, status, notes } = req.body;

        if (!agreementId) {
            return res.status(400).json({ message: 'agreementId is required.' });
        }

        const agreement = await WorkAgreement.findByPk(agreementId);
        if (!agreement) {
            return res.status(404).json({ message: 'Work agreement not found.' });
        }

        if (allowedScopes && (!Array.isArray(allowedScopes) || allowedScopes.length === 0)) {
            return res.status(400).json({ message: 'allowedScopes must be a non-empty array.' });
        }

        const updates = {};
        if (title !== undefined) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (allowedScopes !== undefined) updates.allowedScopes = allowedScopes;
        if (maxTasks !== undefined) updates.maxTasks = maxTasks;
        if (startDate !== undefined) updates.startDate = startDate;
        if (endDate !== undefined) updates.endDate = endDate;
        if (status !== undefined) updates.status = status;
        if (notes !== undefined) updates.notes = notes;

        await agreement.update(updates);

        res.status(200).json({ message: 'Work agreement updated.', agreement });
    } catch (error) {
        console.error('Error updating work agreement:', error);
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

// ── Delete a work agreement ──
const deleteWorkAgreement = async (req, res) => {
    try {
        const { agreementId } = req.body;

        if (!agreementId) {
            return res.status(400).json({ message: 'agreementId is required.' });
        }

        const agreement = await WorkAgreement.findByPk(agreementId);
        if (!agreement) {
            return res.status(404).json({ message: 'Work agreement not found.' });
        }

        await agreement.destroy();
        res.status(200).json({ message: 'Work agreement deleted.' });
    } catch (error) {
        console.error('Error deleting work agreement:', error);
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

// ── Validate a task against the client's active agreement ──
// Returns { allowed: true } or { allowed: false, reason: '...' }
const validateTaskAgainstAgreement = async (clientId, taskTitle) => {
    const agreement = await WorkAgreement.findOne({
        where: { clientId, status: 'Active' }
    });

    // No agreement → allow (agreement is optional)
    if (!agreement) return { allowed: true };

    // Check expiry
    if (agreement.endDate && new Date(agreement.endDate) < new Date()) {
        await agreement.update({ status: 'Expired' });
        return { allowed: false, reason: 'The work agreement for this client has expired.' };
    }

    // Check scope — task title must contain at least one allowed scope keyword
    const titleLower = (taskTitle || '').toLowerCase();
    const scopeMatch = agreement.allowedScopes.some(scope =>
        titleLower.includes(scope.toLowerCase())
    );

    if (!scopeMatch) {
        return {
            allowed: false,
            reason: `Task "${taskTitle}" is outside the agreed scope. Allowed scopes: ${agreement.allowedScopes.join(', ')}.`
        };
    }

    // Check max tasks limit
    if (agreement.maxTasks) {
        const activeTasks = await Task.count({
            where: {
                clientId,
                status: { [Op.notIn]: ['Resolved'] }
            }
        });
        const activeRecurring = await RecurringTask.count({
            where: { clientId, active: true }
        });

        if ((activeTasks + activeRecurring) >= agreement.maxTasks) {
            return {
                allowed: false,
                reason: `Task limit reached. Client has ${activeTasks + activeRecurring} active tasks (max: ${agreement.maxTasks}).`
            };
        }
    }

    return { allowed: true };
};

// ── Get agreement summary for dashboard ──
const getAgreementSummary = async (req, res) => {
    try {
        const agreements = await WorkAgreement.findAll({
            include: [{
                model: Client,
                as: 'client',
                attributes: ['id', 'name', 'companyName']
            }],
            order: [['createdAt', 'DESC']]
        });

        const summaries = [];
        for (const ag of agreements) {
            const activeTasks = await Task.count({
                where: { clientId: ag.clientId, status: { [Op.notIn]: ['Resolved'] } }
            });
            const activeRecurring = await RecurringTask.count({
                where: { clientId: ag.clientId, active: true }
            });

            summaries.push({
                id: ag.id,
                clientId: ag.clientId,
                clientName: ag.client?.name,
                companyName: ag.client?.companyName,
                title: ag.title,
                allowedScopes: ag.allowedScopes,
                maxTasks: ag.maxTasks,
                currentTasks: activeTasks + activeRecurring,
                startDate: ag.startDate,
                endDate: ag.endDate,
                status: ag.status,
                notes: ag.notes,
                createdAt: ag.createdAt
            });
        }

        res.status(200).json({ message: 'Agreement summaries fetched.', summaries });
    } catch (error) {
        console.error('Error fetching agreement summary:', error);
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

module.exports = {
    createWorkAgreement,
    getWorkAgreements,
    getWorkAgreementById,
    updateWorkAgreement,
    deleteWorkAgreement,
    validateTaskAgainstAgreement,
    getAgreementSummary
};
