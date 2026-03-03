const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');
const fs = require('fs');

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
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Ensure database directory exists
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)){
    fs.mkdirSync(dbDir, { recursive: true });
}

// Database setup with better error handling
const dbPath = path.join(dbDir, 'fraud_simulation.db');
console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Database connection error:', err);
    } else {
        console.log('✅ Connected to SQLite database');
        initializeDatabase();
    }
});

function initializeDatabase() {
    // Serialize to ensure tables are created in order
    db.serialize(() => {
        // Create applicants table
        db.run(`
            CREATE TABLE IF NOT EXISTS applicants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                applicant_id TEXT UNIQUE,
                fullname TEXT,
                fullname_amharic TEXT,
                phone TEXT UNIQUE,
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
                console.error('❌ Error creating applicants table:', err);
            } else {
                console.log('✅ Applicants table ready');
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
                transaction_id TEXT UNIQUE,
                bank_account TEXT,
                payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                notified INTEGER DEFAULT 0,
                FOREIGN KEY (applicant_id) REFERENCES applicants(applicant_id)
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creating payments table:', err);
            } else {
                console.log('✅ Payments table ready');
            }
        });
    });

    console.log('✅ Database tables initialized');
}

// Make db available to routes
app.locals.db = db;

// Import routes with error handling
try {
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/exam', require('./routes/exam'));
    app.use('/api/payment', require('./routes/payment'));
    console.log('✅ Routes loaded successfully');
} catch (err) {
    console.error('❌ Error loading routes:', err);
}

// ============================================
// ROOT ROUTE HANDLER
// ============================================
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        console.error('❌ index.html not found at:', indexPath);
        res.status(404).send('Homepage not found');
    }
});

// Admin dashboard
app.get('/admin', (req, res) => {
    const adminPath = path.join(__dirname, 'views/admin/dashboard.html');
    
    if (fs.existsSync(adminPath)) {
        res.sendFile(adminPath);
    } else {
        console.error('❌ Admin dashboard not found at:', adminPath);
        res.status(404).send('Admin page not found');
    }
});

// ============================================
// FIXED: API endpoint for admin to get all applicants
// ============================================
app.get('/api/admin/applicants', (req, res) => {
    const db = req.app.locals.db;
    
    console.log('📊 Fetching all applicants...');
    
    db.all(`
        SELECT 
            id,
            applicant_id,
            fullname,
            fullname_amharic,
            phone,
            telegram,
            education,
            region,
            id_number,
            COALESCE(exam_score, 0) as exam_score,
            COALESCE(exam_percentage, 0) as exam_percentage,
            COALESCE(exam_passed, 0) as exam_passed,
            exam_date,
            COALESCE(payment_status, 0) as payment_status,
            COALESCE(payment_amount, 0) as payment_amount,
            payment_method,
            payment_date,
            registration_date
        FROM applicants 
        ORDER BY registration_date DESC
    `, [], (err, rows) => {
        if (err) {
            console.error('❌ Error fetching applicants:', err);
            res.status(500).json({ 
                error: err.message,
                details: 'Database error occurred'
            });
            return;
        }
        
        console.log(`✅ Found ${rows ? rows.length : 0} applicants`);
        
        // Log each applicant for debugging
        if (rows && rows.length > 0) {
            rows.forEach(row => {
                console.log(`👤 ${row.fullname} - Phone: ${row.phone} - Exam: ${row.exam_score}/30 - Passed: ${row.exam_passed}`);
            });
        }
        
        res.json(rows || []);
    });
});

// ============================================
// FIXED: API endpoint for admin stats
// ============================================
app.get('/api/admin/stats', (req, res) => {
    const db = req.app.locals.db;
    
    console.log('📊 Fetching admin stats...');
    
    db.get(`
        SELECT 
            COUNT(*) as total_applicants,
            SUM(CASE WHEN exam_passed = 1 THEN 1 ELSE 0 END) as passed_exam,
            SUM(CASE WHEN payment_status > 0 THEN 1 ELSE 0 END) as paid_applicants,
            COALESCE(SUM(payment_amount), 0) as total_collected,
            COUNT(CASE WHEN exam_date IS NOT NULL THEN 1 END) as exam_taken
        FROM applicants
    `, [], (err, stats) => {
        if (err) {
            console.error('❌ Error fetching stats:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        
        const result = {
            total_applicants: stats?.total_applicants || 0,
            passed_exam: stats?.passed_exam || 0,
            paid_applicants: stats?.paid_applicants || 0,
            total_collected: stats?.total_collected || 0,
            exam_taken: stats?.exam_taken || 0
        };
        
        console.log('✅ Stats:', result);
        res.json(result);
    });
});

// ============================================
// FIXED: Get single applicant by phone
// ============================================
app.get('/api/admin/applicant/:phone', (req, res) => {
    const db = req.app.locals.db;
    const phone = req.params.phone;
    
    db.get('SELECT * FROM applicants WHERE phone = ?', [phone], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(row || {});
    });
});

// ============================================
// FIXED: Update payment status
// ============================================
app.post('/api/admin/update-payment', express.json(), (req, res) => {
    const db = req.app.locals.db;
    const { id, amount, method } = req.body;
    
    db.run(`
        UPDATE applicants 
        SET payment_status = 1,
            payment_amount = ?,
            payment_method = ?,
            payment_date = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [amount, method, id], function(err) {
        if (err) {
            res.status(500).json({ success: false, error: err.message });
            return;
        }
        res.json({ success: true, changes: this.changes });
    });
});

// ============================================
// FIXED: Debug endpoint - check database contents
// ============================================
app.get('/api/debug/check-db', (req, res) => {
    const db = req.app.locals.db;
    
    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
        if (err) {
            res.json({ error: err.message });
            return;
        }
        
        db.all("SELECT COUNT(*) as count FROM applicants", [], (err, count) => {
            res.json({
                tables: tables,
                applicant_count: count[0]?.count || 0,
                database_path: dbPath
            });
        });
    });
});

// ============================================
// Catch-all route
// ============================================
app.get('*', (req, res) => {
    const requestedPath = req.path;
    
    if (requestedPath.startsWith('/api/')) {
        res.status(404).json({ error: 'API endpoint not found' });
        return;
    }
    
    const possibleHtmlFile = path.join(__dirname, 'public', requestedPath + '.html');
    
    if (fs.existsSync(possibleHtmlFile)) {
        res.sendFile(possibleHtmlFile);
    } else {
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
    console.error('❌ Server error:', err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n=================================');
    console.log('🚀 SERVER STARTED SUCCESSFULLY');
    console.log('=================================');
    console.log(`📌 Port: ${PORT}`);
    console.log(`🌐 Main URL: http://localhost:${PORT}`);
    console.log(`👤 Admin: http://localhost:${PORT}/admin`);
    console.log(`📊 Debug: http://localhost:${PORT}/api/debug/check-db`);
    console.log(`💾 Database: ${dbPath}`);
    console.log('=================================\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing database...');
    db.close();
});

process.on('SIGINT', () => {
    console.log('SIGINT received, closing database...');
    db.close();
});