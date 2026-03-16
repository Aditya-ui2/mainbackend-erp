const { Notification } = require('../models/sequelizeModels');

// Add notification
exports.addNotification = async (userId, userType, message, type = 'message', priority = 'low') => {
    try {
        const notification = await Notification.create({
            userId,
            userType,
            message,
            type,
            priority,
            status: 'unread',
            readAt: null
        });

        return notification;
    } catch (error) {
        console.error('Error adding notification:', error);
        throw error;
    }
};

// Get all notifications for a user
exports.getAllNotifications = async (req, res) => {
    try {
        const { userId } = req.body;

        const notifications = await Notification.findAll({
            where: { userId },
            order: [['createdAt', 'DESC']]
        });
        
        res.status(200).json({
            success: true,
            count: notifications.length,
            data: notifications
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Mark single notification as read
exports.markRead = async (req, res) => {
    try {
        const { notificationId } = req.body;

        const notification = await Notification.findByPk(notificationId);

        if (!notification) {
            return res.status(404).json({
                success: false,
                error: 'Notification not found'
            });
        }

        notification.status = 'read';
        notification.readAt = new Date();
        await notification.save();

        res.status(200).json({
            success: true,
            data: notification
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Mark single notification as unread
exports.markUnread = async (req, res) => {
    try {
        const { notificationId } = req.body;

        const notification = await Notification.findByPk(notificationId);

        if (!notification) {
            return res.status(404).json({
                success: false,
                error: 'Notification not found'
            });
        }

        notification.status = 'unread';
        notification.readAt = null;
        await notification.save();

        res.status(200).json({
            success: true,
            data: notification
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Mark all notifications as read for a user
exports.markAllRead = async (req, res) => {
    try {
        const { userId } = req.body;

        const [updatedCount] = await Notification.update(
            {
                status: 'read',
                readAt: new Date()
            },
            {
                where: {
                    userId,
                    status: 'unread'
                }
            }
        );

        res.status(200).json({
            success: true,
            message: `${updatedCount} notifications marked as read`
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Delete individual notification
exports.deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.body;

        const notification = await Notification.findByPk(notificationId);

        if (!notification) {
            return res.status(404).json({
                success: false,
                error: 'Notification not found'
            });
        }

        await notification.destroy();

        res.status(200).json({
            success: true,
            message: 'Notification deleted successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Delete all notifications for a user
exports.deleteAllNotifications = async (req, res) => {
    try {
        const { userId } = req.body;

        const deletedCount = await Notification.destroy({
            where: { userId }
        });

        res.status(200).json({
            success: true,
            message: `${deletedCount} notifications deleted successfully`
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};
