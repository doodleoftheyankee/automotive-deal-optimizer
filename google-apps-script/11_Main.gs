// ============================================================================
// MAIN - Menu system, worksheet actions, all handlers
// ============================================================================

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Deal Optimizer')
    .addItem('Calculate Worksheet', 'calculateWorksheet')
    .addItem('Analyze Deal (ADE)', 'analyzeDeal')
    .addItem('Run Approval Optimizer', 'runApprovalOptimizer')
    .addSeparator()
    .addItem('Quick Calculate', 'quickCalculate')
    .addItem('Payment Grid', 'generatePaymentGridAction')
    .addSeparator()
    .addSubMenu(ui.createMenu('What-If Scenarios')
      .addItem('Down Payment Variations', 'whatIfDownPayment')
      .addItem('Term Variations', 'whatIfTerm')
      .addItem('Price Variations', 'whatIfPrice')
      .addItem('Credit Score Variations', 'whatIfCreditScore'))
    .addSeparator()
    .addSubMenu(ui.createMenu('Inventory')
      .addItem('Import from CSV', 'importInventoryCSVAction')
      .addItem('View Stats', 'viewInventoryStats')
      .addItem('Clear Inventory', 'clearInventoryAction'))
    .addSeparator()
    .addItem('Build All Sheets', 'buildAllSheets')
    .addToUi();
}

function readDealInputs_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Retail Worksheet');
  if (!sheet) { SpreadsheetApp.getUi().alert('Please build worksheets first (Deal Optimizer > Build All Sheets)'); return null; }

  var year = Number(sheet.getRange('B3').getValue()) || new Date().getFullYear();
  var make = String(sheet.getRange('B4').getValue()) || 'GMC';
  var model = String(sheet.getRange('B5').getValue()) || 'Sierra';
  var trim = String(sheet.getRange('B6').getValue()) || '';
  var mileage = Number(sheet.getRange('B7').getValue()) || 0;
  var vin = String(sheet.getRange('B8').getValue()) || '';
  var stockNum = String(sheet.getRange('B9').getValue()) || '';
  var condition = String(sheet.getRange('C10').getValue()).toLowerCase() || 'good';
  var certified = String(sheet.getRange('C11').getValue()).toLowerCase() === 'yes';
  var state = String(sheet.getRange('C12').getValue()) || 'DE';

  var sellingPrice = Number(sheet.getRange('B15').getValue()) || 0;
  var tradeValue = Number(sheet.getRange('B16').getValue()) || 0;
  var tradePayoff = Number(sheet.getRange('B17').getValue()) || 0;
  var rebates = Number(sheet.getRange('B19').getValue()) || 0;
  var cashDown = Number(sheet.getRange('B20').getValue()) || 0;

  var creditScore = Number(sheet.getRange('E3').getValue()) || 700;
  var monthlyIncome = Number(sheet.getRange('E5').getValue()) || 5000;
  var monthlyDebt = Number(sheet.getRange('E6').getValue()) || 0;
  var timeOnJob = Number(sheet.getRange('E7').getValue()) || 24;
  var bankruptcy = String(sheet.getRange('E8').getValue()).toLowerCase() === 'yes';
  var repoHistory = String(sheet.getRange('E9').getValue()).toLowerCase() === 'yes';

  var apr = Number(sheet.getRange('E12').getValue()) || 0;
  var term = Number(sheet.getRange('E13').getValue()) || 72;

  var bookValue = estimateBookValues(year, make, model, mileage, condition);
  var vehicleClass = determineVehicleClass(make, model);

  var vehicle = {
    year: year, make: make, model: model, trim: trim, vin: vin,
    mileage: mileage, condition: condition, certified: certified,
    vehicleClass: vehicleClass, bookValue: bookValue
  };

  var credit = {
    score: creditScore, tier: getCreditTierForScore(creditScore),
    monthlyIncome: monthlyIncome, monthlyDebt: monthlyDebt,
    timeOnJob: timeOnJob, bankruptcyHistory: bankruptcy, repoHistory: repoHistory
  };

  var fiProducts = [];
  for (var i = 0; i < STANDARD_FI_PRODUCTS.length; i++) {
    var financed = String(sheet.getRange(4 + i, 9).getValue()).toLowerCase() === 'yes';
    if (financed) {
      var p = JSON.parse(JSON.stringify(STANDARD_FI_PRODUCTS[i]));
      p.financed = true;
      fiProducts.push(p);
    }
  }

  return {
    vehicle: vehicle, credit: credit, state: state,
    sellingPrice: sellingPrice, tradeValue: tradeValue, tradePayoff: tradePayoff,
    rebates: rebates, cashDown: cashDown, apr: apr, term: term,
    fiProducts: fiProducts
  };
}

function calculateWorksheet() {
  var inputs = readDealInputs_();
  if (!inputs) return;

  var desk = createDealDesk(inputs.vehicle, inputs.credit, inputs.state);
  desk.setSellingPrice(inputs.sellingPrice)
    .setTrade(inputs.tradeValue, inputs.tradePayoff)
    .setCashDown(inputs.cashDown)
    .setRebates(inputs.rebates);

  for (var i = 0; i < inputs.fiProducts.length; i++) desk.addFIProduct(inputs.fiProducts[i]);

  var amountFinanced = desk.getAmountFinanced();
  var vehicleValue = desk.getVehicleValue();
  var salesTax = desk.getSalesTax();
  var ltv = desk.getLTV();

  // Find best lender if no APR specified
  var apr = inputs.apr;
  if (!apr || apr <= 0) {
    var recs = getRecommendations({
      creditScore: inputs.credit.score, credit: inputs.credit, vehicle: inputs.vehicle,
      amountFinanced: amountFinanced, vehicleValue: vehicleValue,
      requestedTerm: inputs.term, monthlyIncome: inputs.credit.monthlyIncome,
      monthlyDebt: inputs.credit.monthlyDebt || 0,
      downPaymentPercent: inputs.sellingPrice > 0 ? (inputs.cashDown / inputs.sellingPrice) * 100 : 0
    });
    if (recs.length > 0) {
      apr = recs[0].terms.apr;
      var bestLender = recs[0];
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Retail Worksheet');
      sheet.getRange('H14').setValue(bestLender.lender.name);
      sheet.getRange('H15').setValue(bestLender.confidence);
      sheet.getRange('H16').setValue(bestLender.terms.buyRate);
      sheet.getRange('H17').setValue(bestLender.terms.apr);
      sheet.getRange('H18').setValue(bestLender.terms.dealerReserve).setNumberFormat('$#,##0');
      sheet.getRange('H19').setValue(bestLender.terms.approvalStatus);
      var condStr = bestLender.terms.approvalConditions ? bestLender.terms.approvalConditions.join(', ') : 'None';
      sheet.getRange('H20').setValue(condStr);

      // Color-code confidence
      var confColor = bestLender.confidence === 'high' ? '#92D050' : bestLender.confidence === 'medium' ? '#FFC000' : '#FF0000';
      sheet.getRange('H15').setBackground(confColor);
    } else {
      apr = 8.0;
    }
  }

  var payment = calculateMonthlyPayment(amountFinanced, apr, inputs.term);
  var totalInterest = Math.round((payment * inputs.term - amountFinanced) * 100) / 100;
  var totalOfPayments = Math.round(payment * inputs.term * 100) / 100;
  var pti = calculatePTI(payment, inputs.credit.monthlyIncome);
  var dti = calculateDTI(payment, inputs.credit.monthlyDebt || 0, inputs.credit.monthlyIncome);

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Retail Worksheet');

  // Write calculated values
  sheet.getRange('C18').setValue(inputs.tradeValue - inputs.tradePayoff);
  sheet.getRange('C23').setValue(salesTax);
  sheet.getRange('E4').setValue(inputs.credit.tier);
  sheet.getRange('E12').setValue(apr);
  sheet.getRange('E14').setValue(amountFinanced);
  sheet.getRange('E15').setValue(payment);
  sheet.getRange('E16').setValue(totalInterest);
  sheet.getRange('E17').setValue(totalOfPayments);
  sheet.getRange('E20').setValue(ltv);
  sheet.getRange('E21').setValue(pti);
  sheet.getRange('E22').setValue(dti);

  // Color-code ratios
  sheet.getRange('E20').setBackground(ltv <= 100 ? '#92D050' : ltv <= 120 ? '#FFC000' : '#FF0000');
  sheet.getRange('E21').setBackground(pti <= 12 ? '#92D050' : pti <= 16 ? '#FFC000' : '#FF0000');
  sheet.getRange('E22').setBackground(dti <= 40 ? '#92D050' : dti <= 50 ? '#FFC000' : '#FF0000');

  // F&I profit
  var fiProfit = 0;
  for (var j = 0; j < inputs.fiProducts.length; j++) {
    fiProfit += inputs.fiProducts[j].sellPrice - inputs.fiProducts[j].cost;
  }
  var frontEnd = inputs.sellingPrice - vehicleValue;
  sheet.getRange('E25').setValue(frontEnd);
  sheet.getRange('E26').setValue(fiProfit);

  SpreadsheetApp.getUi().alert('Worksheet calculated!\n\nPayment: $' + payment.toFixed(2) + '/mo\nLTV: ' + ltv.toFixed(1) + '%\nPTI: ' + pti.toFixed(1) + '%');
}

function analyzeDeal() {
  var inputs = readDealInputs_();
  if (!inputs) return;

  var desk = createDealDesk(inputs.vehicle, inputs.credit, inputs.state);
  desk.setSellingPrice(inputs.sellingPrice)
    .setTrade(inputs.tradeValue, inputs.tradePayoff)
    .setCashDown(inputs.cashDown)
    .setRebates(inputs.rebates);

  var amountFinanced = desk.getAmountFinanced();
  var vehicleValue = desk.getVehicleValue();

  var decisions = processADEApplication({
    credit: inputs.credit, vehicle: inputs.vehicle,
    amountFinanced: amountFinanced, vehicleValue: vehicleValue,
    term: inputs.term, downPayment: inputs.cashDown
  });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ADE Results');
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet('ADE Results');

  sheet.getRange('A1:H1').merge().setValue('AUTOMATED DECISIONING ENGINE - RESULTS')
    .setFontWeight('bold').setFontSize(14).setHorizontalAlignment('center')
    .setBackground('#1F3864').setFontColor('white');

  sheet.getRange('A2').setValue('Vehicle: ' + inputs.vehicle.year + ' ' + inputs.vehicle.make + ' ' + inputs.vehicle.model);
  sheet.getRange('A3').setValue('Credit Score: ' + inputs.credit.score + ' (' + inputs.credit.tier + ')  |  Amount Financed: $' + amountFinanced.toFixed(0));

  sheet.getRange('A5:H5').setValues([['Lender', 'Decision', 'Time', 'Score', 'Tier', 'Rate', 'Max Amount', 'Conditions']])
    .setFontWeight('bold').setBackground('#4472C4').setFontColor('white');

  for (var i = 0; i < decisions.length; i++) {
    var d = decisions[i];
    var row = 6 + i;
    sheet.getRange(row, 1, 1, 8).setValues([[
      d.lenderName, d.decision, d.decisionTime, d.score,
      d.tier, d.approvedRate ? d.approvedRate + '%' : 'N/A',
      d.maxApprovedAmount ? '$' + Math.round(d.maxApprovedAmount) : 'N/A',
      d.conditions.join('; ') || d.declineReasons.join('; ') || 'None'
    ]]);

    var bgColor = '#FFFFFF';
    if (d.decision === 'AUTO_APPROVED') bgColor = '#92D050';
    else if (d.decision === 'CONDITIONAL') bgColor = '#FFC000';
    else if (d.decision === 'PENDING_REVIEW') bgColor = '#FF9900';
    else if (d.decision === 'DECLINED') bgColor = '#FF0000';
    sheet.getRange(row, 2).setBackground(bgColor);
  }
  sheet.autoResizeColumns(1, 8);
  ss.setActiveSheet(sheet);
  SpreadsheetApp.getUi().alert('ADE analysis complete for ' + decisions.length + ' lenders.\n\nAuto-Approved: ' +
    decisions.filter(function(d) { return d.decision === 'AUTO_APPROVED'; }).length +
    '\nConditional: ' + decisions.filter(function(d) { return d.decision === 'CONDITIONAL'; }).length +
    '\nDeclined: ' + decisions.filter(function(d) { return d.decision === 'DECLINED'; }).length);
}

function runApprovalOptimizer() {
  var inputs = readDealInputs_();
  if (!inputs) return;

  var desk = createDealDesk(inputs.vehicle, inputs.credit, inputs.state);
  desk.setSellingPrice(inputs.sellingPrice).setTrade(inputs.tradeValue, inputs.tradePayoff)
    .setCashDown(inputs.cashDown).setRebates(inputs.rebates);

  var result = optimizeDealForApproval({
    credit: inputs.credit, vehicle: inputs.vehicle,
    sellingPrice: inputs.sellingPrice, amountFinanced: desk.getAmountFinanced(),
    vehicleValue: desk.getVehicleValue(), term: inputs.term,
    downPayment: inputs.cashDown, fees: desk.getTotalFees(),
    fiProducts: inputs.fiProducts, fiFinanced: desk.getFinancedProducts()
  });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Approval Optimizer');
  if (!sheet) { buildApprovalOptimizerSheet(); sheet = ss.getSheetByName('Approval Optimizer'); }

  var a = result.currentAnalysis;
  sheet.getRange('B4').setValue(a.ficoAutoScore);
  sheet.getRange('B5').setValue(a.riskTier);
  sheet.getRange('B6').setValue(a.currentLTV.toFixed(1) + '%');
  sheet.getRange('B7').setValue(a.currentPTI.toFixed(1) + '%');
  sheet.getRange('B8').setValue(a.currentDTI.toFixed(1) + '%');
  sheet.getRange('B9').setValue('$' + a.currentPayment.toFixed(0) + '/mo');
  sheet.getRange('B10').setValue(a.issues.join('; ') || 'None');
  sheet.getRange('B11').setValue(a.strengths.join('; ') || 'None');

  if (result.sweetSpotDeal && result.sweetSpotDeal.achievable) {
    var s = result.sweetSpotDeal;
    sheet.getRange('D4').setValue(s.targetLender);
    sheet.getRange('D5').setValue('$' + s.structure.downPayment);
    sheet.getRange('D6').setValue(s.structure.term + ' months');
    sheet.getRange('D7').setValue(s.structure.apr + '%');
    sheet.getRange('D8').setValue('$' + s.structure.monthlyPayment);
    sheet.getRange('D9').setValue('$' + Math.round(s.structure.amountFinanced));
    sheet.getRange('D10').setValue(s.metrics.ltv + '%');
    sheet.getRange('D11').setValue(s.metrics.pti + '%');
  }

  var p = result.approvalProbability;
  sheet.getRange('F4').setValue(p.currentAsStructured + '%');
  sheet.getRange('F5').setValue(p.ifOptimized + '%');
  sheet.getRange('F6').setValue(p.criticalIssues);
  sheet.getRange('F7').setValue(p.recommendation);
  sheet.getRange('F4').setBackground(p.currentAsStructured >= 70 ? '#92D050' : p.currentAsStructured >= 40 ? '#FFC000' : '#FF0000');

  // Write recommendations
  var recs = result.recommendations;
  for (var i = 0; i < Math.min(recs.length, 8); i++) {
    var row = 16 + i;
    sheet.getRange(row, 1, 1, 6).setValues([[recs[i].priority, recs[i].type, recs[i].title, recs[i].currentValue, recs[i].targetValue, recs[i].impact]]);
    var pColor = recs[i].priority === 'critical' ? '#FF0000' : recs[i].priority === 'high' ? '#FF9900' : '#FFC000';
    sheet.getRange(row, 1).setBackground(pColor).setFontColor('white');
  }

  // Write target lenders
  var targets = result.targetLenders;
  for (var j = 0; j < Math.min(targets.length, 8); j++) {
    var tRow = 26 + j;
    sheet.getRange(tRow, 1, 1, 6).setValues([[targets[j].lender.name, targets[j].tier, targets[j].baseRate + '%', targets[j].maxLTV + '%', targets[j].maxPTI + '%', targets[j].likelihood]]);
  }

  ss.setActiveSheet(sheet);
  SpreadsheetApp.getUi().alert('Approval Optimizer complete!\n\nCurrent probability: ' + p.currentAsStructured + '%\nIf optimized: ' + p.ifOptimized + '%\n\n' + p.recommendation);
}

function quickCalculate() {
  var ui = SpreadsheetApp.getUi();
  var amountStr = ui.prompt('Quick Calculator', 'Enter loan amount:', ui.ButtonSet.OK_CANCEL);
  if (amountStr.getSelectedButton() !== ui.Button.OK) return;
  var amount = parseFloat(amountStr.getResponseText().replace(/[$,]/g, ''));

  var aprStr = ui.prompt('Quick Calculator', 'Enter APR (%):', ui.ButtonSet.OK_CANCEL);
  if (aprStr.getSelectedButton() !== ui.Button.OK) return;
  var apr = parseFloat(aprStr.getResponseText());

  var termStr = ui.prompt('Quick Calculator', 'Enter term (months):', ui.ButtonSet.OK_CANCEL);
  if (termStr.getSelectedButton() !== ui.Button.OK) return;
  var term = parseInt(termStr.getResponseText());

  if (!amount || !apr || !term) { ui.alert('Invalid inputs. Please enter numbers.'); return; }

  var calc = calculatePayment(amount, apr, term, true);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Quick Calculator');
  if (!sheet) { buildQuickCalcSheet(); sheet = ss.getSheetByName('Quick Calculator'); }

  sheet.getRange('B3').setValue(amount).setNumberFormat('$#,##0');
  sheet.getRange('B4').setValue(apr);
  sheet.getRange('B5').setValue(term);
  sheet.getRange('B8').setValue(calc.monthlyPayment);
  sheet.getRange('B9').setValue(calc.totalInterest);
  sheet.getRange('B10').setValue(calc.totalOfPayments);

  if (calc.amortizationSchedule) {
    var amort = calc.amortizationSchedule;
    var maxRows = Math.min(amort.length, 84);
    for (var i = 0; i < maxRows; i++) {
      var row = 14 + i;
      sheet.getRange(row, 1, 1, 4).setValues([[amort[i].paymentNumber, amort[i].paymentAmount, amort[i].principalPortion, amort[i].interestPortion]]);
      sheet.getRange(row, 2, 1, 3).setNumberFormat('$#,##0.00');
    }
  }

  ss.setActiveSheet(sheet);
  ui.alert('Payment: $' + calc.monthlyPayment.toFixed(2) + '/mo\nTotal Interest: $' + calc.totalInterest.toFixed(2) + '\nTotal of Payments: $' + calc.totalOfPayments.toFixed(2));
}

function generatePaymentGridAction() {
  var inputs = readDealInputs_();
  if (!inputs) {
    var ui = SpreadsheetApp.getUi();
    var amtStr = ui.prompt('Payment Grid', 'Enter amount financed:', ui.ButtonSet.OK_CANCEL);
    if (amtStr.getSelectedButton() !== ui.Button.OK) return;
    var amount = parseFloat(amtStr.getResponseText().replace(/[$,]/g, ''));
    if (!amount) return;
    generatePaymentGridForAmount_(amount);
    return;
  }

  var desk = createDealDesk(inputs.vehicle, inputs.credit, inputs.state);
  desk.setSellingPrice(inputs.sellingPrice).setTrade(inputs.tradeValue, inputs.tradePayoff)
    .setCashDown(inputs.cashDown).setRebates(inputs.rebates);
  generatePaymentGridForAmount_(desk.getAmountFinanced());
}

function generatePaymentGridForAmount_(amount) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Payment Grid');
  if (!sheet) { buildPaymentGridSheet(); sheet = ss.getSheetByName('Payment Grid'); }

  sheet.getRange('B3').setValue(amount);

  var terms = [36, 48, 60, 66, 72, 75, 84];
  var rates = [4.99, 5.99, 6.99, 7.99, 8.99, 9.99, 10.99, 12.99, 14.99, 17.99, 19.99, 21.99];

  for (var r = 0; r < rates.length; r++) {
    for (var t = 0; t < terms.length; t++) {
      var pmt = calculateMonthlyPayment(amount, rates[r], terms[t]);
      sheet.getRange(6 + r, 2 + t).setValue(pmt).setNumberFormat('$#,##0');
    }
  }

  ss.setActiveSheet(sheet);
  SpreadsheetApp.getUi().alert('Payment grid generated for $' + Math.round(amount) + ' financed.');
}

function whatIfDownPayment() {
  var inputs = readDealInputs_();
  if (!inputs) return;
  var amounts = [500, 1000, 2000, 3000, 5000];
  var config = { vehicle: inputs.vehicle, credit: inputs.credit, sellingPrice: inputs.sellingPrice, tradeValue: inputs.tradeValue, tradePayoff: inputs.tradePayoff, cashDown: inputs.cashDown, rebates: inputs.rebates, term: inputs.term, customerState: inputs.state };
  var results = runWhatIfDownPayment(config, amounts);
  displayWhatIfResults_('Down Payment What-If', results);
}

function whatIfTerm() {
  var inputs = readDealInputs_();
  if (!inputs) return;
  var terms = [36, 48, 60, 66, 72, 75, 84];
  var config = { vehicle: inputs.vehicle, credit: inputs.credit, sellingPrice: inputs.sellingPrice, tradeValue: inputs.tradeValue, tradePayoff: inputs.tradePayoff, cashDown: inputs.cashDown, rebates: inputs.rebates, term: inputs.term, customerState: inputs.state };
  var results = runWhatIfTerm(config, terms);
  displayWhatIfResults_('Term What-If', results);
}

function whatIfPrice() {
  var inputs = readDealInputs_();
  if (!inputs) return;
  var reductions = [500, 1000, 1500, 2000, 3000];
  var config = { vehicle: inputs.vehicle, credit: inputs.credit, sellingPrice: inputs.sellingPrice, tradeValue: inputs.tradeValue, tradePayoff: inputs.tradePayoff, cashDown: inputs.cashDown, rebates: inputs.rebates, term: inputs.term, customerState: inputs.state };
  var results = runWhatIfPrice(config, reductions);
  displayWhatIfResults_('Price What-If', results);
}

function whatIfCreditScore() {
  var inputs = readDealInputs_();
  if (!inputs) return;
  var scores = [600, 650, 680, 700, 720, 750, 780];
  var config = { vehicle: inputs.vehicle, credit: inputs.credit, sellingPrice: inputs.sellingPrice, tradeValue: inputs.tradeValue, tradePayoff: inputs.tradePayoff, cashDown: inputs.cashDown, rebates: inputs.rebates, term: inputs.term, customerState: inputs.state };
  var results = runWhatIfCreditScore(config, scores);
  displayWhatIfResults_('Credit Score What-If', results);
}

function displayWhatIfResults_(title, results) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('What-If Results');
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet('What-If Results');

  sheet.getRange('A1:F1').merge().setValue(title.toUpperCase())
    .setFontWeight('bold').setFontSize(14).setHorizontalAlignment('center')
    .setBackground('#1F3864').setFontColor('white');

  sheet.getRange('A3:F3').setValues([['Scenario', 'Amount Financed', 'LTV', 'Best Lender', 'APR', 'Payment']])
    .setFontWeight('bold').setBackground('#4472C4').setFontColor('white');

  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    var row = 4 + i;
    sheet.getRange(row, 1, 1, 6).setValues([[
      r.description,
      '$' + Math.round(r.amountFinanced),
      r.ltv.toFixed(1) + '%',
      r.bestLender ? r.bestLender.name : 'None',
      r.bestLender ? r.bestLender.apr + '%' : 'N/A',
      r.bestLender ? '$' + r.bestLender.payment.toFixed(2) : 'N/A'
    ]]);

    if (r.bestLender) {
      var confColor = r.bestLender.confidence === 'high' ? '#92D050' : r.bestLender.confidence === 'medium' ? '#FFC000' : '#FF9900';
      sheet.getRange(row, 4).setBackground(confColor);
    }
  }

  sheet.autoResizeColumns(1, 6);
  ss.setActiveSheet(sheet);
}

function importInventoryCSVAction() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt('Import Inventory CSV',
    'Paste your CSV data below.\n\nSupports R&R DMS format with 80+ column name aliases.\nAuto-detects comma, tab, pipe, and semicolon delimiters.',
    ui.ButtonSet.OK_CANCEL);

  if (response.getSelectedButton() !== ui.Button.OK) return;
  var csvData = response.getResponseText();
  if (!csvData || csvData.trim().length < 10) { ui.alert('No CSV data provided.'); return; }

  var vehicles = parseInventoryCSV(csvData);
  if (vehicles.length === 0) { ui.alert('No vehicles could be parsed from the CSV data.\nCheck that headers match expected column names.'); return; }

  var count = saveInventoryToSheet(vehicles);
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(INVENTORY_SHEET_NAME)
  );
  ui.alert('Imported ' + count + ' vehicles to the Inventory sheet.');
}

function viewInventoryStats() {
  var stats = getInventoryStats();
  if (stats.total === 0) { SpreadsheetApp.getUi().alert('No inventory loaded. Import a CSV first.'); return; }

  var makeBreakdown = Object.keys(stats.byMake).map(function(k) { return k + ': ' + stats.byMake[k]; }).join('\n');
  SpreadsheetApp.getUi().alert(
    'INVENTORY STATISTICS\n\n' +
    'Total Vehicles: ' + stats.total + '\n' +
    'New: ' + stats.newCount + '  |  Used: ' + stats.usedCount + '  |  Certified: ' + stats.certifiedCount + '\n' +
    'Total Value: $' + stats.totalValue.toLocaleString() + '\n' +
    'Average Price: $' + stats.averagePrice.toLocaleString() + '\n\n' +
    'BY MAKE:\n' + makeBreakdown
  );
}

function clearInventoryAction() {
  var ui = SpreadsheetApp.getUi();
  var confirm = ui.alert('Clear Inventory', 'Are you sure you want to clear all inventory data?', ui.ButtonSet.YES_NO);
  if (confirm === ui.Button.YES) {
    clearInventorySheet();
    ui.alert('Inventory cleared.');
  }
}
