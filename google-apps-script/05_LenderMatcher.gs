// ============================================================================
// LENDER MATCHER
// Matches deals to lenders with rate adjustments, dealer markup, approval scoring
// ============================================================================

function findMatchingLenders(params) {
  var matches = [];
  var activeLenders = getActiveLenders();
  var vehicleAge = new Date().getFullYear() - params.vehicle.year;

  for (var i = 0; i < activeLenders.length; i++) {
    var lender = activeLenders[i];
    var tierConfig = findBestTierForScore_(lender, params.creditScore);
    if (!tierConfig) continue;

    var vehicleCheck = checkVehicleRestrictions_(lender, params.vehicle);
    if (!vehicleCheck.eligible && vehicleCheck.blockers.length > 0) continue;

    var payment = calculateMonthlyPayment(params.amountFinanced, tierConfig.baseRate, params.requestedTerm);
    var ltv = calculateLTV(params.amountFinanced, params.vehicleValue);
    var pti = calculatePTI(payment, params.monthlyIncome);
    var dti = calculateDTI(payment, params.monthlyDebt || 0, params.monthlyIncome);

    var approval = assessApprovalLikelihood_(tierConfig, lender, {
      ltv: ltv, pti: pti, dti: dti, vehicleAge: vehicleAge,
      vehicleMileage: params.vehicle.mileage, amountFinanced: params.amountFinanced,
      term: params.requestedTerm, downPaymentPercent: params.downPaymentPercent || 0
    }, params.credit);

    matches.push({
      lender: lender, tierConfig: tierConfig,
      baseRate: tierConfig.baseRate,
      adjustedRate: calculateAdjustedRate_(tierConfig, params),
      payment: payment, ltv: ltv, pti: pti, dti: dti,
      approvalStatus: approval.status, approvalConfidence: approval.confidence,
      warnings: approval.warnings, conditions: approval.conditions,
      vehicleWarnings: vehicleCheck.warnings
    });
  }

  matches.sort(function(a, b) {
    var co = { high: 0, medium: 1, low: 2 };
    var diff = co[a.approvalConfidence] - co[b.approvalConfidence];
    return diff !== 0 ? diff : a.adjustedRate - b.adjustedRate;
  });
  return matches;
}

function getRecommendations(params) {
  var matches = findMatchingLenders(params);
  var recs = [];
  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];
    var reasoning = [];
    var warnings = m.warnings.concat(m.vehicleWarnings);
    var suggestedAdj = [];

    if (m.approvalConfidence === 'high') reasoning.push(m.lender.name + ' has strong programs for ' + m.tierConfig.tier + ' credit');
    if (m.ltv <= m.tierConfig.maxLTV - 10) reasoning.push('LTV of ' + m.ltv.toFixed(1) + '% is well within guidelines');
    if (m.pti <= m.tierConfig.maxPTI - 2) reasoning.push('PTI of ' + m.pti.toFixed(1) + '% shows strong payment affordability');
    if (m.lender.type === 'credit-union') reasoning.push('Credit unions often offer the best rates for qualified borrowers');
    if (m.lender.id === 'gm-financial' && params.vehicle.make === 'GMC') reasoning.push('GM Financial provides enhanced terms for GMC vehicles');
    if (m.lender.type === 'subprime' && params.creditScore < 600) reasoning.push(m.lender.name + ' specializes in credit rebuilding');

    if (m.approvalStatus !== 'auto-approved') {
      if (m.ltv > m.tierConfig.maxLTV) {
        var excess = (params.amountFinanced * (m.ltv - m.tierConfig.maxLTV)) / 100;
        suggestedAdj.push({ type: 'increase-down', description: 'Increase down payment by $' + Math.round(excess), impact: 'Reduces LTV to ' + m.tierConfig.maxLTV + '%' });
      }
      if (m.pti > m.tierConfig.maxPTI) {
        suggestedAdj.push({ type: 'shorten-term', description: 'Consider extending term to lower payment', impact: 'Reduces PTI below ' + m.tierConfig.maxPTI + '%' });
      }
    }

    var buyPayment = calculateMonthlyPayment(params.amountFinanced, m.baseRate, params.requestedTerm);
    var sellPayment = calculateMonthlyPayment(params.amountFinanced, m.adjustedRate, params.requestedTerm);
    var reserveSpread = (sellPayment - buyPayment) * params.requestedTerm;

    recs.push({
      lender: m.lender,
      terms: {
        apr: m.adjustedRate, termMonths: params.requestedTerm,
        monthlyPayment: m.payment,
        totalInterest: Math.round((m.payment * params.requestedTerm - params.amountFinanced) * 100) / 100,
        totalOfPayments: Math.round(m.payment * params.requestedTerm * 100) / 100,
        lenderId: m.lender.id, lenderName: m.lender.name,
        approvalStatus: m.approvalStatus, approvalConditions: m.conditions,
        buyRate: m.baseRate, dealerReserve: Math.round(reserveSpread * 0.75 * 100) / 100,
        ltv: m.ltv, pti: m.pti, dti: m.dti
      },
      confidence: m.approvalConfidence, reasoning: reasoning,
      warnings: warnings, suggestedAdjustments: suggestedAdj
    });
  }
  return recs;
}

function findBestTierForScore_(lender, score) {
  for (var i = 0; i < lender.creditTiers.length; i++) {
    var t = lender.creditTiers[i];
    if (score >= t.minScore && (!t.maxScore || score <= t.maxScore)) return t;
  }
  var sorted = lender.creditTiers.slice().sort(function(a, b) { return b.minScore - a.minScore; });
  for (var j = 0; j < sorted.length; j++) {
    if (score >= sorted[j].minScore) return sorted[j];
  }
  return null;
}

function checkVehicleRestrictions_(lender, vehicle) {
  var warnings = [], blockers = [];
  var age = new Date().getFullYear() - vehicle.year;
  var r = lender.vehicleRestrictions;
  if (age > r.maxAge) blockers.push('Vehicle age (' + age + ' years) exceeds ' + lender.name + ' maximum of ' + r.maxAge + ' years');
  else if (age > r.maxAge - 2) warnings.push('Vehicle age (' + age + ' years) approaching ' + lender.name + ' maximum');
  if (vehicle.mileage > r.maxMileage) blockers.push('Mileage (' + vehicle.mileage + ') exceeds ' + lender.name + ' maximum of ' + r.maxMileage);
  else if (vehicle.mileage > r.maxMileage * 0.9) warnings.push('Mileage approaching ' + lender.name + ' maximum');
  if (r.excludedMakes && r.excludedMakes.indexOf(vehicle.make) >= 0) blockers.push(lender.name + ' does not finance ' + vehicle.make + ' vehicles');
  if (r.excludedClasses && r.excludedClasses.indexOf(vehicle.vehicleClass) >= 0) blockers.push(lender.name + ' does not finance ' + vehicle.vehicleClass + ' class vehicles');
  var val = (vehicle.bookValue && vehicle.bookValue.retail) || 0;
  if (r.minValue && val > 0 && val < r.minValue) blockers.push('Vehicle value ($' + val + ') below ' + lender.name + ' minimum of $' + r.minValue);
  return { eligible: blockers.length === 0, warnings: warnings, blockers: blockers };
}

function assessApprovalLikelihood_(tierConfig, lender, metrics, credit) {
  var warnings = [], conditions = [];
  var issueCount = 0, severeIssues = 0;
  if (metrics.ltv > tierConfig.maxLTV) { severeIssues++; warnings.push('LTV ' + metrics.ltv.toFixed(1) + '% exceeds max ' + tierConfig.maxLTV + '%'); }
  else if (metrics.ltv > tierConfig.maxLTV - 5) { issueCount++; warnings.push('LTV ' + metrics.ltv.toFixed(1) + '% is near maximum'); }
  if (metrics.pti > tierConfig.maxPTI) { severeIssues++; warnings.push('PTI ' + metrics.pti.toFixed(1) + '% exceeds max ' + tierConfig.maxPTI + '%'); }
  else if (metrics.pti > tierConfig.maxPTI - 2) { issueCount++; warnings.push('PTI ' + metrics.pti.toFixed(1) + '% is near maximum'); }
  if (tierConfig.maxDTI && metrics.dti > tierConfig.maxDTI) { severeIssues++; warnings.push('DTI ' + metrics.dti.toFixed(1) + '% exceeds max ' + tierConfig.maxDTI + '%'); }
  if (metrics.term > tierConfig.maxTerm) { severeIssues++; warnings.push('Requested term ' + metrics.term + ' exceeds max ' + tierConfig.maxTerm); }
  if (tierConfig.minDown && metrics.downPaymentPercent < tierConfig.minDown) { issueCount++; warnings.push('Down payment ' + metrics.downPaymentPercent.toFixed(1) + '% below min ' + tierConfig.minDown + '%'); }
  if (metrics.amountFinanced < lender.loanLimits.minAmount) { severeIssues++; warnings.push('Amount below minimum $' + lender.loanLimits.minAmount); }
  if (metrics.amountFinanced > lender.loanLimits.maxAmount) { severeIssues++; warnings.push('Amount exceeds maximum $' + lender.loanLimits.maxAmount); }
  if (credit.bankruptcyHistory) {
    if (credit.bankruptcyAge && credit.bankruptcyAge < 24) { severeIssues++; warnings.push('Recent bankruptcy (< 24 months)'); }
    else { issueCount++; conditions.push('Bankruptcy discharge documentation required'); }
  }
  if (credit.repoHistory) {
    if (credit.repoAge && credit.repoAge < 24) { severeIssues++; warnings.push('Recent repossession'); }
    else { issueCount++; conditions.push('Additional down payment may be required'); }
  }
  if (tierConfig.stipulations) conditions = conditions.concat(tierConfig.stipulations);

  var status, confidence;
  if (severeIssues > 0) { status = severeIssues > 1 ? 'likely-decline' : 'review-needed'; confidence = 'low'; }
  else if (issueCount > 2) { status = 'conditional'; confidence = 'low'; }
  else if (issueCount > 0) { status = 'conditional'; confidence = 'medium'; }
  else { status = 'auto-approved'; confidence = 'high'; }
  return { status: status, confidence: confidence, warnings: warnings, conditions: conditions };
}

function calculateAdjustedRate_(tierConfig, params) {
  var rate = tierConfig.baseRate;
  for (var i = 0; i < tierConfig.rateAdjustments.length; i++) {
    var adj = tierConfig.rateAdjustments[i];
    if (adj.condition.indexOf('mileage') >= 0 && params.vehicle.mileage > 80000) rate += adj.adjustment;
    if (adj.condition.indexOf('age') >= 0 && (new Date().getFullYear() - params.vehicle.year) > 7) rate += adj.adjustment;
    if (adj.condition.indexOf('Certified') >= 0 && params.vehicle.certified) rate += adj.adjustment;
    if (adj.condition.indexOf('down') >= 0 && (params.downPaymentPercent || 0) < 10) rate += adj.adjustment;
  }
  var maxMarkup = 2.5;
  return Math.min(rate + maxMarkup, rate * 1.4);
}
