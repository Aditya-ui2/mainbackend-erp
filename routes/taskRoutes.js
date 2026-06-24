const express = require('express')
const router = express.Router()
const controller = require('../controllers/task')
const verifyToken = require('../middleware/authMiddleware')

router.get('/', verifyToken, controller.getAllTasks || (async (req,res)=>{res.status(501).json({message:'Not implemented'})}))
router.post('/', verifyToken, controller.createTaskByTL)
router.put('/:id', verifyToken, controller.updateTaskStatus)
router.delete('/:id', verifyToken, controller.deleteTask)

module.exports = router
