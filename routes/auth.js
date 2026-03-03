const express = require('express');
const router = express.Router();
const path = require('path');

// Generate unique applicant ID
function generateApplicantId() {
    return 'ETH' + Date.now().toString().slice(-8) + Math.random().toString(36).substring(2, 5).toUpperCase();
}

// Handle registration form submission
router.post('/register', express.urlencoded({ extended: true }), (req, res) => {
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

    console.log('📝 Registration attempt for:', fullname, phone);

    // Validate required fields
    if (!fullname || !phone) {
        console.error('❌ Missing required fields');
        return res.status(400).send('Full name and phone are required');
    }

    const applicantId = generateApplicantId();
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Check if phone already registered
    db.get('SELECT phone FROM applicants WHERE phone = ?', [phone], (err, existing) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).send('Registration failed');
        }
        
        if (existing) {
            console.log('⚠️ Phone already registered:', phone);
            // Phone exists, redirect to exam
            req.session.applicantId = existing.applicant_id || applicantId;
            req.session.phone = phone;
            req.session.fullname = fullname;
            
            return res.redirect(`/exam.html?applicant=${existing.applicant_id || applicantId}`);
        }
        
        // Insert new applicant
        db.run(`
            INSERT INTO applicants (
                applicant_id, fullname, fullname_amharic, phone, telegram, 
                education, region, id_number, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            applicantId, fullname, fullname_amharic || '', phone, telegram || '',
            education || '', region || '', id_number || '', ipAddress, userAgent
        ], function(err) {
            if (err) {
                console.error('❌ Registration error:', err);
                return res.status(500).send('Registration failed');
            }

            console.log(`✅ Applicant registered with ID: ${applicantId}, Phone: ${phone}`);

            // Store in session
            req.session.applicantId = applicantId;
            req.session.phone = phone;
            req.session.fullname = fullname;

            // Redirect to exam
            res.redirect(`/exam.html?applicant=${applicantId}`);
        });
    });
});

// Get applicant info
router.get('/applicant/:id', (req, res) => {
    const db = req.app.locals.db;
    const applicantId = req.params.id;

    db.get('SELECT * FROM applicants WHERE applicant_id = ? OR phone = ?', [applicantId, applicantId], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(row || {});
    });
});

module.exports = router;