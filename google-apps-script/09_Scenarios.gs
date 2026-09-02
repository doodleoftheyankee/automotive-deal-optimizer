// ============================================================================
// WHAT-IF SCENARIO ANALYSIS
// Down payment, term, price, and credit score variations
// ============================================================================

function runWhatIfDownPayment(baseConfig, additionalAmounts) {
  var results = [];
  for (var i = 0; i < additionalAmounts.length; i++) {
    var newDown = baseConfig.cashDown + additionalAmounts[i];
    results.push(analyzeWhatIfChange_(baseConfig, '+$' + additionalAmounts[i] + ' down', { cashDown: newDown }));
  }
  return results;
}

function runWhatIfTerm(baseConfig, terms) {
  var results = [];
  for (var i = 0; i < terms.length; i++) {
    results.push(analyzeWhatIfChange_(baseConfig, terms[i] + ' month term', { term: terms[i] }));
  }
  return results;
}

function runWhatIfPrice(baseConfig, reductions) {
  var results = [];
  for (var i = 0; i < reductions.length; i++) {
    var newPrice = baseConfig.sellingPrice - reductions[i];
    results.push(analyzeWhatIfChange_(baseConfig, '-$' + reductions[i] + ' price', { sellingPrice: newPrice }));
  }
  return results;
}

function runWhatIfCreditScore(baseConfig, scores) {
  var results = [];
  for (var i = 0; i < scores.length; i++) {
    var newCredit = JSON.parse(JSON.stringify(baseConfig.credit));
    newCredit.score = scores[i];
    newCredit.tier = getCreditTierForScore(scores[i]);
    results.push(analyzeWhatIfChangeWithCredit_(baseConfig, scores[i] + ' credit score', {}, newCredit));
  }
  return results;
}

function analyzeWhatIfChange_(baseConfig, description, changes) {
  return analyzeWhatIfChangeWithCredit_(baseConfig, description, changes, baseConfig.credit);
}

function analyzeWhatIfChangeWithCredit_(baseConfig, description, changes, credit) {
  var config = JSON.parse(JSON.stringify(baseConfig));
  var keys = Object.keys(changes);
  for (var i = 0; i < keys.length; i++) config[keys[i]] = changes[keys[i]];

  var vehicle = config.vehicle;
  var bookValue = estimateBookValues(vehicle.year, vehicle.make, vehicle.model, vehicle.mileage, 'good');
  vehicle.bookValue = bookValue;
  vehicle.vehicleClass = determineVehicleClass(vehicle.make, vehicle.model);

  var desk = createDealDesk(vehicle, credit, config.customerState || 'DE');
  desk.setSellingPrice(config.sellingPrice)
    .setTrade(config.tradeValue || 0, config.tradePayoff || 0)
    .setCashDown(config.cashDown || 0)
    .setRebates(config.rebates || 0);

  var amountFinanced = desk.getAmountFinanced();
  var vehicleValue = desk.getVehicleValue();
  var term = config.term || 72;

  var recs = getRecommendations({
    creditScore: credit.score, credit: credit, vehicle: vehicle,
    amountFinanced: amountFinanced, vehicleValue: vehicleValue,
    requestedTerm: term, monthlyIncome: credit.monthlyIncome,
    monthlyDebt: credit.monthlyDebt || 0,
    downPaymentPercent: ((config.cashDown || 0) / config.sellingPrice) * 100
  });

  var bestRec = recs.length > 0 ? recs[0] : null;
  return {
    description: description,
    amountFinanced: amountFinanced,
    ltv: desk.getLTV(),
    bestLender: bestRec ? {
      name: bestRec.lender.name, apr: bestRec.terms.apr,
      payment: bestRec.terms.monthlyPayment, confidence: bestRec.confidence
    } : null
  };
}
