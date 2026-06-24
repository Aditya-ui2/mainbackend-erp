const { ClientReview, Client } = require('../models/sequelizeModels');

// Get all reviews for a client
const getClientReviews = async (req, res) => {
    try {
        const { clientId } = req.params;

        if (!clientId) {
            return res.status(400).json({ success: false, message: 'Client ID is required' });
        }

        const reviews = await ClientReview.findAll({
            where: { clientId },
            order: [['createdAt', 'DESC']]
        });

        return res.status(200).json({
            success: true,
            data: reviews,
            message: 'Reviews fetched successfully'
        });
    } catch (error) {
        console.error('Error fetching client reviews:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch reviews',
            error: error.message
        });
    }
};

// Create a new client review
const createClientReview = async (req, res) => {
    try {
        let { 
            clientId, 
            rating, 
            feedback, 
            actionRequired, 
            nextReviewDate, 
            reviewDate, 
            reviewMonth,
            overallSatisfaction,
            spocCommunication,
            candidateProfileQuality,
            sourcingSpeed,
            payrollAccuracy,
            complianceManagement,
            reviewType,
            highlights,
            actionItems
        } = req.body;

        // Validate required fields
        if (!clientId || !rating) {
            return res.status(400).json({
                success: false,
                message: 'Client ID and rating are required'
            });
        }

        // Validate rating range
        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }

        // Check if client exists
        const client = await Client.findByPk(clientId);
        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'Client not found'
            });
        }

        // Use provided reviewMonth or determine default YYYY-MM
        if (!reviewMonth) {
            const currentDate = new Date();
            reviewMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        }

        // Check if review for this month/period already exists
        const existingReview = await ClientReview.findOne({
            where: { clientId, reviewMonth }
        });
        
        if (existingReview) {
            // Update existing review for this month/period
            existingReview.rating = rating;
            existingReview.feedback = feedback !== undefined ? feedback : existingReview.feedback;
            existingReview.actionRequired = actionRequired !== undefined ? actionRequired : existingReview.actionRequired;
            if (nextReviewDate !== undefined) {
                existingReview.nextReviewDate = nextReviewDate;
            }
            if (reviewDate !== undefined) {
                existingReview.reviewDate = reviewDate;
            }
            if (overallSatisfaction !== undefined) existingReview.overallSatisfaction = overallSatisfaction;
            if (spocCommunication !== undefined) existingReview.spocCommunication = spocCommunication;
            if (candidateProfileQuality !== undefined) existingReview.candidateProfileQuality = candidateProfileQuality;
            if (sourcingSpeed !== undefined) existingReview.sourcingSpeed = sourcingSpeed;
            if (payrollAccuracy !== undefined) existingReview.payrollAccuracy = payrollAccuracy;
            if (complianceManagement !== undefined) existingReview.complianceManagement = complianceManagement;
            if (reviewType !== undefined) existingReview.reviewType = reviewType;
            if (highlights !== undefined) existingReview.highlights = highlights;
            if (actionItems !== undefined) existingReview.actionItems = actionItems;

            await existingReview.save();
            
            return res.status(200).json({
                success: true,
                data: existingReview,
                message: 'Review updated successfully'
            });
        }

        // Create new review
        const newReview = await ClientReview.create({
            clientId,
            rating,
            feedback: feedback || '',
            actionRequired: actionRequired || false,
            nextReviewDate: nextReviewDate || '',
            reviewMonth,
            date: new Date().toLocaleDateString(),
            reviewDate: reviewDate || new Date().toISOString().split('T')[0],
            createdBy: req.user ? req.user.id : null,
            overallSatisfaction: overallSatisfaction !== undefined ? overallSatisfaction : 5,
            spocCommunication: spocCommunication !== undefined ? spocCommunication : 5,
            candidateProfileQuality: candidateProfileQuality !== undefined ? candidateProfileQuality : 5,
            sourcingSpeed: sourcingSpeed !== undefined ? sourcingSpeed : 5,
            payrollAccuracy: payrollAccuracy !== undefined ? payrollAccuracy : 5,
            complianceManagement: complianceManagement !== undefined ? complianceManagement : 5,
            reviewType: reviewType || 'monthly',
            highlights: highlights || '',
            actionItems: actionItems || ''
        });

        return res.status(201).json({
            success: true,
            data: newReview,
            message: 'Review created successfully'
        });
    } catch (error) {
        console.error('Error creating client review:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create review',
            error: error.message
        });
    }
};

// Update a client review
const updateClientReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { 
            rating, 
            feedback, 
            actionRequired, 
            nextReviewDate, 
            reviewDate,
            overallSatisfaction,
            spocCommunication,
            candidateProfileQuality,
            sourcingSpeed,
            payrollAccuracy,
            complianceManagement,
            reviewType,
            highlights,
            actionItems
        } = req.body;

        if (!reviewId) {
            return res.status(400).json({
                success: false,
                message: 'Review ID is required'
            });
        }

        const review = await ClientReview.findByPk(reviewId);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        if (rating !== undefined) review.rating = rating;
        if (feedback !== undefined) review.feedback = feedback;
        if (actionRequired !== undefined) review.actionRequired = actionRequired;
        if (nextReviewDate !== undefined) review.nextReviewDate = nextReviewDate;
        if (reviewDate !== undefined) review.reviewDate = reviewDate;
        if (overallSatisfaction !== undefined) review.overallSatisfaction = overallSatisfaction;
        if (spocCommunication !== undefined) review.spocCommunication = spocCommunication;
        if (candidateProfileQuality !== undefined) review.candidateProfileQuality = candidateProfileQuality;
        if (sourcingSpeed !== undefined) review.sourcingSpeed = sourcingSpeed;
        if (payrollAccuracy !== undefined) review.payrollAccuracy = payrollAccuracy;
        if (complianceManagement !== undefined) review.complianceManagement = complianceManagement;
        if (reviewType !== undefined) review.reviewType = reviewType;
        if (highlights !== undefined) review.highlights = highlights;
        if (actionItems !== undefined) review.actionItems = actionItems;

        await review.save();

        return res.status(200).json({
            success: true,
            data: review,
            message: 'Review updated successfully'
        });
    } catch (error) {
        console.error('Error updating client review:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update review',
            error: error.message
        });
    }
};

// Delete a client review
const deleteClientReview = async (req, res) => {
    try {
        const { reviewId } = req.params;

        if (!reviewId) {
            return res.status(400).json({
                success: false,
                message: 'Review ID is required'
            });
        }

        const review = await ClientReview.findByPk(reviewId);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        await review.destroy();

        return res.status(200).json({
            success: true,
            data: review,
            message: 'Review deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting client review:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete review',
            error: error.message
        });
    }
};

// Get review statistics for a client
const getClientReviewStats = async (req, res) => {
    try {
        const { clientId } = req.params;

        if (!clientId) {
            return res.status(400).json({
                success: false,
                message: 'Client ID is required'
            });
        }

        const reviews = await ClientReview.findAll({
            where: { clientId },
            order: [['createdAt', 'DESC']]
        });

        if (reviews.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    totalReviews: 0,
                    averageRating: 'N/A',
                    lastReviewDate: null
                },
                message: 'No reviews found for this client'
            });
        }

        const averageRating = (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1);
        const lastReviewDate = reviews[0]?.createdAt;

        return res.status(200).json({
            success: true,
            data: {
                totalReviews: reviews.length,
                averageRating,
                lastReviewDate,
                reviews
            },
            message: 'Review statistics fetched successfully'
        });
    } catch (error) {
        console.error('Error fetching review stats:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch review statistics',
            error: error.message
        });
    }
};

module.exports = {
    getClientReviews,
    createClientReview,
    updateClientReview,
    deleteClientReview,
    getClientReviewStats
};
