// ============================================================================
// FINANCIAL CALCULATORS
// Core payment, amortization, LTV, PTI, DTI, reserve, profit calculations
// ============================================================================

function calculateMonthlyPayment(principal, annualRate, termMonths) {
  if (principal <= 0) return 0;
  if (termMonths <= 0) return principal;
  if (annualRate <= 0) return Math.round(principal / termMonths * 100) / 100;
  var monthlyRate = annualRate / 100 / 12;
  var factor = Math.pow(1 + monthlyRate, termMonths);
  return Math.round(principal * (monthlyRate * factor) / (factor - 1) * 100) / 100;
}

function calculatePayment(principal, annualRate, termMonths, includeAmortization) {
  var monthlyPayment = calculateMonthlyPayment(principal, annualRate, termMonths);
  var totalOfPayments = Math.round(monthlyPayment * termMonths * 100) / 100;
  var totalInterest = Math.round((totalOfPayments - principal) * 100) / 100;
  var result = {
    principal: principal, apr: annualRate, termMonths: termMonths,
    monthlyPayment: monthlyPayment, totalInterest: totalInterest, totalOfPayments: totalOfPayments
  };
  if (includeAmortization) {
    result.amortizationSchedule = generateAmortizationSchedule(principal, annualRate, termMonths, monthlyPayment);
  }
  return result;
}

function generateAmortizationSchedule(principal, annualRate, termMonths, monthlyPayment) {
  var schedule = [];
  var monthlyRate = annualRate / 100 / 12;
  var balance = principal;
  for (var i = 1; i <= termMonths; i++) {
    var interestPortion = balance * monthlyRate;
    var principalPortion = monthlyPayment - interestPortion;
    balance -= principalPortion;
    if (i === termMonths) balance = 0;
    schedule.push({
      paymentNumber: i,
      paymentAmount: Math.round(monthlyPayment * 100) / 100,
      principalPortion: Math.round(principalPortion * 100) / 100,
      interestPortion: Math.round(interestPortion * 100) / 100,
      remainingBalance: Math.round(Math.max(0, balance) * 100) / 100
    });
  }
  return schedule;
}

function calculateAmountFinanced(sellingPrice, tradeValue, tradePayoff, rebates, cashDown, fees, fiProducts) {
  tradeValue = tradeValue || 0;
  tradePayoff = tradePayoff || 0;
  rebates = rebates || 0;
  var netTrade = tradeValue - tradePayoff;
  var taxableAmount = sellingPrice - netTrade - rebates;
  var totalTaxRate = fees.stateTaxRate + (fees.localTaxRate || 0);
  var salesTax = Math.max(0, taxableAmount * (totalTaxRate / 100));
  var totalFees = fees.docFee + fees.titleFee + fees.registrationFee +
    (fees.inspectionFee || 0) + (fees.electronicFilingFee || 0) +
    (fees.dealerConveyanceFee || 0) + (fees.luxuryTax || 0);
  var financedProducts = 0;
  if (fiProducts) {
    for (var i = 0; i < fiProducts.length; i++) {
      if (fiProducts[i].financed) financedProducts += fiProducts[i].sellPrice;
    }
  }
  var totalCashPrice = sellingPrice + salesTax + totalFees + financedProducts - netTrade;
  return Math.round((totalCashPrice - cashDown) * 100) / 100;
}

function calculateLTV(amountFinanced, vehicleValue) {
  if (vehicleValue <= 0) return 0;
  return Math.round((amountFinanced / vehicleValue) * 10000) / 100;
}

function calculatePTI(monthlyPayment, monthlyIncome) {
  if (monthlyIncome <= 0) return 100;
  return Math.round((monthlyPayment / monthlyIncome) * 10000) / 100;
}

function calculateDTI(monthlyPayment, existingDebt, monthlyIncome) {
  if (monthlyIncome <= 0) return 100;
  return Math.round(((monthlyPayment + existingDebt) / monthlyIncome) * 10000) / 100;
}

function calculatePrincipalFromPayment(targetPayment, annualRate, termMonths) {
  if (targetPayment <= 0) return 0;
  if (annualRate <= 0) return targetPayment * termMonths;
  var monthlyRate = annualRate / 100 / 12;
  var factor = Math.pow(1 + monthlyRate, termMonths);
  return Math.round(targetPayment * (factor - 1) / (monthlyRate * factor) * 100) / 100;
}

function calculateDealerReserve(amountFinanced, buyRate, sellRate, termMonths) {
  var buyPayment = calculateMonthlyPayment(amountFinanced, buyRate, termMonths);
  var sellPayment = calculateMonthlyPayment(amountFinanced, sellRate, termMonths);
  var totalSpread = (sellPayment - buyPayment) * termMonths;
  return Math.round(totalSpread * 0.75 * 100) / 100;
}

function calculateDealProfit(frontEndGross, fiProfit, dealerReserve, packAmount) {
  packAmount = packAmount || 0;
  var backEnd = fiProfit + dealerReserve;
  var total = frontEndGross - packAmount + backEnd;
  return { frontEnd: frontEndGross - packAmount, backEnd: backEnd, total: total, perCopy: total };
}

function calculateFIProfit(products) {
  var totalCost = 0, totalSell = 0;
  var byProduct = [];
  for (var i = 0; i < products.length; i++) {
    totalCost += products[i].cost;
    totalSell += products[i].sellPrice;
    byProduct.push({ name: products[i].name, profit: products[i].sellPrice - products[i].cost });
  }
  return { totalCost: totalCost, totalSell: totalSell, totalProfit: totalSell - totalCost, byProduct: byProduct };
}
