require('dotenv').config();
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const socketio = require('socket.io');
const http = require('http');
const flash = require('connect-flash');
const bodyParser = require('body-parser');
const { attachUser } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.use(expressLayouts);
app.set('layout', 'partials/layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Trust proxy (important for production)
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 24 * 60 * 60 // 1 day
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
}));

app.use(flash());

app.use(attachUser);

// Custom middleware to make user and flash messages available in all templates
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.messages = req.flash ? req.flash() : [];
    res.locals.currentPath = req.path;
    next();
});

// Database connection with improved error handling
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
})
.then(() => {
    console.log('Connected to MongoDB');
    // Start server only after successful database connection
    server.listen(PORT, () => {
        console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
})
.catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit if cannot connect to database
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('join-story', (storyId) => {
        socket.join(storyId);
    });

    socket.on('story-update', (data) => {
        io.to(data.storyId).emit('story-updated', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Routes (to be implemented)
app.use('/', require('./routes/index'));
app.use('/stories', require('./routes/stories'));
app.use('/auth', require('./routes/auth'));
app.use('/api', require('./routes/api'));

// Global 404 handler
app.use((req, res, next) => {
    res.status(404).render('404', {
        title: 'Page Not Found',
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', {
        message: process.env.NODE_ENV === 'production' 
            ? 'Something went wrong!' 
            : err.message
    });
});

// Start server
const PORT = process.env.PORT || 3000; 