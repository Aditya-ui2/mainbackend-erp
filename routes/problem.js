const express = require('express');
const router = express.Router();
const { Problem } = require('../models/sequelizeModels');

// GET all problems
router.get('/', async (req, res) => {
    try {
        const problems = await Problem.findAll({ order: [['createdAt', 'DESC']] });
        res.json({
            success: true,
            data: problems
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST create problem
router.post('/', async (req, res) => {
    try {
        const {
            title,
            priority,
            category,
            description,
            raisedBy,
            raisedByRole
        } = req.body;

        const problem = await Problem.create({
            title,
            priority,
            category,
            description,
            raisedBy,
            raisedByRole
        });

        res.json({
            success: true,
            data: problem
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// PATCH update problem status (e.g. resolve)
router.patch('/:id/status', async (req, res) => {
    try {
        const { status, resolvedBy, resolutionNotes } = req.body;
        const problem = await Problem.findByPk(req.params.id);

        if (!problem) {
            return res.status(404).json({ success: false, message: 'Problem not found' });
        }

        problem.status = status;
        if (status === 'Resolved') {
            problem.resolvedAt = new Date();
            problem.resolvedBy = resolvedBy;
            if (resolutionNotes) problem.resolutionNotes = resolutionNotes;
        }

        await problem.save();
        res.json({ success: true, message: 'Problem status updated', data: problem });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE a problem
router.delete('/:id', async (req, res) => {
    try {
        const problem = await Problem.findByPk(req.params.id);
        if (!problem) {
            return res.status(404).json({ success: false, message: 'Problem not found' });
        }

        await problem.destroy();
        res.json({ success: true, message: 'Problem deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST bulk resolve
router.post('/bulk-resolve', async (req, res) => {
    try {
        const { ids, resolvedBy } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'No problem IDs provided' });
        }

        await Problem.update({
            status: 'Resolved',
            resolvedAt: new Date(),
            resolvedBy: resolvedBy || 'System'
        }, {
            where: { id: ids }
        });

        res.json({ success: true, message: `${ids.length} problems marked as resolved.` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST bulk delete
router.post('/bulk-delete', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'No problem IDs provided' });
        }

        await Problem.destroy({
            where: { id: ids }
        });

        res.json({ success: true, message: `${ids.length} problems deleted successfully.` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;