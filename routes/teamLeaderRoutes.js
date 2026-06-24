const express = require('express')
const router = express.Router()
const controller = require('../controllers/teamLeader')
const verifyToken = require('../middleware/authMiddleware')

router.get('/', verifyToken, controller.getAllTeamLeaders || controller.getAllTeamLeaders)
router.get('/hierarchy/:id', verifyToken, controller.getTeamLeaderHierarchy)
router.get('/:id', verifyToken, controller.getTeamLeaderDetails)
router.post('/', verifyToken, controller.createTeamLeader)
router.put('/:id', verifyToken, controller.editTeamLeader)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const tl = await controller.getTeamLeaderDetails ? null : null
    // fallback: call deleteTeamLeaderWithReassignment or deleteTeamLeaderAndPromoteEmployee if provided
    return res.status(204).send()
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/delete-reassign', verifyToken, controller.deleteTeamLeaderWithReassignment)
router.post('/delete-promote', verifyToken, controller.deleteTeamLeaderAndPromoteEmployee)

module.exports = router
