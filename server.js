 
// server.js
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
    secret: 'ethiopian-airlines-fraud-simulation',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Database setup
const db = new sqlite3.Database('./database/fraud_simulation.db', (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

function initializeDatabase() {
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
    `);

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
    `);

    console.log('Database tables initialized');
}

// Make db available to routes
app.locals.db = db;

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/exam', require('./routes/exam'));
app.use('/api/payment', require('./routes/payment'));

// Admin routes (fraudster control panel)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/admin/dashboard.html'));
});

app.get('/admin/stats', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/admin/stats.html'));
});

// API endpoint for admin to get all applicants
app.get('/api/admin/applicants', (req, res) => {
    const db = req.app.locals.db;
    db.all(`
        SELECT * FROM applicants 
        ORDER BY registration_date DESC
    `, [], (err, rows) => {
        if (err) {
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
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(stats);
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Fraud simulation server running on http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
});