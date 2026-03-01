 
// utils/scoreCalculator.js
/**
 * THIS IS THE FRAUDSTER'S SECRET:
 * Regardless of actual answers, the victim always passes
 * The score is MANIPULATED to ensure they pay the fee
 */

function calculateScore(answers) {
    // The "correct" answer key (for show only)
    const correctAnswers = {
        'q1': 'A', 'q2': 'B', 'q3': 'C', 'q4': 'B', 'q5': 'B',
        'q6': 'B', 'q7': 'B', 'q8': 'B', 'q9': 'B', 'q10': 'B',
        'q11': 'B', 'q12': 'B', 'q13': 'B', 'q14': 'B', 'q15': 'C',
        'q16': 'B', 'q17': 'B', 'q18': 'B', 'q19': 'C', 'q20': 'B',
        'q21': 'B', 'q22': 'C', 'q23': 'A', 'q24': 'B', 'q25': 'A',
        'q26': 'B', 'q27': 'B', 'q28': 'A', 'q29': 'C', 'q30': 'B'
    };
    
    // Calculate actual score (for internal tracking)
    let actualScore = 0;
    let totalQuestions = 30;
    
    if (answers) {
        for (let i = 1; i <= totalQuestions; i++) {
            const questionKey = `q${i}`;
            if (answers[questionKey] && answers[questionKey] === correctAnswers[questionKey]) {
                actualScore++;
            }
        }
    }
    
    // FRAUDSTER LOGIC: Always return a passing score (between 70-95%)
    // This ensures every victim feels successful and proceeds to payment
    
    // Generate a "believable" passing score
    const minPassing = 21; // 70%
    const maxPassing = 28; // 93%
    
    // Fraudster manipulates score upward
    let displayedScore;
    
    if (actualScore < minPassing) {
        // If they did poorly, give them a moderate passing score
        displayedScore = Math.floor(Math.random() * (24 - 21 + 1) + 21); // 21-24
    } else if (actualScore > maxPassing) {
        // If they did very well, give them an excellent score
        displayedScore = Math.floor(Math.random() * (29 - 26 + 1) + 26); // 26-29
    } else {
        // If they did moderately well, boost it slightly
        displayedScore = Math.min(actualScore + 3, 29);
    }
    
    // Ensure it's always at least 21 (70%) - passing
    displayedScore = Math.max(displayedScore, 21);
    
    const percentage = ((displayedScore / totalQuestions) * 100).toFixed(1);
    
    console.log(`FRAUD ALERT: Actual score: ${actualScore}/30, Displayed score: ${displayedScore}/30 (${percentage}%) - Victim always passes!`);
    
    return {
        actualScore: actualScore,
        displayedScore: displayedScore,
        percentage: percentage,
        passed: true // Always true in fraud system
    };
}

module.exports = { calculateScore };