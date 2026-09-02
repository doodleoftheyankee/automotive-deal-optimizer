// ============================================================================
// DEAL STRUCTURE OPTIMIZER
// 6 optimization areas: LTV, PTI, DTI, down payment, CPO, F&I
// Sweet spot finder, approval probability calculation
// ============================================================================

function optimizeDealForApproval(params) {
  var ficoAuto = calculateFICOAutoScore(params.credit);
  var targets = findTargetLenders_(ficoAuto, params.vehicle);
  var optimizations = generateOptimizations_(params, ficoAuto, targets);
  var sweetSpot = findSweetSpot_(params, targets);
  var probability = calculateApprovalProbability_(optimizations);

  return {
    currentAnalysis: analyzeCurrentDeal_(params, ficoAuto),
    targetLenders: targets,
    recommendations: optimizations,
    sweetSpotDeal: sweetSpot,
    approvalProbability: probability
  };
}

function findTargetLenders_(ficoAuto, vehicle) {
  var targets = [];
  var vehicleAge = new Date().getFullYear() - vehicle.year;
  var active = getActiveLenders();

  for (var i = 0; i < active.length; i++) {
    var lender = active[i];
    var tier = null;
    for (var j = 0; j < lender.creditTiers.length; j++) {
      var t = lender.creditTiers[j];
      if (ficoAuto.autoScore >= t.minScore && (!t.maxScore || ficoAuto.autoScore <= t.maxScore)) { tier = t; break; }
    }
    if (!tier) continue;
    if (vehicleAge > lender.vehicleRestrictions.maxAge) continue;
    if (vehicle.mileage > lender.vehicleRestrictions.maxMileage) continue;
    if (lender.vehicleRestrictions.excludedMakes && lender.vehicleRestrictions.excludedMakes.indexOf(vehicle.make) >= 0) continue;

    var buf = ficoAuto.autoScore - tier.minScore;
    var priority = 50;
    if (lender.type === 'credit-union') priority += 10;
    if (lender.type === 'captive' && (vehicle.make === 'GMC' || vehicle.make === 'Buick' || vehicle.make === 'Chevrolet')) priority += 20;
    priority -= tier.baseRate;
    if (vehicle.certified) priority += 5;

    targets.push({
      lender: lender, tier: tier.tier, baseRate: tier.baseRate,
      maxLTV: tier.maxLTV, maxPTI: tier.maxPTI, maxDTI: tier.maxDTI || 50,
      maxTerm: tier.maxTerm, minDownPercent: tier.minDown || 0,
      scoreBuffer: buf, likelihood: buf >= 50 ? 'Very High' : buf >= 20 ? 'High' : buf >= 0 ? 'Medium' : 'Low',
      priority: priority
    });
  }
  targets.sort(function(a, b) { return b.priority - a.priority; });
  return targets;
}

function generateOptimizations_(params, ficoAuto, targets) {
  var opts = [];
  if (targets.length === 0) {
    opts.push({ type: 'different_vehicle', priority: 'critical', title: 'Vehicle Not Financeable', description: 'No lender matches found', currentValue: params.vehicle.year + ' ' + params.vehicle.make + ' ' + params.vehicle.model, targetValue: 'Select a newer vehicle', impact: 'Required', estimatedApprovalIncrease: 0 });
    return opts;
  }
  var pt = targets[0];
  var currentLTV = calculateLTV(params.amountFinanced, params.vehicleValue);
  var currentPayment = calculateMonthlyPayment(params.amountFinanced, pt.baseRate, params.term);
  var currentPTI = calculatePTI(currentPayment, params.credit.monthlyIncome);
  var currentDTI = calculateDTI(currentPayment, params.credit.monthlyDebt || 0, params.credit.monthlyIncome);

  // LTV
  if (currentLTV > pt.maxLTV) {
    var addDown = Math.ceil(((currentLTV - pt.maxLTV) / 100) * params.vehicleValue);
    opts.push({ type: 'increase_down_payment', priority: 'critical', title: 'LTV Exceeds Maximum', description: 'LTV ' + currentLTV.toFixed(1) + '% exceeds ' + pt.maxLTV + '%', currentValue: currentLTV.toFixed(1) + '% LTV', targetValue: pt.maxLTV + '% LTV', impact: 'Add $' + addDown + ' down', estimatedApprovalIncrease: 40 });
  } else if (currentLTV > pt.maxLTV - 10) {
    opts.push({ type: 'increase_down_payment', priority: 'recommended', title: 'LTV Near Maximum', description: 'LTV ' + currentLTV.toFixed(1) + '% is near the ' + pt.maxLTV + '% limit', currentValue: currentLTV.toFixed(1) + '% LTV', targetValue: (pt.maxLTV - 10) + '% LTV', impact: 'Add buffer for auto-approval', estimatedApprovalIncrease: 15 });
  }

  // PTI
  if (currentPTI > pt.maxPTI) {
    var targetPmt = params.credit.monthlyIncome * (pt.maxPTI / 100);
    opts.push({ type: 'reduce_payment', priority: 'critical', title: 'Payment Exceeds Income Threshold', description: 'PTI ' + currentPTI.toFixed(1) + '% exceeds ' + pt.maxPTI + '%', currentValue: '$' + currentPayment.toFixed(0) + '/mo (' + currentPTI.toFixed(1) + '% PTI)', targetValue: '$' + targetPmt.toFixed(0) + '/mo (' + pt.maxPTI + '% PTI)', impact: 'Reduce payment by $' + Math.round(currentPayment - targetPmt) + '/mo', estimatedApprovalIncrease: 35 });
  }

  // DTI
  if (currentDTI > pt.maxDTI) {
    opts.push({ type: 'reduce_dti', priority: 'high', title: 'Total Debt Ratio Too High', description: 'DTI ' + currentDTI.toFixed(1) + '% exceeds ' + pt.maxDTI + '%', currentValue: currentDTI.toFixed(1) + '% DTI', targetValue: '<=' + pt.maxDTI + '% DTI', impact: 'Reduce other debts or add co-buyer income', estimatedApprovalIncrease: 25 });
  }

  // Down payment minimum
  var downPct = ((params.downPayment || 0) / params.sellingPrice) * 100;
  if (pt.minDownPercent > 0 && downPct < pt.minDownPercent) {
    var minDown = Math.ceil(params.sellingPrice * (pt.minDownPercent / 100));
    opts.push({ type: 'increase_down_payment', priority: 'critical', title: 'Minimum Down Payment Required', description: pt.lender.name + ' requires ' + pt.minDownPercent + '% down', currentValue: '$' + (params.downPayment || 0) + ' (' + downPct.toFixed(1) + '%)', targetValue: '$' + minDown + ' (' + pt.minDownPercent + '%)', impact: 'Add $' + (minDown - (params.downPayment || 0)), estimatedApprovalIncrease: 35 });
  }

  // CPO
  if (!params.vehicle.certified && (params.vehicle.make === 'GMC' || params.vehicle.make === 'Buick')) {
    opts.push({ type: 'certify_vehicle', priority: 'recommended', title: 'Consider GM Certification', description: 'GM CPO can reduce rate by 0.5-0.75% and increase max LTV', currentValue: 'Non-certified', targetValue: 'GM Certified Pre-Owned', impact: 'Better rate and approval odds', estimatedApprovalIncrease: 8 });
  }

  // F&I
  if (params.fiProducts && params.fiProducts.length > 0) {
    var backendTotal = 0;
    for (var k = 0; k < params.fiProducts.length; k++) backendTotal += params.fiProducts[k].sellPrice;
    if (currentLTV > pt.maxLTV - 5 || currentPTI > pt.maxPTI - 2) {
      opts.push({ type: 'reduce_backend', priority: 'recommended', title: 'Consider Reducing Backend Products', description: '$' + backendTotal + ' in F&I products is adding to LTV/PTI', currentValue: '$' + backendTotal + ' financed products', targetValue: 'Sell for cash or reduce', impact: 'Improves LTV and payment ratios', estimatedApprovalIncrease: 10 });
    }
  }

  opts.sort(function(a, b) {
    var po = { critical: 0, high: 1, recommended: 2, optional: 3 };
    return po[a.priority] - po[b.priority];
  });
  return opts;
}

function findSweetSpot_(params, targets) {
  if (targets.length === 0) return { achievable: false, reason: 'No lenders available' };
  var pt = targets[0];
  var targetLTV = pt.maxLTV - 10;
  var targetPTI = pt.maxPTI - 3;
  var maxFinanced = params.vehicleValue * (targetLTV / 100);
  var idealDown = Math.max(0, params.sellingPrice + (params.fees || 0) + (params.fiFinanced || 0) - maxFinanced);
  var idealPayment = calculateMonthlyPayment(maxFinanced, pt.baseRate, params.term);
  var resultPTI = calculatePTI(idealPayment, params.credit.monthlyIncome);

  var adjTerm = params.term, adjPayment = idealPayment, adjDown = idealDown;
  if (resultPTI > targetPTI) {
    for (var term = params.term; term <= pt.maxTerm; term += 6) {
      var tp = calculateMonthlyPayment(maxFinanced, pt.baseRate, term);
      if (calculatePTI(tp, params.credit.monthlyIncome) <= targetPTI) { adjTerm = term; adjPayment = tp; break; }
    }
    if (calculatePTI(adjPayment, params.credit.monthlyIncome) > targetPTI) {
      var targetPmt = params.credit.monthlyIncome * (targetPTI / 100);
      var maxP = calculatePrincipalFromPayment(targetPmt, pt.baseRate, pt.maxTerm);
      adjDown = params.sellingPrice + (params.fees || 0) - maxP;
      adjTerm = pt.maxTerm; adjPayment = targetPmt;
    }
  }
  var finalAF = params.sellingPrice + (params.fees || 0) + (params.fiFinanced || 0) - adjDown;
  var finalLTV = calculateLTV(finalAF, params.vehicleValue);
  var finalPTI = calculatePTI(adjPayment, params.credit.monthlyIncome);

  return {
    achievable: true, targetLender: pt.lender.name,
    structure: { sellingPrice: params.sellingPrice, downPayment: Math.ceil(adjDown), term: adjTerm, apr: pt.baseRate, monthlyPayment: Math.round(adjPayment * 100) / 100, amountFinanced: Math.round(finalAF * 100) / 100 },
    metrics: { ltv: Math.round(finalLTV * 10) / 10, pti: Math.round(finalPTI * 10) / 10, targetLTV: targetLTV, targetPTI: targetPTI },
    comparison: { downPaymentDiff: Math.ceil(adjDown) - (params.downPayment || 0), termDiff: adjTerm - params.term },
    approvalProbability: 90
  };
}

function analyzeCurrentDeal_(params, ficoAuto) {
  var payment = calculateMonthlyPayment(params.amountFinanced, 8, params.term);
  var ltv = calculateLTV(params.amountFinanced, params.vehicleValue);
  var pti = calculatePTI(payment, params.credit.monthlyIncome);
  var dti = calculateDTI(payment, params.credit.monthlyDebt || 0, params.credit.monthlyIncome);
  var issues = [], strengths = [];
  if (ltv > 120) issues.push('LTV over 120%');
  if (pti > 18) issues.push('PTI over 18%');
  if (dti > 50) issues.push('DTI over 50%');
  if (ficoAuto.autoScore < 600) issues.push('Sub-600 score requires specialist lenders');
  if (ltv <= 100) strengths.push('Strong LTV - equity in deal');
  if (pti <= 12) strengths.push('Low PTI - very affordable');
  if (ficoAuto.autoScore >= 720) strengths.push('Prime credit tier');
  if (params.credit.timeOnJob && params.credit.timeOnJob >= 24) strengths.push('Strong job stability');
  return { ficoAutoScore: ficoAuto.autoScore, riskTier: ficoAuto.riskTier, currentLTV: ltv, currentPTI: pti, currentDTI: dti, currentPayment: payment, issues: issues, strengths: strengths };
}

function calculateApprovalProbability_(optimizations) {
  var critical = optimizations.filter(function(o) { return o.priority === 'critical'; });
  var high = optimizations.filter(function(o) { return o.priority === 'high'; });
  var current = 50, potential = 95;
  if (critical.length === 0) { current = 70; if (high.length === 0) { current = 85; if (optimizations.filter(function(o) { return o.priority === 'recommended'; }).length <= 1) current = 95; } }
  else current = 20;
  if (critical.length > 2) potential = 75;
  return {
    currentAsStructured: current, ifOptimized: potential,
    criticalIssues: critical.length, highIssues: high.length,
    recommendation: critical.length > 0 ? 'RESTRUCTURE REQUIRED' : high.length > 0 ? 'GOOD ODDS - Address high priority items' : 'EXCELLENT ODDS - Deal is optimized'
  };
}
