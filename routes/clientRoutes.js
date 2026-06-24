const express = require('express')
const router = express.Router()
const controller = require('../controllers/client')
const reviewController = require('../controllers/clientReview')
const verifyToken = require('../middleware/authMiddleware')

router.get('/', verifyToken, controller.getAllClients)
router.get('/:id', verifyToken, controller.getClientDetails)
router.post('/', verifyToken, controller.signupClient)
router.put('/:id', verifyToken, controller.editClient)
router.delete('/:id', verifyToken, controller.deleteClient)

// Reviews
router.post('/review', verifyToken, reviewController.createClientReview)
router.get('/:id/reviews', verifyToken, reviewController.getClientReviews)

module.exports = router
