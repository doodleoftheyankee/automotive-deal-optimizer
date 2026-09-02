// ============================================================================
// SHEET BUILDER
// ERA Ignite style Retail Worksheet, Approval Optimizer, Lenders,
// Payment Grid, Quick Calculator, and Instructions sheets
// ============================================================================

function buildRetailWorksheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Retail Worksheet');
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet('Retail Worksheet', 0);
  sheet.setColumnWidths(1, 9, 140);

  var headerStyle = SpreadsheetApp.newTextStyle().setBold(true).setFontSize(11).build();
  var titleStyle = SpreadsheetApp.newTextStyle().setBold(true).setFontSize(14).build();

  // Title
  sheet.getRange('A1:I1').merge().setValue('UNION PARK BUICK GMC - RETAIL WORKSHEET')
    .setTextStyle(titleStyle).setHorizontalAlignment('center').setBackground('#1F3864').setFontColor('white');

  // Column 1: Vehicle & Pricing (A2-C row area)
  sheet.getRange('A2:C2').merge().setValue('VEHICLE INFORMATION').setTextStyle(headerStyle).setBackground('#4472C4').setFontColor('white');
  var vehLabels = [['Year:', '', ''], ['Make:', '', ''], ['Model:', '', ''], ['Trim:', '', ''],
    ['Mileage:', '', ''], ['VIN:', '', ''], ['Stock #:', '', ''], ['Condition:', '', 'Good'],
    ['Certified:', '', 'No'], ['State:', '', 'DE']];
  sheet.getRange('A3:C12').setValues(vehLabels);
  sheet.getRange('A3:A12').setFontWeight('bold');
  sheet.getRange('B3:C12').setBackground('#FFF2CC');

  sheet.getRange('A14:C14').merge().setValue('PRICING').setTextStyle(headerStyle).setBackground('#4472C4').setFontColor('white');
  var priceLabels = [['Selling Price:', '', ''], ['Trade Value:', '', ''],
    ['Trade Payoff:', '', ''], ['Net Trade:', '', '=B16-B17'],
    ['Rebates:', '', ''], ['Cash Down:', '', '']];
  sheet.getRange('A15:C20').setValues(priceLabels);
  sheet.getRange('A15:A20').setFontWeight('bold');
  sheet.getRange('B15:B20').setBackground('#FFF2CC').setNumberFormat('$#,##0');
  sheet.getRange('C18').setNumberFormat('$#,##0');

  sheet.getRange('A22:C22').merge().setValue('TAXES & FEES').setTextStyle(headerStyle).setBackground('#4472C4').setFontColor('white');
  var feeLabels = [['Sales Tax:', '', ''], ['Doc Fee:', '', 499], ['Title Fee:', '', 55],
    ['Registration:', '', 40], ['E-Filing Fee:', '', 35], ['Total Fees:', '', '=C24+C25+C26+C27']];
  sheet.getRange('A23:C28').setValues(feeLabels);
  sheet.getRange('A23:A28').setFontWeight('bold');
  sheet.getRange('C23:C28').setNumberFormat('$#,##0');
  sheet.getRange('C23').setBackground('#FFF2CC');
  sheet.getRange('C28').setFontWeight('bold').setBackground('#D9E2F3');

  // Column 2: Credit & Loan (D-F)
  sheet.getRange('D2:F2').merge().setValue('CREDIT PROFILE').setTextStyle(headerStyle).setBackground('#548235').setFontColor('white');
  var creditLabels = [['Credit Score:', '', ''], ['Credit Tier:', '', ''], ['Monthly Income:', '', ''],
    ['Monthly Debt:', '', ''], ['Time on Job:', '', '(months)'], ['Bankruptcy:', '', 'No'],
    ['Repo History:', '', 'No']];
  sheet.getRange('D3:F9').setValues(creditLabels);
  sheet.getRange('D3:D9').setFontWeight('bold');
  sheet.getRange('E3:E9').setBackground('#E2EFDA');
  sheet.getRange('E5:E6').setNumberFormat('$#,##0');

  sheet.getRange('D11:F11').merge().setValue('LOAN TERMS').setTextStyle(headerStyle).setBackground('#548235').setFontColor('white');
  var loanLabels = [['APR:', '', '%'], ['Term:', '', 'months'], ['Amount Financed:', '', ''],
    ['Monthly Payment:', '', ''], ['Total Interest:', '', ''], ['Total of Payments:', '', '']];
  sheet.getRange('D12:F17').setValues(loanLabels);
  sheet.getRange('D12:D17').setFontWeight('bold');
  sheet.getRange('E12:E13').setBackground('#E2EFDA');
  sheet.getRange('E14:E17').setNumberFormat('$#,##0.00');
  sheet.getRange('E14:E17').setBackground('#D9E2F3');

  sheet.getRange('D19:F19').merge().setValue('KEY RATIOS').setTextStyle(headerStyle).setBackground('#548235').setFontColor('white');
  var ratioLabels = [['LTV:', '', '%'], ['PTI:', '', '%'], ['DTI:', '', '%']];
  sheet.getRange('D20:F22').setValues(ratioLabels);
  sheet.getRange('D20:D22').setFontWeight('bold');
  sheet.getRange('E20:E22').setBackground('#D9E2F3').setNumberFormat('0.0');

  sheet.getRange('D24:F24').merge().setValue('DEAL PROFIT').setTextStyle(headerStyle).setBackground('#548235').setFontColor('white');
  var profitLabels = [['Front End:', '', ''], ['Back End:', '', ''], ['Reserve:', '', ''],
    ['Total Gross:', '', '']];
  sheet.getRange('D25:F28').setValues(profitLabels);
  sheet.getRange('D25:D28').setFontWeight('bold');
  sheet.getRange('E25:E28').setNumberFormat('$#,##0').setBackground('#D9E2F3');
  sheet.getRange('E28').setFontWeight('bold');

  // Column 3: F&I Products (G-I)
  sheet.getRange('G2:I2').merge().setValue('F&I PRODUCTS').setTextStyle(headerStyle).setBackground('#BF8F00').setFontColor('white');
  sheet.getRange('G3:I3').setValues([['Product', 'Sell Price', 'Financed?']]).setFontWeight('bold').setBackground('#FFF2CC');
  for (var i = 0; i < STANDARD_FI_PRODUCTS.length; i++) {
    var row = 4 + i;
    sheet.getRange(row, 7).setValue(STANDARD_FI_PRODUCTS[i].name);
    sheet.getRange(row, 8).setValue(STANDARD_FI_PRODUCTS[i].sellPrice).setNumberFormat('$#,##0');
    sheet.getRange(row, 9).setValue('No');
  }

  sheet.getRange('G13:I13').merge().setValue('LENDER RECOMMENDATION').setTextStyle(headerStyle).setBackground('#BF8F00').setFontColor('white');
  var lenderLabels = [['Best Lender:', '', ''], ['Confidence:', '', ''], ['Buy Rate:', '', '%'],
    ['Sell Rate:', '', '%'], ['Dealer Reserve:', '', ''], ['Approval Status:', '', ''],
    ['Conditions:', '', '']];
  sheet.getRange('G14:I20').setValues(lenderLabels);
  sheet.getRange('G14:G20').setFontWeight('bold');
  sheet.getRange('H14:I20').setBackground('#FFF2CC');

  sheet.getRange('G22:I22').merge().setValue('ACTIONS').setTextStyle(headerStyle).setBackground('#BF8F00').setFontColor('white');
  sheet.getRange('G23').setValue('Use menu: Deal Optimizer >');
  sheet.getRange('G24').setValue('  Calculate Worksheet');
  sheet.getRange('G25').setValue('  Analyze Deal');
  sheet.getRange('G26').setValue('  Run Optimizer');
  sheet.getRange('G27').setValue('  Payment Grid');
  sheet.getRange('G28').setValue('  What-If Scenarios');

  sheet.setFrozenRows(1);
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sheet);
}

function buildApprovalOptimizerSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Approval Optimizer');
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet('Approval Optimizer');
  sheet.setColumnWidths(1, 6, 180);

  sheet.getRange('A1:F1').merge().setValue('DEAL STRUCTURE OPTIMIZER')
    .setFontWeight('bold').setFontSize(14).setHorizontalAlignment('center')
    .setBackground('#1F3864').setFontColor('white');

  sheet.getRange('A3:B3').merge().setValue('CURRENT ANALYSIS').setFontWeight('bold').setBackground('#4472C4').setFontColor('white');
  var labels = ['FICO Auto Score:', 'Risk Tier:', 'Current LTV:', 'Current PTI:', 'Current DTI:', 'Current Payment:', 'Issues:', 'Strengths:'];
  for (var i = 0; i < labels.length; i++) {
    sheet.getRange(4 + i, 1).setValue(labels[i]).setFontWeight('bold');
  }

  sheet.getRange('C3:D3').merge().setValue('SWEET SPOT DEAL').setFontWeight('bold').setBackground('#548235').setFontColor('white');
  var ssLabels = ['Target Lender:', 'Down Payment:', 'Term:', 'APR:', 'Monthly Payment:', 'Amount Financed:', 'LTV:', 'PTI:'];
  for (var j = 0; j < ssLabels.length; j++) {
    sheet.getRange(4 + j, 3).setValue(ssLabels[j]).setFontWeight('bold');
  }

  sheet.getRange('E3:F3').merge().setValue('APPROVAL PROBABILITY').setFontWeight('bold').setBackground('#BF8F00').setFontColor('white');
  sheet.getRange('E4').setValue('As Structured:').setFontWeight('bold');
  sheet.getRange('E5').setValue('If Optimized:').setFontWeight('bold');
  sheet.getRange('E6').setValue('Critical Issues:').setFontWeight('bold');
  sheet.getRange('E7').setValue('Recommendation:').setFontWeight('bold');

  sheet.getRange('A14:F14').merge().setValue('OPTIMIZATION RECOMMENDATIONS')
    .setFontWeight('bold').setBackground('#4472C4').setFontColor('white');
  sheet.getRange('A15:F15').setValues([['Priority', 'Area', 'Issue', 'Current', 'Target', 'Impact']])
    .setFontWeight('bold').setBackground('#D9E2F3');

  sheet.getRange('A24:F24').merge().setValue('TARGET LENDERS (Ranked by Priority)')
    .setFontWeight('bold').setBackground('#548235').setFontColor('white');
  sheet.getRange('A25:F25').setValues([['Lender', 'Tier', 'Base Rate', 'Max LTV', 'Max PTI', 'Likelihood']])
    .setFontWeight('bold').setBackground('#E2EFDA');
}

function buildLendersSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Lenders');
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet('Lenders');

  sheet.getRange('A1:H1').merge().setValue('ALL 13 LENDERS - CREDIT TIER DETAILS')
    .setFontWeight('bold').setFontSize(14).setHorizontalAlignment('center')
    .setBackground('#1F3864').setFontColor('white');

  sheet.getRange('A2:H2').setValues([['Lender', 'Type', 'Tier', 'Min Score', 'Base Rate', 'Max LTV', 'Max PTI', 'Max Term']])
    .setFontWeight('bold').setBackground('#4472C4').setFontColor('white');

  var row = 3;
  for (var i = 0; i < LENDERS.length; i++) {
    var lender = LENDERS[i];
    for (var j = 0; j < lender.creditTiers.length; j++) {
      var t = lender.creditTiers[j];
      sheet.getRange(row, 1, 1, 8).setValues([[lender.name, lender.type, t.tier, t.minScore, t.baseRate + '%', t.maxLTV + '%', t.maxPTI + '%', t.maxTerm + 'mo']]);
      if (row % 2 === 0) sheet.getRange(row, 1, 1, 8).setBackground('#F2F2F2');
      row++;
    }
  }
  sheet.autoResizeColumns(1, 8);
}

function buildPaymentGridSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Payment Grid');
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet('Payment Grid');

  sheet.getRange('A1:H1').merge().setValue('PAYMENT GRID')
    .setFontWeight('bold').setFontSize(14).setHorizontalAlignment('center')
    .setBackground('#1F3864').setFontColor('white');

  sheet.getRange('A3').setValue('Amount Financed:').setFontWeight('bold');
  sheet.getRange('B3').setBackground('#FFF2CC').setNumberFormat('$#,##0');

  var terms = [36, 48, 60, 66, 72, 75, 84];
  var rates = [4.99, 5.99, 6.99, 7.99, 8.99, 9.99, 10.99, 12.99, 14.99, 17.99, 19.99, 21.99];

  sheet.getRange('A5').setValue('APR \\ Term').setFontWeight('bold');
  for (var t = 0; t < terms.length; t++) {
    sheet.getRange(5, 2 + t).setValue(terms[t] + ' mo').setFontWeight('bold').setHorizontalAlignment('center');
  }

  for (var r = 0; r < rates.length; r++) {
    sheet.getRange(6 + r, 1).setValue(rates[r] + '%').setFontWeight('bold');
  }

  sheet.getRange('A5:H5').setBackground('#4472C4').setFontColor('white');
  sheet.autoResizeColumns(1, 8);
}

function buildQuickCalcSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Quick Calculator');
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet('Quick Calculator');

  sheet.getRange('A1:D1').merge().setValue('QUICK PAYMENT CALCULATOR')
    .setFontWeight('bold').setFontSize(14).setHorizontalAlignment('center')
    .setBackground('#1F3864').setFontColor('white');

  var labels = [['Loan Amount:', '', '', ''], ['APR (%):', '', '', ''], ['Term (months):', '', '', '']];
  sheet.getRange('A3:D5').setValues(labels);
  sheet.getRange('A3:A5').setFontWeight('bold');
  sheet.getRange('B3:B5').setBackground('#FFF2CC');

  sheet.getRange('A7:D7').merge().setValue('RESULTS').setFontWeight('bold').setBackground('#548235').setFontColor('white');
  var resultLabels = [['Monthly Payment:', '', '', ''], ['Total Interest:', '', '', ''],
    ['Total of Payments:', '', '', '']];
  sheet.getRange('A8:D10').setValues(resultLabels);
  sheet.getRange('A8:A10').setFontWeight('bold');
  sheet.getRange('B8:B10').setNumberFormat('$#,##0.00').setBackground('#D9E2F3');

  sheet.getRange('A12:D12').merge().setValue('AMORTIZATION SCHEDULE').setFontWeight('bold').setBackground('#4472C4').setFontColor('white');
  sheet.getRange('A13:D13').setValues([['Payment #', 'Payment', 'Principal', 'Interest']]).setFontWeight('bold').setBackground('#D9E2F3');

  sheet.getRange('A15').setValue('Use menu: Deal Optimizer > Quick Calculate');
  sheet.autoResizeColumns(1, 4);
}

function buildInstructionsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Instructions');
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet('Instructions');

  sheet.getRange('A1:B1').merge().setValue('AUTOMOTIVE DEAL OPTIMIZER - INSTRUCTIONS')
    .setFontWeight('bold').setFontSize(14).setHorizontalAlignment('center')
    .setBackground('#1F3864').setFontColor('white');

  var instructions = [
    ['', ''],
    ['GETTING STARTED', ''],
    ['1. Go to the Retail Worksheet tab', 'Fill in the yellow/green cells with vehicle and customer info'],
    ['2. Use the Deal Optimizer menu', 'It appears at the top of the screen after opening'],
    ['3. Click "Calculate Worksheet"', 'This fills in all calculated fields automatically'],
    ['', ''],
    ['MENU OPTIONS', ''],
    ['Calculate Worksheet', 'Reads inputs and calculates payment, LTV, PTI, DTI, and finds best lender'],
    ['Analyze Deal', 'Runs the full ADE (Automated Decisioning Engine) against all 13 lenders'],
    ['Run Approval Optimizer', 'Finds the sweet spot deal structure for auto-approval'],
    ['Quick Calculate', 'Simple payment calculator with amortization schedule'],
    ['Payment Grid', 'Generates a grid of payments across rates and terms'],
    ['', ''],
    ['WHAT-IF SCENARIOS', ''],
    ['Down Payment', 'Shows effect of different down payment amounts'],
    ['Term', 'Shows effect of different loan terms'],
    ['Price', 'Shows effect of price reductions'],
    ['Credit Score', 'Shows effect of different credit scores'],
    ['', ''],
    ['INVENTORY', ''],
    ['Import CSV', 'Imports inventory from CSV file (R&R DMS compatible)'],
    ['View Stats', 'Shows inventory summary statistics'],
    ['Clear', 'Removes all inventory data'],
    ['', ''],
    ['13 LENDERS CONFIGURED', ''],
    ['Prime/Full Spectrum', 'Ally Financial, GM Financial, Chase Auto, Wells Fargo, Bank of America, M&T Bank, PNC Bank'],
    ['Credit Unions', 'PSECU, Dexsta FCU, Citadel CU, MECU'],
    ['Subprime Specialists', 'Westlake Financial, First Help Financial'],
    ['', ''],
    ['STATES SUPPORTED', 'Delaware (5.25%), Pennsylvania (6%), Maryland (6.5%), New Jersey (6.625%)'],
    ['', ''],
    ['CREDIT TIERS', ''],
    ['Super-Prime', '750+'],
    ['Prime', '700-749'],
    ['Near-Prime', '650-699'],
    ['Subprime', '550-649'],
    ['Deep Subprime', 'Below 550']
  ];
  sheet.getRange(2, 1, instructions.length, 2).setValues(instructions);
  sheet.getRange('A3').setFontWeight('bold').setFontSize(12);
  sheet.getRange('A8').setFontWeight('bold').setFontSize(12);
  sheet.getRange('A15').setFontWeight('bold').setFontSize(12);
  sheet.getRange('A21').setFontWeight('bold').setFontSize(12);
  sheet.getRange('A25').setFontWeight('bold').setFontSize(12);
  sheet.getRange('A31').setFontWeight('bold').setFontSize(12);
  sheet.setColumnWidth(1, 250);
  sheet.setColumnWidth(2, 500);
}

function buildAllSheets() {
  buildRetailWorksheet();
  buildApprovalOptimizerSheet();
  buildLendersSheet();
  buildPaymentGridSheet();
  buildQuickCalcSheet();
  buildInstructionsSheet();
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Retail Worksheet')
  );
  SpreadsheetApp.getUi().alert('All worksheet tabs have been created!\n\nStart by filling in the Retail Worksheet, then use the Deal Optimizer menu.');
}
