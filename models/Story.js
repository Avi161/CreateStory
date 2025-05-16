const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ChoiceSchema = new Schema({
    text: {
        type: String,
        required: true,
        trim: true
    },
    nextSegmentId: {
        type: String,
        required: true
    },
    conditions: {
        type: Map,
        of: Schema.Types.Mixed,
        default: new Map()
    },
    effects: {
        type: Map,
        of: Schema.Types.Mixed,
        default: new Map()
    }
});

const CharacterSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    image: {
        type: String
    },
    attributes: {
        type: Map,
        of: Number,
        default: new Map()
    },
    relationships: [{
        characterId: String,
        type: String,
        value: Number
    }]
});

const SegmentSchema = new Schema({
    segmentId: {
        type: String,
        required: true,
        unique: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        required: true
    },
    backgroundImage: {
        type: String
    },
    backgroundMusic: {
        type: String
    },
    choices: [ChoiceSchema],
    characters: [{
        type: Schema.Types.ObjectId,
        ref: 'Character'
    }],
    tags: [{
        type: String,
        trim: true
    }],
    conditions: {
        type: Map,
        of: Schema.Types.Mixed,
        default: new Map()
    },
    effects: {
        type: Map,
        of: Schema.Types.Mixed,
        default: new Map()
    },
    position: {
        x: Number,
        y: Number
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const StorySchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    genre: {
        type: String,
        required: true,
        enum: ['Fantasy', 'Sci-Fi', 'Mystery', 'Horror', 'Romance', 'Adventure', 'Historical', 'Contemporary', 'Other']
    },
    coverImage: {
        type: String
    },
    segments: [SegmentSchema],
    characters: [CharacterSchema],
    settings: {
        theme: {
            type: String,
            default: 'default'
        },
        music: {
            type: String
        },
        customStyles: {
            type: Map,
            of: String,
            default: new Map()
        }
    },
    metadata: {
        startSegmentId: {
            type: String,
            required: true
        },
        version: {
            type: Number,
            default: 1
        },
        isPublic: {
            type: Boolean,
            default: false
        },
        tags: [{
            type: String,
            trim: true
        }],
        likes: {
            type: Number,
            default: 0
        },
        views: {
            type: Number,
            default: 0
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Middleware to update the updatedAt timestamp
StorySchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Virtual for story URL
StorySchema.virtual('url').get(function() {
    return `/stories/${this._id}`;
});

// Method to get story statistics
StorySchema.methods.getStats = function() {
    return {
        totalSegments: this.segments.length,
        totalChoices: this.segments.reduce((acc, segment) => acc + segment.choices.length, 0),
        totalCharacters: this.characters.length,
        averageChoicesPerSegment: this.segments.reduce((acc, segment) => acc + segment.choices.length, 0) / this.segments.length
    };
};

// Method to validate story structure
StorySchema.methods.validateStructure = function() {
    const segmentIds = new Set(this.segments.map(s => s.segmentId));
    const errors = [];

    // Check if all nextSegmentId references are valid
    this.segments.forEach(segment => {
        segment.choices.forEach(choice => {
            if (!segmentIds.has(choice.nextSegmentId)) {
                errors.push(`Invalid nextSegmentId "${choice.nextSegmentId}" in segment "${segment.segmentId}"`);
            }
        });
    });

    // Check if startSegmentId exists
    if (!segmentIds.has(this.metadata.startSegmentId)) {
        errors.push(`Start segment "${this.metadata.startSegmentId}" does not exist`);
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

const Story = mongoose.model('Story', StorySchema);
module.exports = Story; 