const express = require('express');
const router = express.Router();

// Simple test route
router.get('/test', (req, res) => {
    res.send('Auth test route is working!');
});

// Show Login Page
router.get('/login', (req, res) => {
    res.render('login', { 
        title: 'Login'
    });
});

// Show Register Page
router.get('/register', (req, res) => {
    res.render('register', { 
        title: 'Sign Up'
    });
});

const User = require('../models/User');
const { isAuthenticated, attachUser } = require('../middleware/auth');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Configure email transporter
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findByEmailOrUsername(email);
        if (existingUser) {
            req.flash('error', 'User with that email or username already exists.');
            return res.redirect('/auth/register');
        }

        // Create verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // Create new user
        const user = new User({
            username,
            email,
            password,
            verificationToken
        });

        await user.save(); // This might throw a ValidationError

        // Send verification email
        const verificationUrl = `${req.protocol}://${req.get('host')}/auth/verify/${verificationToken}`;
        await transporter.sendMail({
            to: email,
            subject: 'Verify your CreateStory account',
            html: `
                <h1>Welcome to CreateStory!</h1>
                <p>Please click the link below to verify your account:</p>
                <a href="${verificationUrl}">${verificationUrl}</a>
            `
        });

        req.flash('success', 'Registration successful! Please check your email to verify your account.');
        res.redirect('/auth/login');
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            req.flash('error', messages.join('<br>')); // Join with <br> for multi-line display if needed
            return res.redirect('/auth/register');
        } else {
            console.error('Registration error:', error);
            req.flash('error', 'Registration failed. Please try again later.');
            res.redirect('/auth/register');
        }
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { emailOrUsername, password } = req.body;

        // Find user by email or username
        const user = await User.findByEmailOrUsername(emailOrUsername);
        if (!user) {
            req.flash('error', 'Invalid credentials');
            return res.redirect('/auth/login');
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            req.flash('error', 'Invalid credentials');
            return res.redirect('/auth/login');
        }

        // Update last login
        user.lastLogin = Date.now();
        await user.save();

        // Set session
        req.session.userId = user._id;
        req.session.save((err) => { // Added a callback to handle potential save errors
            if (err) {
                console.error('Session save error:', err);
                req.flash('error', 'Login failed. Please try again.');
                return res.redirect('/auth/login');
            }
            // Successful login, redirect to home page
            res.redirect('/');
        });

    } catch (error) {
        console.error('Login error:', error); // It's good practice to log the actual error
        req.flash('error', 'Login failed. Please try again later.');
        res.redirect('/auth/login');
    }
});

// Verify user email
router.get('/verify/:token', async (req, res) => {
    try {
        const user = await User.findOne({ verificationToken: req.params.token });
        if (!user) {
            return res.status(400).json({ error: 'Invalid verification token' });
        }

        user.isVerified = true;
        user.verificationToken = undefined;
        await user.save();

        res.redirect('/auth/login?verified=true'); // Redirect to login page with a success query param
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// Logout user
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err); // Add error logging
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.clearCookie('connect.sid'); // Ensure the session cookie is cleared
        // Instead of res.json, redirect to login or home page
        res.redirect('/auth/login?loggedOut=true'); 
    });
});

/* // Remaining commented out code (GET /profile, etc.)
// Get current user profile
router.get('/profile', isAuthenticated, attachUser, (req, res) => {
    res.json({ user: req.user });
});

// Update user profile
router.put('/profile', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { displayName, bio, avatar, socialLinks, preferences } = req.body;

        // Update profile fields
        if (displayName) user.profile.displayName = displayName;
        if (bio) user.profile.bio = bio;
        if (avatar) user.profile.avatar = avatar;
        if (socialLinks) user.profile.socialLinks = socialLinks;
        if (preferences) user.profile.preferences = preferences;

        await user.save();
        res.json({ user: user.getPublicProfile() });
    } catch (error) {
        res.status(500).json({ error: 'Profile update failed' });
    }
});

// Request password reset
router.post('/reset-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        // Send reset email
        const resetUrl = `${req.protocol}://${req.get('host')}/auth/reset/${resetToken}`;
        await transporter.sendMail({
            to: email,
            subject: 'Reset your CreateStory password',
            html: `
                <h1>Password Reset Request</h1>
                <p>Click the link below to reset your password:</p>
                <a href="${resetUrl}">${resetUrl}</a>
                <p>This link will expire in 1 hour.</p>
            `
        });

        res.json({ message: 'Password reset email sent' });
    } catch (error) {
        res.status(500).json({ error: 'Password reset request failed' });
    }
});

// Reset password
router.post('/reset/:token', async (req, res) => {
    try {
        const { password } = req.body;
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: 'Password reset successful' });
    } catch (error) {
        res.status(500).json({ error: 'Password reset failed' });
    }
});
*/

module.exports = router; 