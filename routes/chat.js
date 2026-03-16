const express = require('express');
const router = express.Router();
const { Message } = require('../models/sequelizeModels');
const { Op } = require('sequelize');

// Get chat history between two users
router.get('/messages/:userId1/:userId2', async (req, res) => {
    try {
        const messages = await Message.findAll({
            where: {
                [Op.or]: [
                    { senderId: req.params.userId1, receiverId: req.params.userId2 },
                    { senderId: req.params.userId2, receiverId: req.params.userId1 }
                ]
            },
            order: [['createdAt', 'ASC']]
        });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching messages' });
    }
});

// Mark messages as read
router.put('/messages/read', async (req, res) => {
    try {
        const { senderId, receiverId } = req.body;
        await Message.update(
            { read: true },
            { 
                where: { 
                    senderId: senderId, 
                    receiverId: receiverId, 
                    read: false 
                }
            }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error marking messages as read' });
    }
});

// Get unread message count
router.get('/messages/unread/:userId', async (req, res) => {
    try {
        const count = await Message.count({
            where: {
                receiverId: req.params.userId,
                read: false
            }
        });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ error: 'Error getting unread count' });
    }
});

module.exports = router;