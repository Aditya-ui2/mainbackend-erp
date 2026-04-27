const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/clientMeeting');

router.get('/all', meetingController.getAllMeetings);
router.post('/create', meetingController.createMeeting);
router.post('/seed', meetingController.seedMeetings);
router.put('/update-status', meetingController.updateMeetingStatus);
router.delete('/delete', meetingController.deleteMeeting);

module.exports = router;
