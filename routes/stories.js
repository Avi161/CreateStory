const express = require('express');
const router = express.Router();
const Story = require('../models/Story');
const { isAuthenticated, isAuthor, isStoryOwner, isPublicStory, attachUser } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const dir = path.join(__dirname, '../public/uploads', req.session.userId);
        await fs.mkdir(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'audio/mpeg', 'audio/wav'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// Show create story form
router.get('/create', isAuthenticated, (req, res) => {
    res.render('create-story', {
        title: 'Create a New Story',
        genres: Story.schema.path('genre').enumValues
    });
});

// Handle story creation
router.post('/create', isAuthenticated, async (req, res) => {
    try {
        const { title, description, genre, content, isPublic } = req.body;
        
        // Generate ID and title for the first segment
        const firstSegmentId = crypto.randomUUID();
        const firstSegmentTitle = title; // Use story title as first segment's title for now

        const newStory = new Story({
            title,
            description,
            genre,
            segments: [{
                segmentId: firstSegmentId,
                title: firstSegmentTitle,
                content
            }],
            author: req.user.id, // Use req.user.id
            'metadata.startSegmentId': firstSegmentId,
            'metadata.isPublic': isPublic === 'on'
        });
        
        await newStory.save();
        req.flash('success', 'Story created successfully!');
        res.redirect(`/stories/${newStory._id}`);
    } catch (error) {
        console.error('Error creating story:', error);
        let errorMessage = 'Failed to create story. Please check your input.';
        if (error.errors) {
            errorMessage += ' ' + Object.values(error.errors).map(e => e.message).join(', ');
        }
        req.flash('error', errorMessage);
        res.redirect('/stories/create');
    }
});

// Get all stories (public or user-owned)
router.get('/', async (req, res) => {
    try {
        const query = {};
        if (!req.user || req.user.role !== 'admin') {
            query['$or'] = [
                { 'metadata.isPublic': true },
                { author: req.user ? req.user.id : null }
            ];
        }
        const stories = await Story.find(query)
            .populate('author', 'username profile.displayName')
            .sort({ 'metadata.updatedAt': -1 });
        res.render('stories', {
            title: 'Explore Stories',
            stories
        });
    } catch (error) {
        console.error('Error loading stories:', error);
        res.status(500).render('error', { 
            title: 'Error', 
            message: 'Failed to load stories' 
        });
    }
});

// Get user's stories
router.get('/my-stories', isAuthenticated, async (req, res) => {
    try {
        const stories = await Story.find({ author: req.session.userId })
            .sort({ updatedAt: -1 });
        res.render('stories/my-stories', {
            title: 'My Stories',
            stories: stories,
            layout: 'partials/layout'
        });
    } catch (error) {
        console.error("Error fetching user's stories:", error);
        req.flash('error', 'Failed to fetch your stories. Please try again.');
        res.redirect('/');
    }
});

// Get single story
router.get('/:storyId', async (req, res) => {
    try {
        const story = await Story.findById(req.params.storyId)
            .populate('author', 'username profile.displayName profile.avatar');
        
        if (!story) {
            return res.status(404).render('404', { title: 'Story Not Found' });
        }

        if (!story.metadata.isPublic && (!req.user || story.author._id.toString() !== req.user.id)) {
             return res.status(403).render('error', { title: 'Access Denied', message: 'This story is private.'});
        }

        res.render('story', {
            title: story.title,
            story
        });
    } catch (error) {
        console.error('Error loading story:', error);
        res.status(500).render('error', { title: 'Error', message: 'Failed to load story', error });
    }
});

// Show edit story form
router.get('/:storyId/edit', isAuthenticated, isStoryOwner, async (req, res) => {
    res.render('edit-story', {
        title: 'Edit Story: ' + req.story.title,
        story: req.story,
        genres: Story.schema.path('genre').enumValues
    });
});

// Handle story update
router.post('/:storyId/edit', isAuthenticated, isStoryOwner, async (req, res) => {
    try {
        const { title, description, genre, content, isPublic } = req.body;
        const story = req.story; // Populated by isStoryOwner middleware

        story.title = title;
        story.description = description;
        story.genre = genre;
        
        // Update the content of the first/start segment
        // This is still a simplification. A full segment editor would be more complex.
        if (content !== undefined) { // Ensure content field was submitted
            let startSegment;
            if (story.metadata.startSegmentId) {
                startSegment = story.segments.find(s => s.segmentId === story.metadata.startSegmentId);
            }

            if (startSegment) {
                startSegment.content = content;
                // If you add a title field for the start segment in edit-story.ejs, update it here:
                // startSegment.title = newSegmentTitle; 
            } else if (story.segments && story.segments.length > 0) {
                // Fallback: if startSegmentId is invalid or missing, update the first segment in the array
                story.segments[0].content = content;
                // story.segments[0].title = newSegmentTitle; 
            } else {
                // If no segments exist at all, create a new one as the start segment
                const newSegmentId = crypto.randomUUID();
                story.segments = [{
                    segmentId: newSegmentId,
                    title: title, // Default to story title
                    content: content
                }];
                story.metadata.startSegmentId = newSegmentId;
            }
        }

        story.metadata.isPublic = (isPublic === 'on');
        // story.metadata.updatedAt = Date.now(); // Schema pre-save hook handles this automatically

        await story.save();
        req.flash('success', 'Story updated successfully!');
        res.redirect(`/stories/${story._id}`); // Redirect to the single story view page

    } catch (error) {
        console.error('Error updating story:', error);
        let errorMessage = 'Failed to update story. ';
        if (error.errors) {
            errorMessage += Object.values(error.errors).map(e => e.message).join(', ');
        } else {
            errorMessage += 'Please check your input and try again.';
        }
        req.flash('error', errorMessage);
        res.redirect(`/stories/${req.params.storyId}/edit`); // Redirect back to the edit page
    }
});

// Handle story deletion
router.post('/:storyId/delete', isAuthenticated, isStoryOwner, async (req, res) => {
    try {
        await Story.findByIdAndDelete(req.params.storyId);
        res.redirect('/stories');
    } catch (error) {
        console.error('Error deleting story:', error);
        res.status(500).render('error', { 
            title: 'Error', 
            message: 'Failed to delete story.', 
            error 
        });
    }
});

// Add story segment
router.post('/:storyId/segments', isAuthenticated, isStoryOwner, async (req, res) => {
    try {
        const { segmentId, title, content, choices, backgroundImage, backgroundMusic, tags } = req.body;
        const story = await Story.findById(req.params.storyId);

        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }

        // Validate segment ID uniqueness
        if (story.segments.some(s => s.segmentId === segmentId)) {
            return res.status(400).json({ error: 'Segment ID already exists' });
        }

        const segment = {
            segmentId,
            title,
            content,
            choices: choices || [],
            backgroundImage,
            backgroundMusic,
            tags: tags || []
        };

        story.segments.push(segment);
        await story.save();

        res.status(201).json({ segment });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add segment' });
    }
});

// Update story segment
router.put('/:storyId/segments/:segmentId', isAuthenticated, isStoryOwner, async (req, res) => {
    try {
        const { title, content, choices, backgroundImage, backgroundMusic, tags } = req.body;
        const story = await Story.findById(req.params.storyId);

        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }

        const segment = story.segments.find(s => s.segmentId === req.params.segmentId);
        if (!segment) {
            return res.status(404).json({ error: 'Segment not found' });
        }

        // Update fields
        if (title) segment.title = title;
        if (content) segment.content = content;
        if (choices) segment.choices = choices;
        if (backgroundImage) segment.backgroundImage = backgroundImage;
        if (backgroundMusic) segment.backgroundMusic = backgroundMusic;
        if (tags) segment.tags = tags;

        await story.save();
        res.json({ segment });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update segment' });
    }
});

// Delete story segment
router.delete('/:storyId/segments/:segmentId', isAuthenticated, isStoryOwner, async (req, res) => {
    try {
        const story = await Story.findById(req.params.storyId);
        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }

        // Remove segment
        story.segments = story.segments.filter(s => s.segmentId !== req.params.segmentId);

        // Update references to this segment
        story.segments.forEach(segment => {
            segment.choices = segment.choices.filter(choice => 
                choice.nextSegmentId !== req.params.segmentId
            );
        });

        // Update start segment if needed
        if (story.metadata.startSegmentId === req.params.segmentId) {
            story.metadata.startSegmentId = story.segments[0]?.segmentId;
        }

        await story.save();
        res.json({ message: 'Segment deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete segment' });
    }
});

// Upload story media
router.post('/:storyId/upload', isAuthenticated, isStoryOwner, upload.single('media'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileUrl = `/uploads/${req.session.userId}/${req.file.filename}`;
        res.json({ url: fileUrl });
    } catch (error) {
        res.status(500).json({ error: 'File upload failed' });
    }
});

// Export story
router.get('/:storyId/export', isPublicStory, async (req, res) => {
    try {
        const { format = 'json' } = req.query;
        const story = await Story.findById(req.params.storyId);

        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }

        switch (format) {
            case 'json':
                res.json({ story });
                break;
            case 'pdf':
                // Implement PDF export using PDFKit
                // This is a placeholder for PDF export functionality
                res.status(501).json({ error: 'PDF export not implemented yet' });
                break;
            default:
                res.status(400).json({ error: 'Unsupported export format' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Export failed' });
    }
});

module.exports = router; 