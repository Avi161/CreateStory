const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 30
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    profile: {
        displayName: {
            type: String,
            trim: true
        },
        bio: {
            type: String,
            trim: true,
            maxlength: 500
        },
        avatar: {
            type: String
        },
        socialLinks: {
            website: String,
            twitter: String,
            github: String,
            instagram: String
        },
        preferences: {
            theme: {
                type: String,
                enum: ['light', 'dark', 'system'],
                default: 'system'
            },
            notifications: {
                email: {
                    type: Boolean,
                    default: true
                },
                storyUpdates: {
                    type: Boolean,
                    default: true
                }
            }
        }
    },
    stats: {
        storiesCreated: {
            type: Number,
            default: 0
        },
        totalViews: {
            type: Number,
            default: 0
        },
        totalLikes: {
            type: Number,
            default: 0
        },
        followers: {
            type: Number,
            default: 0
        },
        following: {
            type: Number,
            default: 0
        }
    },
    role: {
        type: String,
        enum: ['user', 'author', 'admin'],
        default: 'user'
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    lastLogin: Date,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Update timestamp
UserSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

// Method to get public profile
UserSchema.methods.getPublicProfile = function() {
    return {
        id: this._id,
        username: this.username,
        profile: {
            displayName: this.profile.displayName,
            bio: this.profile.bio,
            avatar: this.profile.avatar,
            socialLinks: this.profile.socialLinks
        },
        stats: this.stats,
        role: this.role,
        isVerified: this.isVerified,
        createdAt: this.createdAt
    };
};

// Method to update user stats
UserSchema.methods.updateStats = async function(update) {
    Object.keys(update).forEach(key => {
        if (this.stats[key] !== undefined) {
            this.stats[key] += update[key];
        }
    });
    await this.save();
};

// Static method to find by email or username
UserSchema.statics.findByEmailOrUsername = function(emailOrUsername) {
    return this.findOne({
        $or: [
            { email: emailOrUsername.toLowerCase() },
            { username: emailOrUsername }
        ]
    });
};

const User = mongoose.model('User', UserSchema);
module.exports = User; 