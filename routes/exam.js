const express = require('express');
const router = express.Router();
const { calculateScore } = require('../utils/scoreCalculator');

// Submit exam answers
router.post('/submit', express.json(), (req, res) => {
    const db = req.app.locals.db;
    const { answers, phone, applicantId } = req.body;
    
    console.log('📝 Exam submission received for phone:', phone);
    
    if (!answers || !phone) {
        console.error('❌ Missing required fields');
        return res.status(400).json({ error: 'Answers and phone are required' });
    }
    
    // Calculate manipulated score (always passing)
    const scoreResult = calculateScore(answers);
    
    console.log(`🎯 Score calculated - Displayed: ${scoreResult.displayedScore}/30, Actual: ${scoreResult.actualScore}/30`);
    
    // First check if applicant exists
    db.get('SELECT * FROM applicants WHERE phone = ?', [phone], (err, applicant) => {
        if (err) {
            console.error('❌ Error checking applicant:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!applicant) {
            console.error('❌ Applicant not found with phone:', phone);
            return res.status(404).json({ error: 'Applicant not found' });
        }
        
        // Update applicant with exam results
        db.run(`
            UPDATE applicants 
            SET exam_score = ?, 
                exam_percentage = ?, 
                exam_passed = ?,
                exam_date = CURRENT_TIMESTAMP
            WHERE phone = ?
        `, [
            scoreResult.displayedScore, 
            scoreResult.percentage, 
            1, // Always passed
            phone
        ], function(err) {
            if (err) {
                console.error('❌ Error updating exam score:', err);
                return res.status(500).json({ error: 'Failed to save exam results' });
            }
            
            console.log(`✅ Exam results saved for ${phone} - Rows affected: ${this.changes}`);
            
            // Verify the update worked
            db.get('SELECT exam_score, exam_passed FROM applicants WHERE phone = ?', [phone], (err, updated) => {
                if (err) {
                    console.error('❌ Error verifying update:', err);
                } else {
                    console.log(`✅ Verification - Score: ${updated?.exam_score}, Passed: ${updated?.exam_passed}`);
                }
            });
            
            // Return results to victim
            res.json({
                success: true,
                score: scoreResult.displayedScore,
                total: 30,
                percentage: scoreResult.percentage,
                passed: true,
                message: `Congratulations! You scored ${scoreResult.displayedScore}/30 (${scoreResult.percentage}%). You have PASSED!`,
                nextStep: 'Proceed to payment for processing fee (500 ETB)'
            });
        });
    });
});

// Get exam results
router.get('/results/:phone', (req, res) => {
    const db = req.app.locals.db;
    const phone = req.params.phone;
    
    db.get('SELECT exam_score, exam_percentage, exam_passed FROM applicants WHERE phone = ?', [phone], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(row || { exam_score: 0, exam_passed: 0 });
    });
});

module.exports = router;