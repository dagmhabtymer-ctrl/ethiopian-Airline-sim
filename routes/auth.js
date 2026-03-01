 
// routes/auth.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Generate unique applicant ID
function generateApplicantId() {
    return 'ETH' + Date.now().toString().slice(-8) + Math.random().toString(36).substring(2, 5).toUpperCase();
}

// Registration page - serves the form
router.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Handle registration form submission
router.post('/register', (req, res) => {
    const db = req.app.locals.db;
    const {
        fullname,
        fullname_amharic,
        phone,
        telegram,
        education,
        region,
        id_number
    } = req.body;

    // Validate required fields
    if (!fullname || !phone) {
        return res.status(400).json({ error: 'Full name and phone are required' });
    }

    const applicantId = generateApplicantId();
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Store in database
    db.run(`
        INSERT INTO applicants (
            applicant_id, fullname, fullname_amharic, phone, telegram, 
            education, region, id_number, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        applicantId, fullname, fullname_amharic, phone, telegram,
        education, region, id_number, ipAddress, userAgent
    ], function(err) {
        if (err) {
            console.error('Registration error:', err);
            return res.status(500).json({ error: 'Registration failed' });
        }

        // Store in session
        req.session.applicantId = applicantId;
        req.session.phone = phone;
        req.session.fullname = fullname;

        // Redirect to exam
        res.redirect(`/exam.html?applicant=${applicantId}`);
    });
});

// Get applicant info
router.get('/applicant/:id', (req, res) => {
    const db = req.app.locals.db;
    const applicantId = req.params.id;

    db.get('SELECT * FROM applicants WHERE applicant_id = ?', [applicantId], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Applicant not found' });
            return;
        }
        res.json(row);
    });
});

module.exports = router;