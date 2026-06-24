const express = require('express')
const router = express.Router()
const controller = require('../controllers/interview')
const verifyToken = require('../middleware/authMiddleware')

router.get('/', verifyToken, controller.getAllInterviews || controller.getInterviews)
router.post('/', verifyToken, controller.scheduleInterview || controller.createInterview)
router.put('/:id', verifyToken, controller.updateInterviewStatus)
router.delete('/:id', verifyToken, controller.cancelInterview)

module.exports = router
