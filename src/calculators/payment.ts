// ============================================================================
// PAYMENT CALCULATOR
// Core financial calculations for automotive deals
// ============================================================================

import {
  PaymentCalculation,
  AmortizationEntry,
  DealStructure,
  DealFees,
  FIProduct,
} from '../types';

/**
 * Calculate monthly payment using standard amortization formula
 * PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
 */
export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (principal <= 0) return 0;
  if (termMonths <= 0) return principal;
  if (annualRate <= 0) return principal / termMonths;

  const monthlyRate = annualRate / 100 / 12;
  const factor = Math.pow(1 + monthlyRate, termMonths);
  const payment = principal * (monthlyRate * factor) / (factor - 1);

  return Math.round(payment * 100) / 100;
}

/**
 * Full payment calculation with amortization
 */
export function calculatePayment(
  principal: number,
  annualRate: number,
  termMonths: number,
  includeAmortization: boolean = false
): PaymentCalculation {
  const monthlyPayment = calculateMonthlyPayment(principal, annualRate, termMonths);
  const totalOfPayments = monthlyPayment * termMonths;
  const totalInterest = totalOfPayments - principal;

  const result: PaymentCalculation = {
    principal,
    apr: annualRate,
    termMonths,
    monthlyPayment,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalOfPayments: Math.round(totalOfPayments * 100) / 100,
  };

  if (includeAmortization) {
    result.amortizationSchedule = generateAmortizationSchedule(
      principal,
      annualRate,
      termMonths,
      monthlyPayment
    );
  }

  return result;
}

/**
 * Generate full amortization schedule
 */
export function generateAmortizationSchedule(
  principal: number,
  annualRate: number,
  termMonths: number,
  monthlyPayment: number
): AmortizationEntry[] {
  const schedule: AmortizationEntry[] = [];
  const monthlyRate = annualRate / 100 / 12;
  let balance = principal;

  for (let i = 1; i <= termMonths; i++) {
    const interestPortion = balance * monthlyRate;
    const principalPortion = monthlyPayment - interestPortion;
    balance -= principalPortion;

    // Handle final payment rounding
    if (i === termMonths) {
      balance = 0;
    }

    schedule.push({
      paymentNumber: i,
      paymentAmount: Math.round(monthlyPayment * 100) / 100,
      principalPortion: Math.round(principalPortion * 100) / 100,
      interestPortion: Math.round(interestPortion * 100) / 100,
      remainingBalance: Math.round(Math.max(0, balance) * 100) / 100,
    });
  }

  return schedule;
}

/**
 * Calculate amount financed from deal structure
 */
export function calculateAmountFinanced(deal: DealStructure): number {
  const { sellingPrice, tradeValue = 0, tradePayoff = 0, rebates = 0, cashDown, fees, fiProducts } = deal;

  // Calculate net trade
  const netTrade = tradeValue - tradePayoff;

  // Calculate taxable amount (varies by state)
  const taxableAmount = sellingPrice - netTrade - rebates;

  // Calculate sales tax
  const totalTaxRate = fees.stateTaxRate + (fees.localTaxRate || 0);
  const salesTax = Math.max(0, taxableAmount * (totalTaxRate / 100));

  // Sum up fees
  const totalFees =
    fees.docFee +
    fees.titleFee +
    fees.registrationFee +
    (fees.inspectionFee || 0) +
    (fees.electronicFilingFee || 0) +
    (fees.dealerConveyanceFee || 0) +
    (fees.luxuryTax || 0);

  // Calculate financed F&I products
  const financedProducts = fiProducts
    .filter((p) => p.financed)
    .reduce((sum, p) => sum + p.sellPrice, 0);

  // Total cash price
  const totalCashPrice = sellingPrice + salesTax + totalFees + financedProducts - netTrade;

  // Amount financed
  const amountFinanced = totalCashPrice - cashDown;

  return Math.round(amountFinanced * 100) / 100;
}

/**
 * Calculate LTV (Loan to Value) ratio
 */
export function calculateLTV(amountFinanced: number, vehicleValue: number): number {
  if (vehicleValue <= 0) return 0;
  return Math.round((amountFinanced / vehicleValue) * 10000) / 100;
}

/**
 * Calculate PTI (Payment to Income) ratio
 */
export function calculatePTI(monthlyPayment: number, monthlyIncome: number): number {
  if (monthlyIncome <= 0) return 100;
  return Math.round((monthlyPayment / monthlyIncome) * 10000) / 100;
}

/**
 * Calculate DTI (Debt to Income) ratio
 */
export function calculateDTI(
  monthlyPayment: number,
  existingDebt: number,
  monthlyIncome: number
): number {
  if (monthlyIncome <= 0) return 100;
  const totalDebt = monthlyPayment + existingDebt;
  return Math.round((totalDebt / monthlyIncome) * 10000) / 100;
}

/**
 * Calculate the principal needed for a target payment
 * Reverse payment calculation
 */
export function calculatePrincipalFromPayment(
  targetPayment: number,
  annualRate: number,
  termMonths: number
): number {
  if (targetPayment <= 0) return 0;
  if (annualRate <= 0) return targetPayment * termMonths;

  const monthlyRate = annualRate / 100 / 12;
  const factor = Math.pow(1 + monthlyRate, termMonths);
  const principal = targetPayment * (factor - 1) / (monthlyRate * factor);

  return Math.round(principal * 100) / 100;
}

/**
 * Calculate the rate needed for a target payment
 * Uses iterative approximation
 */
export function calculateRateFromPayment(
  principal: number,
  targetPayment: number,
  termMonths: number,
  tolerance: number = 0.001
): number {
  if (principal <= 0 || targetPayment <= 0) return 0;

  // Initial guess
  let rate = 6.0;
  let iteration = 0;
  const maxIterations = 100;

  while (iteration < maxIterations) {
    const calculatedPayment = calculateMonthlyPayment(principal, rate, termMonths);
    const diff = calculatedPayment - targetPayment;

    if (Math.abs(diff) < tolerance) {
      break;
    }

    // Adjust rate
    rate += diff > 0 ? -0.1 : 0.1;
    iteration++;
  }

  return Math.round(rate * 100) / 100;
}

/**
 * Calculate the term needed for a target payment
 */
export function calculateTermFromPayment(
  principal: number,
  annualRate: number,
  targetPayment: number
): number {
  if (principal <= 0 || targetPayment <= 0) return 0;
  if (annualRate <= 0) return Math.ceil(principal / targetPayment);

  const monthlyRate = annualRate / 100 / 12;

  // n = ln(PMT / (PMT - P*r)) / ln(1+r)
  const numerator = Math.log(targetPayment / (targetPayment - principal * monthlyRate));
  const denominator = Math.log(1 + monthlyRate);
  const term = numerator / denominator;

  return Math.ceil(term);
}

/**
 * Calculate down payment needed for target LTV
 */
export function calculateDownForTargetLTV(
  sellingPrice: number,
  vehicleValue: number,
  fees: number,
  targetLTV: number
): number {
  const maxFinanced = vehicleValue * (targetLTV / 100);
  const totalOwed = sellingPrice + fees;
  const downNeeded = totalOwed - maxFinanced;

  return Math.max(0, Math.round(downNeeded * 100) / 100);
}

/**
 * Calculate F&I product profit
 */
export function calculateFIProfit(products: FIProduct[]): {
  totalCost: number;
  totalSell: number;
  totalProfit: number;
  byProduct: Array<{ name: string; profit: number }>;
} {
  const byProduct = products.map((p) => ({
    name: p.name,
    profit: p.sellPrice - p.cost,
  }));

  const totalCost = products.reduce((sum, p) => sum + p.cost, 0);
  const totalSell = products.reduce((sum, p) => sum + p.sellPrice, 0);

  return {
    totalCost,
    totalSell,
    totalProfit: totalSell - totalCost,
    byProduct,
  };
}

/**
 * Calculate dealer reserve (rate markup profit)
 */
export function calculateDealerReserve(
  amountFinanced: number,
  buyRate: number,
  sellRate: number,
  termMonths: number
): number {
  const buyPayment = calculateMonthlyPayment(amountFinanced, buyRate, termMonths);
  const sellPayment = calculateMonthlyPayment(amountFinanced, sellRate, termMonths);
  const monthlySpread = sellPayment - buyPayment;

  // Typical reserve calculation (flat amount based on spread)
  // Many lenders pay approximately 75% of the interest spread
  const totalSpread = monthlySpread * termMonths;
  const reserve = totalSpread * 0.75;

  return Math.round(reserve * 100) / 100;
}

/**
 * Calculate total deal profit
 */
export function calculateDealProfit(
  frontEndGross: number,
  fiProfit: number,
  dealerReserve: number,
  packAmount: number = 0
): {
  frontEnd: number;
  backEnd: number;
  total: number;
  perCopy: number;
} {
  const backEnd = fiProfit + dealerReserve;
  const total = frontEndGross - packAmount + backEnd;

  return {
    frontEnd: frontEndGross - packAmount,
    backEnd,
    total,
    perCopy: total,
  };
}
