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
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdn.jsdelivr.net", "cdn.tailwindcss.com", "unpkg.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "blob:", "cdn.jsdelivr.net"],
            fontSrc: ["'self'", "fonts.gstatic.com"],
            connectSrc: ["'self'", "ws:", "wss:"],
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

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-default-secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
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

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/create-story', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

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
        title: 'Error',
        message: process.env.NODE_ENV === 'production' 
            ? 'Something went wrong!' 
            : err.message,
        error: process.env.NODE_ENV === 'production' ? {} : err
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 