const { WorkHandover, TeamLeader, Client, Task, Op } = (() => {
    const m = require('../models/sequelizeModels');
    return { ...m, Op: require('sequelize').Op };
})();

// Create a new work handover
const createHandover = async (req, res) => {
    try {
        const { fromUserId, toUserId, reason, startDate, endDate, clientIds, notes } = req.body;

        if (!fromUserId || !toUserId || !reason || !startDate || !endDate || !clientIds?.length) {
            return res.status(400).json({ success: false, message: 'fromUserId, toUserId, reason, startDate, endDate, and at least one clientId are required' });
        }

        if (fromUserId === toUserId) {
            return res.status(400).json({ success: false, message: 'Cannot hand over to yourself' });
        }

        // Verify both users exist
        const [fromUser, toUser] = await Promise.all([
            TeamLeader.findByPk(fromUserId),
            TeamLeader.findByPk(toUserId)
        ]);
        if (!fromUser) return res.status(404).json({ success: false, message: 'Source KAM not found' });
        if (!toUser) return res.status(404).json({ success: false, message: 'Target KAM not found' });

        const handover = await WorkHandover.create({
            fromUserId,
            toUserId,
            reason,
            startDate,
            endDate,
            clientIds,
            notes: notes || null,
            createdBy: req.user?.id || fromUserId,
            status: 'Active'
        });

        res.status(201).json({ success: true, data: handover });
    } catch (error) {
        console.error('Error creating handover:', error);
        res.status(500).json({ success: false, message: 'Failed to create handover' });
    }
};

// Get all handovers (with optional filters)
const getHandovers = async (req, res) => {
    try {
        const { status, userId } = req.query;
        const where = {};

        if (status) where.status = status;
        if (userId) {
            where[Op.or] = [
                { fromUserId: userId },
                { toUserId: userId }
            ];
        }

        const handovers = await WorkHandover.findAll({
            where,
            include: [
                { model: TeamLeader, as: 'fromUser', attributes: ['id', 'name', 'email'] },
                { model: TeamLeader, as: 'toUser', attributes: ['id', 'name', 'email'] }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Enrich with client names
        const allClientIds = [...new Set(handovers.flatMap(h => h.clientIds || []))];
        const clients = await Client.findAll({
            where: { id: allClientIds },
            attributes: ['id', 'name', 'companyName']
        });
        const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));

        const enriched = handovers.map(h => {
            const plain = h.toJSON();
            plain.clients = (plain.clientIds || []).map(id => clientMap[id] || { id, name: 'Unknown' });
            return plain;
        });

        res.json({ success: true, data: enriched });
    } catch (error) {
        console.error('Error fetching handovers:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch handovers' });
    }
};

// Update a handover
const updateHandover = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const handover = await WorkHandover.findByPk(id);
        if (!handover) return res.status(404).json({ success: false, message: 'Handover not found' });

        await handover.update(updates);
        res.json({ success: true, data: handover });
    } catch (error) {
        console.error('Error updating handover:', error);
        res.status(500).json({ success: false, message: 'Failed to update handover' });
    }
};

// Cancel / complete a handover
const changeHandoverStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['Active', 'Completed', 'Cancelled'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const handover = await WorkHandover.findByPk(id);
        if (!handover) return res.status(404).json({ success: false, message: 'Handover not found' });

        await handover.update({ status });
        res.json({ success: true, data: handover });
    } catch (error) {
        console.error('Error changing handover status:', error);
        res.status(500).json({ success: false, message: 'Failed to change status' });
    }
};

// Delete a handover
const deleteHandover = async (req, res) => {
    try {
        const { id } = req.params;
        const handover = await WorkHandover.findByPk(id);
        if (!handover) return res.status(404).json({ success: false, message: 'Handover not found' });

        await handover.destroy();
        res.json({ success: true, message: 'Handover deleted' });
    } catch (error) {
        console.error('Error deleting handover:', error);
        res.status(500).json({ success: false, message: 'Failed to delete handover' });
    }
};

// Get active handover for a client (used to check if work is handed over)
const getActiveHandoverForClient = async (req, res) => {
    try {
        const { clientId } = req.params;
        const today = new Date().toISOString().split('T')[0];

        const handovers = await WorkHandover.findAll({
            where: {
                status: 'Active',
                startDate: { [Op.lte]: today },
                endDate: { [Op.gte]: today }
            },
            include: [
                { model: TeamLeader, as: 'fromUser', attributes: ['id', 'name', 'email'] },
                { model: TeamLeader, as: 'toUser', attributes: ['id', 'name', 'email'] }
            ]
        });

        // Filter handovers that include this client
        const relevant = handovers.filter(h => (h.clientIds || []).includes(clientId));

        res.json({ success: true, data: relevant });
    } catch (error) {
        console.error('Error fetching handover for client:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch handover' });
    }
};

module.exports = {
    createHandover,
    getHandovers,
    updateHandover,
    changeHandoverStatus,
    deleteHandover,
    getActiveHandoverForClient
};
