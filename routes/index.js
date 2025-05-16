const express = require('express');
const router = express.Router();
const Story = require('../models/Story');
const { attachUser } = require('../middleware/auth');

// Home page
router.get('/', async (req, res) => {
    try {
        // Get featured stories
        const featuredStories = await Story.find({ 'metadata.isPublic': true })
            .sort({ 'metadata.views': -1, 'metadata.likes': -1 })
            .limit(6)
            .populate('author', 'username profile.displayName profile.avatar');

        // Get latest stories
        const latestStories = await Story.find({ 'metadata.isPublic': true })
            .sort({ createdAt: -1 })
            .limit(6)
            .populate('author', 'username profile.displayName profile.avatar');

        // Get trending stories (based on views and likes in the last 7 days)
        const trendingStories = await Story.find({
            'metadata.isPublic': true,
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        })
            .sort({ 'metadata.views': -1, 'metadata.likes': -1 })
            .limit(6)
            .populate('author', 'username profile.displayName profile.avatar');

        res.render('index', {
            title: 'Welcome to CreateStory',
            featuredStories,
            latestStories,
            trendingStories,
            genres: Story.schema.path('genre').enumValues
        });
    } catch (error) {
        console.error('Home page error:', error);
        res.render('index', {
            title: 'CreateStory - Error',
            error: 'Failed to load stories'
        });
    }
});

// About page
router.get('/about', async (req, res) => {
    res.render('about', {
        title: 'About CreateStory'
    });
});

// Features page
router.get('/features', async (req, res) => {
    res.render('features', {
        title: 'Features'
    });
});

// Contact page
router.get('/contact', async (req, res) => {
    res.render('contact', {
        title: 'Contact Us'
    });
});

// Terms of service
router.get('/terms', async (req, res) => {
    res.render('terms', {
        title: 'Terms of Service'
    });
});

// Privacy policy
router.get('/privacy', async (req, res) => {
    res.render('privacy', {
        title: 'Privacy Policy'
    });
});

// Example of a protected route
router.get('/dashboard', async (req, res) => {
    res.render('dashboard', {
        title: 'My Dashboard',
    });
});

// Search page
router.get('/search', async (req, res) => {
    try {
        const { q: query, genre, sort = 'relevance', page = 1 } = req.query;
        const limit = 12;
        const skip = (page - 1) * limit;

        let searchQuery = { 'metadata.isPublic': true };
        
        if (query) {
            searchQuery.$or = [
                { title: new RegExp(query, 'i') },
                { description: new RegExp(query, 'i') },
                { 'segments.content': new RegExp(query, 'i') }
            ];
        }

        if (genre) {
            searchQuery.genre = genre;
        }

        let sortQuery = {};
        switch (sort) {
            case 'newest':
                sortQuery = { createdAt: -1 };
                break;
            case 'popular':
                sortQuery = { 'metadata.views': -1 };
                break;
            case 'trending':
                sortQuery = { 'metadata.likes': -1 };
                break;
            default: // relevance
                sortQuery = { score: { $meta: 'textScore' } };
        }

        const stories = await Story.find(searchQuery, { score: { $meta: 'textScore' } })
            .sort(sortQuery)
            .skip(skip)
            .limit(limit)
            .populate('author', 'username profile.displayName profile.avatar');

        const total = await Story.countDocuments(searchQuery);

        res.render('search', {
            title: 'Search Stories',
            stories,
            query,
            genre,
            sort,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            genres: Story.schema.path('genre').enumValues
        });
    } catch (error) {
        console.error('Search error:', error);
        res.render('search', {
            title: 'Search Stories',
            error: 'Search failed',
            genres: Story.schema.path('genre').enumValues
        });
    }
});

// Genre browse page
router.get('/genre/:genre', async (req, res) => {
    try {
        const { genre } = req.params;
        const { sort = 'popular', page = 1 } = req.query;
        const limit = 12;
        const skip = (page - 1) * limit;

        let sortQuery = {};
        switch (sort) {
            case 'newest':
                sortQuery = { createdAt: -1 };
                break;
            case 'popular':
                sortQuery = { 'metadata.views': -1 };
                break;
            case 'trending':
                sortQuery = { 'metadata.likes': -1 };
                break;
            default:
                sortQuery = { 'metadata.views': -1 };
        }

        const stories = await Story.find({
            genre,
            'metadata.isPublic': true
        })
            .sort(sortQuery)
            .skip(skip)
            .limit(limit)
            .populate('author', 'username profile.displayName profile.avatar');

        const total = await Story.countDocuments({
            genre,
            'metadata.isPublic': true
        });

        res.render('genre', {
            title: `${genre} Stories`,
            genre,
            stories,
            sort,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            genres: Story.schema.path('genre').enumValues
        });
    } catch (error) {
        console.error('Genre browse error:', error);
        res.render('genre', {
            title: 'Browse Stories',
            error: 'Failed to load stories',
            genres: Story.schema.path('genre').enumValues
        });
    }
});

// Test route for CSS
router.get('/test-css', (req, res) => {
    res.render('test-css', {
        title: 'CSS Test',
        user: req.user
    });
});

module.exports = router; 