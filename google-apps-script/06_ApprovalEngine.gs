// ============================================================================
// APPROVAL ENGINE
// FICO Auto Score simulation, 5-dimension Automated Decisioning Engine
// Credit 40%, LTV 25%, Affordability 20%, Vehicle 10%, Stability 5%
// ============================================================================

function calculateFICOAutoScore(credit) {
  var autoScore = credit.score;
  var factors = [];

  if (credit.openAutoLoans !== undefined) {
    if (credit.openAutoLoans >= 1 && credit.openAutoLoans <= 2) {
      autoScore += 15;
      factors.push({ factor: 'Current Auto Loan', impact: 'positive', weight: 'high', description: 'Active auto loan demonstrates auto credit experience' });
    } else if (credit.openAutoLoans === 0) {
      factors.push({ factor: 'No Auto History', impact: 'neutral', weight: 'medium', description: 'No prior auto loans - first time auto buyer' });
    } else if (credit.openAutoLoans > 2) {
      autoScore -= 10;
      factors.push({ factor: 'Multiple Auto Loans', impact: 'negative', weight: 'medium', description: 'Multiple open auto loans may indicate over-extension' });
    }
  }
  if (credit.bankruptcyHistory) {
    if (credit.bankruptcyAge && credit.bankruptcyAge < 12) { autoScore -= 50; factors.push({ factor: 'Recent Bankruptcy', impact: 'negative', weight: 'high', description: 'Bankruptcy within 12 months' }); }
    else if (credit.bankruptcyAge && credit.bankruptcyAge < 24) { autoScore -= 30; factors.push({ factor: 'Bankruptcy 12-24mo', impact: 'negative', weight: 'high', description: 'Bankruptcy between 12-24 months' }); }
    else if (credit.bankruptcyAge && credit.bankruptcyAge >= 24) { autoScore -= 15; factors.push({ factor: 'Bankruptcy 24+mo', impact: 'negative', weight: 'medium', description: 'Bankruptcy over 24 months' }); }
  }
  if (credit.repoHistory) {
    if (credit.repoAge && credit.repoAge < 24) { autoScore -= 60; factors.push({ factor: 'Recent Repo', impact: 'negative', weight: 'high', description: 'Repossession within 24 months' }); }
    else { autoScore -= 25; factors.push({ factor: 'Past Repo', impact: 'negative', weight: 'medium', description: 'Past repossession' }); }
  }
  if (credit.timeOnJob !== undefined) {
    if (credit.timeOnJob >= 24) { autoScore += 10; factors.push({ factor: 'Job Stability', impact: 'positive', weight: 'medium', description: '2+ years at current job' }); }
    else if (credit.timeOnJob < 6) { autoScore -= 10; factors.push({ factor: 'New Employment', impact: 'negative', weight: 'medium', description: 'Less than 6 months at job' }); }
  }
  if (credit.timeAtResidence !== undefined) {
    if (credit.timeAtResidence >= 24) { autoScore += 5; factors.push({ factor: 'Residence Stability', impact: 'positive', weight: 'low', description: '2+ years at residence' }); }
    else if (credit.timeAtResidence < 6) { autoScore -= 5; factors.push({ factor: 'New Residence', impact: 'negative', weight: 'low', description: 'Less than 6 months at residence' }); }
  }

  var riskTier;
  if (autoScore >= 780) riskTier = 'A+';
  else if (autoScore >= 720) riskTier = 'A';
  else if (autoScore >= 660) riskTier = 'B';
  else if (autoScore >= 600) riskTier = 'C';
  else if (autoScore >= 540) riskTier = 'D';
  else if (autoScore >= 480) riskTier = 'E';
  else riskTier = 'F';

  return { baseScore: credit.score, autoScore: Math.max(300, Math.min(850, autoScore)), factors: factors, riskTier: riskTier };
}

function processADEApplication(params) {
  var decisions = [];
  var active = getActiveLenders();
  for (var i = 0; i < active.length; i++) {
    decisions.push(evaluateLenderADE_(active[i], params));
  }
  decisions.sort(function(a, b) {
    var order = { AUTO_APPROVED: 0, CONDITIONAL: 1, PENDING_REVIEW: 2, DECLINED: 3 };
    var diff = order[a.decision] - order[b.decision];
    return diff !== 0 ? diff : (a.approvedRate || 99) - (b.approvedRate || 99);
  });
  return decisions;
}

function evaluateLenderADE_(lender, params) {
  var riskFactors = [];
  var riskScore = 500;
  var conditions = [], declineReasons = [];
  var ficoAuto = calculateFICOAutoScore(params.credit);
  var vehicleAge = new Date().getFullYear() - params.vehicle.year;

  var tierConfig = null;
  for (var i = 0; i < lender.creditTiers.length; i++) {
    var t = lender.creditTiers[i];
    if (ficoAuto.autoScore >= t.minScore && (!t.maxScore || ficoAuto.autoScore <= t.maxScore)) { tierConfig = t; break; }
  }
  if (!tierConfig) {
    return { lenderId: lender.id, lenderName: lender.name, decision: 'DECLINED', decisionTime: 'instant', score: 0, tier: 'N/A',
      conditions: [], declineReasons: ['Credit score below minimum requirements'], riskFactors: [], autoApprovalPath: { eligible: false, missingCriteria: ['Credit score below minimum'], adjustmentsNeeded: [], probabilityIfAdjusted: 0 } };
  }

  // Credit 40%
  var creditPoints = evaluateCredit_(ficoAuto, tierConfig, riskFactors);
  riskScore += creditPoints * 0.4;

  // LTV 25%
  var ltv = calculateLTV(params.amountFinanced, params.vehicleValue);
  var maxLTV = tierConfig.maxLTV;
  if (lender.loanLimits.maxLTVByAge && lender.loanLimits.maxLTVByAge[vehicleAge]) maxLTV = lender.loanLimits.maxLTVByAge[vehicleAge];
  var ltvPoints = evaluateLTV_(ltv, maxLTV, riskFactors);
  riskScore += ltvPoints * 0.25;

  // Affordability 20%
  var payment = calculateMonthlyPayment(params.amountFinanced, tierConfig.baseRate, params.term);
  var pti = calculatePTI(payment, params.credit.monthlyIncome);
  var dti = calculateDTI(payment, params.credit.monthlyDebt || 0, params.credit.monthlyIncome);
  var affPoints = evaluateAffordability_(pti, dti, tierConfig, riskFactors);
  riskScore += affPoints * 0.2;

  // Vehicle 10%
  var vehPoints = evaluateVehicle_(params.vehicle, lender, riskFactors);
  riskScore += vehPoints * 0.1;

  // Stability 5%
  var stabPoints = evaluateStability_(params.credit, riskFactors);
  riskScore += stabPoints * 0.05;

  var failedFactors = riskFactors.filter(function(f) { return f.status === 'fail'; });
  var warnFactors = riskFactors.filter(function(f) { return f.status === 'warn'; });

  var decision, decisionTime;
  if (failedFactors.length > 0) {
    var hasCritical = failedFactors.some(function(f) { return f.category === 'Credit' || f.category === 'Vehicle'; });
    if (hasCritical) { decision = 'DECLINED'; decisionTime = 'instant'; declineReasons = failedFactors.map(function(f) { return f.factor; }); }
    else { decision = 'PENDING_REVIEW'; decisionTime = 'manual review'; conditions = failedFactors.map(function(f) { return 'Review: ' + f.factor; }); }
  } else if (warnFactors.length > 2) { decision = 'CONDITIONAL'; decisionTime = '< 30 min'; if (tierConfig.stipulations) conditions = conditions.concat(tierConfig.stipulations); }
  else if (warnFactors.length > 0) { decision = 'CONDITIONAL'; decisionTime = '< 5 min'; if (tierConfig.stipulations) conditions = conditions.concat(tierConfig.stipulations); }
  else { decision = 'AUTO_APPROVED'; decisionTime = 'instant'; }

  return {
    lenderId: lender.id, lenderName: lender.name, decision: decision, decisionTime: decisionTime,
    score: Math.round(riskScore), tier: tierConfig.tier,
    approvedRate: decision !== 'DECLINED' ? tierConfig.baseRate : undefined,
    approvedTerm: decision !== 'DECLINED' ? Math.min(params.term, tierConfig.maxTerm) : undefined,
    maxApprovedAmount: decision !== 'DECLINED' ? params.vehicleValue * (tierConfig.maxLTV / 100) : undefined,
    conditions: conditions, declineReasons: declineReasons, riskFactors: riskFactors,
    autoApprovalPath: { eligible: failedFactors.length === 0 && warnFactors.length === 0, missingCriteria: failedFactors.map(function(f) { return f.factor; }), adjustmentsNeeded: [], probabilityIfAdjusted: failedFactors.length === 0 ? 75 : 50 }
  };
}

function evaluateCredit_(ficoAuto, tierConfig, factors) {
  var points = 0;
  var above = ficoAuto.autoScore - tierConfig.minScore;
  if (above >= 50) { points += 100; factors.push({ category: 'Credit', factor: 'FICO Auto Score', value: ficoAuto.autoScore, threshold: tierConfig.minScore + '+ (50+ above)', status: 'pass', points: 100 }); }
  else if (above >= 20) { points += 50; factors.push({ category: 'Credit', factor: 'FICO Auto Score', value: ficoAuto.autoScore, threshold: tierConfig.minScore + '+ (20+ above)', status: 'pass', points: 50 }); }
  else if (above >= 0) { factors.push({ category: 'Credit', factor: 'FICO Auto Score', value: ficoAuto.autoScore, threshold: tierConfig.minScore + ' (at min)', status: 'warn', points: 0 }); }
  else { points -= 100; factors.push({ category: 'Credit', factor: 'FICO Auto Score', value: ficoAuto.autoScore, threshold: tierConfig.minScore, status: 'fail', points: -100 }); }
  if (ficoAuto.riskTier === 'A+' || ficoAuto.riskTier === 'A') points += 50;
  else if (ficoAuto.riskTier === 'B') points += 25;
  else if (ficoAuto.riskTier === 'D' || ficoAuto.riskTier === 'E') points -= 25;
  else if (ficoAuto.riskTier === 'F') points -= 50;
  return points;
}

function evaluateLTV_(ltv, maxLTV, factors) {
  var buf = maxLTV - ltv;
  if (buf >= 20) { factors.push({ category: 'LTV', factor: 'Loan to Value', value: ltv.toFixed(1) + '%', threshold: '<=' + maxLTV + '%', status: 'pass', points: 100 }); return 100; }
  if (buf >= 10) { factors.push({ category: 'LTV', factor: 'Loan to Value', value: ltv.toFixed(1) + '%', threshold: '<=' + maxLTV + '%', status: 'pass', points: 50 }); return 50; }
  if (buf >= 0) { factors.push({ category: 'LTV', factor: 'Loan to Value', value: ltv.toFixed(1) + '%', threshold: '<=' + maxLTV + '% (at limit)', status: 'warn', points: 0 }); return 0; }
  factors.push({ category: 'LTV', factor: 'Loan to Value', value: ltv.toFixed(1) + '%', threshold: '<=' + maxLTV + '%', status: 'fail', points: -100 }); return -100;
}

function evaluateAffordability_(pti, dti, tierConfig, factors) {
  var points = 0;
  var ptiBuf = tierConfig.maxPTI - pti;
  if (ptiBuf >= 5) { points += 50; factors.push({ category: 'Affordability', factor: 'PTI', value: pti.toFixed(1) + '%', threshold: '<=' + tierConfig.maxPTI + '%', status: 'pass', points: 50 }); }
  else if (ptiBuf >= 0) { factors.push({ category: 'Affordability', factor: 'PTI', value: pti.toFixed(1) + '%', threshold: '<=' + tierConfig.maxPTI + '% (at limit)', status: 'warn', points: 0 }); }
  else { points -= 50; factors.push({ category: 'Affordability', factor: 'PTI', value: pti.toFixed(1) + '%', threshold: '<=' + tierConfig.maxPTI + '%', status: 'fail', points: -50 }); }
  if (tierConfig.maxDTI) {
    var dtiBuf = tierConfig.maxDTI - dti;
    if (dtiBuf >= 10) { points += 50; factors.push({ category: 'Affordability', factor: 'DTI', value: dti.toFixed(1) + '%', threshold: '<=' + tierConfig.maxDTI + '%', status: 'pass', points: 50 }); }
    else if (dtiBuf >= 0) { factors.push({ category: 'Affordability', factor: 'DTI', value: dti.toFixed(1) + '%', threshold: '<=' + tierConfig.maxDTI + '% (at limit)', status: 'warn', points: 0 }); }
    else { points -= 50; factors.push({ category: 'Affordability', factor: 'DTI', value: dti.toFixed(1) + '%', threshold: '<=' + tierConfig.maxDTI + '%', status: 'fail', points: -50 }); }
  }
  return points;
}

function evaluateVehicle_(vehicle, lender, factors) {
  var points = 0;
  var age = new Date().getFullYear() - vehicle.year;
  var r = lender.vehicleRestrictions;
  if (age <= r.maxAge - 3) { points += 30; factors.push({ category: 'Vehicle', factor: 'Vehicle Age', value: age + ' years', threshold: '<=' + r.maxAge + ' years', status: 'pass', points: 30 }); }
  else if (age <= r.maxAge) { factors.push({ category: 'Vehicle', factor: 'Vehicle Age', value: age + ' years', threshold: '<=' + r.maxAge + ' years', status: 'warn', points: 0 }); }
  else { points -= 100; factors.push({ category: 'Vehicle', factor: 'Vehicle Age', value: age + ' years', threshold: '<=' + r.maxAge + ' years', status: 'fail', points: -100 }); }
  if (vehicle.mileage <= r.maxMileage * 0.7) { points += 30; factors.push({ category: 'Vehicle', factor: 'Mileage', value: vehicle.mileage, threshold: '<=' + r.maxMileage, status: 'pass', points: 30 }); }
  else if (vehicle.mileage <= r.maxMileage) { factors.push({ category: 'Vehicle', factor: 'Mileage', value: vehicle.mileage, threshold: '<=' + r.maxMileage, status: 'warn', points: 0 }); }
  else { points -= 100; factors.push({ category: 'Vehicle', factor: 'Mileage', value: vehicle.mileage, threshold: '<=' + r.maxMileage, status: 'fail', points: -100 }); }
  if (vehicle.certified) { points += 40; factors.push({ category: 'Vehicle', factor: 'CPO', value: 'Yes', threshold: 'CPO Preferred', status: 'pass', points: 40 }); }
  return points;
}

function evaluateStability_(credit, factors) {
  var points = 0;
  if (credit.timeOnJob !== undefined) {
    if (credit.timeOnJob >= 24) { points += 30; factors.push({ category: 'Stability', factor: 'Employment', value: credit.timeOnJob + ' months', threshold: '>=24mo', status: 'pass', points: 30 }); }
    else if (credit.timeOnJob >= 12) { points += 10; factors.push({ category: 'Stability', factor: 'Employment', value: credit.timeOnJob + ' months', threshold: '>=12mo', status: 'pass', points: 10 }); }
    else if (credit.timeOnJob >= 6) { factors.push({ category: 'Stability', factor: 'Employment', value: credit.timeOnJob + ' months', threshold: '>=6mo', status: 'warn', points: 0 }); }
    else { points -= 20; factors.push({ category: 'Stability', factor: 'Employment', value: credit.timeOnJob + ' months', threshold: '>=6mo', status: 'warn', points: -20 }); }
  }
  if (credit.timeAtResidence !== undefined) {
    if (credit.timeAtResidence >= 24) { points += 20; factors.push({ category: 'Stability', factor: 'Residence', value: credit.timeAtResidence + ' months', threshold: '>=24mo', status: 'pass', points: 20 }); }
    else if (credit.timeAtResidence >= 12) { points += 5; factors.push({ category: 'Stability', factor: 'Residence', value: credit.timeAtResidence + ' months', threshold: '>=12mo', status: 'pass', points: 5 }); }
  }
  return points;
}
