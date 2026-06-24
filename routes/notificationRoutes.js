const express = require('express')
const router = express.Router()
const controller = require('../controllers/notification')
const verifyToken = require('../middleware/authMiddleware')

router.get('/:userId', verifyToken, controller.getAllNotifications)
router.put('/:id/read', verifyToken, async (req, res) => {
  try {
    req.body.notificationId = req.params.id
    await controller.markRead(req, res)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    req.body.notificationId = req.params.id
    await controller.deleteNotification(req, res)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
