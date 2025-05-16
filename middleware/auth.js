const User = require('../models/User');
const Story = require('../models/Story');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    res.status(401).json({ error: 'Authentication required' });
};

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const user = await User.findById(req.session.userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        next();
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Middleware to check if user is author
const isAuthor = async (req, res, next) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const user = await User.findById(req.session.userId);
        if (!user || (user.role !== 'author' && user.role !== 'admin')) {
            return res.status(403).json({ error: 'Author access required' });
        }

        next();
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Middleware to attach user to request
const attachUser = async (req, res, next) => {
    try {
        if (req.session && req.session.userId) {
            const user = await User.findById(req.session.userId);
            if (user) {
                req.user = user.getPublicProfile();
            }
        }
        next();
    } catch (error) {
        next(error);
    }
};

// Middleware to check story ownership
const isStoryOwner = async (req, res, next) => {
    try {
        const story = await Story.findById(req.params.storyId);
        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }

        if (story.author.toString() !== req.session.userId) {
            return res.status(403).json({ error: 'Not authorized to modify this story' });
        }

        req.story = story;
        next();
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Middleware to check if story is public
const isPublicStory = async (req, res, next) => {
    try {
        const story = await Story.findById(req.params.storyId);
        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }

        if (!story.metadata.isPublic && 
            (!req.session.userId || story.author.toString() !== req.session.userId)) {
            return res.status(403).json({ error: 'This story is private' });
        }

        req.story = story;
        next();
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    isAuthenticated,
    isAdmin,
    isAuthor,
    attachUser,
    isStoryOwner,
    isPublicStory
}; 