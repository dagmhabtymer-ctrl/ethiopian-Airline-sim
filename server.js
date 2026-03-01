const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'ethiopian-airlines-fraud-simulation',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // true in production (HTTPS)
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Ensure database directory exists
const fs = require('fs');
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)){
    fs.mkdirSync(dbDir, { recursive: true });
}

// Database setup
const db = new sqlite3.Database(path.join(dbDir, 'fraud_simulation.db'), (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

function initializeDatabase() {
    // Create applicants table
    db.run(`
        CREATE TABLE IF NOT EXISTS applicants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            applicant_id TEXT UNIQUE,
            fullname TEXT,
            fullname_amharic TEXT,
            phone TEXT,
            telegram TEXT,
            education TEXT,
            region TEXT,
            id_number TEXT,
            exam_score INTEGER DEFAULT 0,
            exam_percentage REAL DEFAULT 0,
            exam_passed INTEGER DEFAULT 0,
            exam_date DATETIME,
            payment_status INTEGER DEFAULT 0,
            payment_amount REAL DEFAULT 0,
            payment_method TEXT,
            payment_date DATETIME,
            registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            ip_address TEXT,
            user_agent TEXT
        )
    `, (err) => {
        if (err) {
            console.error('Error creating applicants table:', err);
        } else {
            console.log('Applicants table ready');
        }
    });

    // Create payments table
    db.run(`
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            applicant_id TEXT,
            phone TEXT,
            amount REAL,
            payment_method TEXT,
            transaction_id TEXT,
            bank_account TEXT,
            payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            notified INTEGER DEFAULT 0,
            FOREIGN KEY (applicant_id) REFERENCES applicants(applicant_id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating payments table:', err);
        } else {
            console.log('Payments table ready');
        }
    });

    console.log('Database tables initialized');
}

// Make db available to routes
app.locals.db = db;

// Import routes
try {
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/exam', require('./routes/exam'));
    app.use('/api/payment', require('./routes/payment'));
    console.log('Routes loaded successfully');
} catch (err) {
    console.error('Error loading routes:', err);
}

// ============================================
// IMPORTANT: ROOT ROUTE HANDLER FOR HOMEPAGE
// ============================================
// Serve the main page for root path
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    
    // Check if file exists
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        console.error('index.html not found at:', indexPath);
        res.status(404).send('Homepage not found. Please check your public folder.');
    }
});

// Admin routes (fraudster control panel)
app.get('/admin', (req, res) => {
    const adminPath = path.join(__dirname, 'views/admin/dashboard.html');
    
    if (fs.existsSync(adminPath)) {
        res.sendFile(adminPath);
    } else {
        console.error('Admin dashboard not found at:', adminPath);
        res.status(404).send('Admin page not found');
    }
});

app.get('/admin/stats', (req, res) => {
    const statsPath = path.join(__dirname, 'views/admin/stats.html');
    
    if (fs.existsSync(statsPath)) {
        res.sendFile(statsPath);
    } else {
        console.error('Stats page not found at:', statsPath);
        res.status(404).send('Stats page not found');
    }
});

// API endpoint for admin to get all applicants
app.get('/api/admin/applicants', (req, res) => {
    const db = req.app.locals.db;
    db.all(`
        SELECT * FROM applicants 
        ORDER BY registration_date DESC
    `, [], (err, rows) => {
        if (err) {
            console.error('Error fetching applicants:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// API endpoint for admin stats
app.get('/api/admin/stats', (req, res) => {
    const db = req.app.locals.db;
    
    db.get(`
        SELECT 
            COUNT(*) as total_applicants,
            SUM(CASE WHEN exam_passed = 1 THEN 1 ELSE 0 END) as passed_exam,
            SUM(CASE WHEN payment_status > 0 THEN 1 ELSE 0 END) as paid_applicants,
            SUM(payment_amount) as total_collected
        FROM applicants
    `, [], (err, stats) => {
        if (err) {
            console.error('Error fetching stats:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(stats || { total_applicants: 0, passed_exam: 0, paid_applicants: 0, total_collected: 0 });
    });
});

// ============================================
// CATCH-ALL ROUTE FOR CLIENT-SIDE ROUTING
// This ensures any deep links work correctly
// ============================================
app.get('*', (req, res) => {
    const requestedPath = req.path;
    
    // Skip API and admin routes (they should 404 if not found)
    if (requestedPath.startsWith('/api/') || requestedPath.startsWith('/admin')) {
        res.status(404).send('Endpoint not found');
        return;
    }
    
    // For any other path, try to serve corresponding HTML file from public folder
    const possibleHtmlFile = path.join(__dirname, 'public', requestedPath + '.html');
    
    if (fs.existsSync(possibleHtmlFile)) {
        res.sendFile(possibleHtmlFile);
    } else {
        // If no matching HTML file, serve index.html for client-side routing
        // This handles routes like /exam, /results, /payment etc.
        const indexPath = path.join(__dirname, 'public', 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.status(404).send('Page not found');
        }
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).send('Something broke! Please check server logs.');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================`);
    console.log(`Fraud simulation server running`);
    console.log(`Port: ${PORT}`);
    console.log(`Main URL: http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`=================================`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing database connection...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, closing database connection...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});