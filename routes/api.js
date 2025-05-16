const express = require('express');
const router = express.Router();
const Story = require('../models/Story');
const User = require('../models/User');
const { isAuthenticated, isAuthor, isStoryOwner } = require('../middleware/auth');

// Get story statistics
router.get('/stories/:storyId/stats', async (req, res) => {
    try {
        const story = await Story.findById(req.params.storyId);
        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }
        res.json(story.getStats());
    } catch (error) {
        res.status(500).json({ error: 'Failed to get story statistics' });
    }
});

// Validate story structure
router.get('/stories/:storyId/validate', async (req, res) => {
    try {
        const story = await Story.findById(req.params.storyId);
        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }
        res.json(story.validateStructure());
    } catch (error) {
        res.status(500).json({ error: 'Failed to validate story structure' });
    }
});

// Get user statistics
router.get('/users/:userId/stats', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user.stats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get user statistics' });
    }
});

// Search stories
router.get('/search', async (req, res) => {
    try {
        const { q: query, genre, sort = 'relevance', page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        let searchQuery = { 'metadata.isPublic': true };
        
        if (query) {
            searchQuery.$or = [
                { title: new RegExp(query, 'i') },
                { description: new RegExp(query, 'i') }
            ];
        }

        if (genre) {
            searchQuery.genre = genre;
        }

        const stories = await Story.find(searchQuery)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('author', 'username profile.displayName profile.avatar');

        const total = await Story.countDocuments(searchQuery);

        res.json({
            stories,
            total,
            pages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        });
    } catch (error) {
        res.status(500).json({ error: 'Search failed' });
    }
});

// Get trending stories
router.get('/trending', async (req, res) => {
    try {
        const stories = await Story.find({
            'metadata.isPublic': true,
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        })
            .sort({ 'metadata.views': -1, 'metadata.likes': -1 })
            .limit(10)
            .populate('author', 'username profile.displayName profile.avatar');

        res.json({ stories });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get trending stories' });
    }
});

module.exports = router; 