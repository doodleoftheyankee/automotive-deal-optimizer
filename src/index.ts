// ============================================================================
// UNIFIED AUTOMOTIVE DEAL OPTIMIZER
// Main Entry Point - ERA Ignite Style F&I Desking Tool
// ============================================================================

// Export Types
export * from './types';

// Export Calculators
export {
  calculateMonthlyPayment,
  calculatePayment,
  calculateAmountFinanced,
  calculateLTV,
  calculatePTI,
  calculateDTI,
  calculatePrincipalFromPayment,
  calculateRateFromPayment,
  calculateTermFromPayment,
  calculateDownForTargetLTV,
  calculateFIProfit,
  calculateDealerReserve,
  calculateDealProfit,
  generateAmortizationSchedule,
} from './calculators/payment';

// Export Deal Desking
export {
  DealDesk,
  defaultFees,
  stateFeesConfig,
  standardFIProducts,
} from './desking/deal-desk';

// Export Lender Matcher
export {
  LenderMatcher,
  lenderMatcher,
} from './optimizer/lender-matcher';

// Export Lender Configuration
export {
  lenders,
  getLenderById,
  getActiveLenders,
  getLendersByType,
  getLendersForCreditTier,
  getCreditTierForScore,
} from './config/lenders';

// Export Vehicle Manager
export {
  VehicleManager,
  vehicleManager,
  estimateBookValues,
  determineVehicleClass,
} from './inventory/vehicle-manager';

// Export Approval Optimizer
export {
  AutoDecisioningEngine,
  autoDecisioningEngine,
  calculateFICOAutoScore,
  getAutoApprovalThresholds,
} from './approval/auto-approval-engine';

export {
  DealStructureOptimizer,
  dealStructureOptimizer,
} from './approval/deal-structure-optimizer';

// ============================================================================
// QUICK START FUNCTIONS
// ============================================================================

import { Vehicle, CreditProfile, DealStructure } from './types';
import { DealDesk } from './desking/deal-desk';
import { LenderMatcher } from './optimizer/lender-matcher';
import { getCreditTierForScore } from './config/lenders';
import { estimateBookValues, determineVehicleClass } from './inventory/vehicle-manager';

/**
 * Quick deal analysis - all-in-one function for simple deal evaluation
 */
export function analyzeDeal(params: {
  // Vehicle
  vehicleYear: number;
  vehicleMake: string;
  vehicleModel: string;
  vehicleMileage: number;
  vehicleCondition?: 'excellent' | 'good' | 'fair' | 'poor';
  certified?: boolean;

  // Pricing
  sellingPrice: number;
  tradeValue?: number;
  tradePayoff?: number;
  cashDown?: number;
  rebates?: number;

  // Customer
  creditScore: number;
  monthlyIncome: number;
  monthlyDebt?: number;
  customerState?: string;

  // Loan
  requestedTerm?: number;
}) {
  const {
    vehicleYear,
    vehicleMake,
    vehicleModel,
    vehicleMileage,
    vehicleCondition = 'good',
    certified = false,
    sellingPrice,
    tradeValue = 0,
    tradePayoff = 0,
    cashDown = 0,
    rebates = 0,
    creditScore,
    monthlyIncome,
    monthlyDebt = 0,
    customerState = 'DE',
    requestedTerm = 72,
  } = params;

  // Build vehicle object
  const bookValues = estimateBookValues(
    vehicleYear,
    vehicleMake,
    vehicleModel,
    vehicleMileage,
    vehicleCondition
  );

  const vehicle: Vehicle = {
    year: vehicleYear,
    make: vehicleMake,
    model: vehicleModel,
    mileage: vehicleMileage,
    condition: vehicleCondition,
    certified,
    vehicleClass: determineVehicleClass(vehicleMake, vehicleModel),
    bookValue: bookValues,
  };

  // Build credit profile
  const credit: CreditProfile = {
    score: creditScore,
    tier: getCreditTierForScore(creditScore),
    monthlyIncome,
    monthlyDebt,
  };

  // Create deal desk
  const desk = new DealDesk(vehicle, credit, customerState);
  desk
    .setSellingPrice(sellingPrice)
    .setTrade(tradeValue, tradePayoff)
    .setCashDown(cashDown)
    .setRebates(rebates);

  // Get deal metrics
  const amountFinanced = desk.getAmountFinanced();
  const vehicleValue = desk.getVehicleValue();
  const ltv = desk.getLTV();

  // Get lender recommendations
  const matcher = new LenderMatcher();
  const recommendations = matcher.getRecommendations({
    creditScore,
    credit,
    vehicle,
    amountFinanced,
    vehicleValue,
    requestedTerm,
    monthlyIncome,
    monthlyDebt,
    downPaymentPercent: (cashDown / sellingPrice) * 100,
  });

  // Return comprehensive analysis
  return {
    vehicle: {
      description: `${vehicleYear} ${vehicleMake} ${vehicleModel}`,
      mileage: vehicleMileage,
      certified,
      bookValues,
      vehicleClass: vehicle.vehicleClass,
    },
    customer: {
      creditScore,
      creditTier: credit.tier,
      monthlyIncome,
      monthlyDebt,
    },
    deal: {
      sellingPrice,
      tradeValue,
      tradePayoff,
      netTrade: tradeValue - tradePayoff,
      cashDown,
      rebates,
      salesTax: desk.getSalesTax(),
      fees: desk.getTotalFees(),
      amountFinanced,
      vehicleValue,
      ltv,
    },
    lenderRecommendations: recommendations.slice(0, 5).map((rec) => ({
      lender: rec.lender.name,
      lenderType: rec.lender.type,
      apr: rec.terms.apr,
      monthlyPayment: rec.terms.monthlyPayment,
      totalInterest: rec.terms.totalInterest,
      confidence: rec.confidence,
      status: rec.terms.approvalStatus,
      pti: rec.terms.pti,
      dti: rec.terms.dti,
      conditions: rec.terms.approvalConditions,
      warnings: rec.warnings,
    })),
    bestLender: recommendations[0]
      ? {
          name: recommendations[0].lender.name,
          apr: recommendations[0].terms.apr,
          payment: recommendations[0].terms.monthlyPayment,
          confidence: recommendations[0].confidence,
        }
      : null,
  };
}

/**
 * Compare multiple deal scenarios
 */
export function compareDealScenarios(
  baseParams: Parameters<typeof analyzeDeal>[0],
  variations: Array<{
    name: string;
    changes: Partial<Parameters<typeof analyzeDeal>[0]>;
  }>
) {
  const baseAnalysis = analyzeDeal(baseParams);

  const comparisons = variations.map((variation) => ({
    name: variation.name,
    analysis: analyzeDeal({ ...baseParams, ...variation.changes }),
  }));

  return {
    baseline: {
      name: 'Current Deal',
      ...baseAnalysis,
    },
    variations: comparisons.map((c) => ({
      name: c.name,
      ...c.analysis,
      comparedToBaseline: {
        paymentDiff: baseAnalysis.bestLender && c.analysis.bestLender
          ? c.analysis.bestLender.payment - baseAnalysis.bestLender.payment
          : null,
        rateDiff: baseAnalysis.bestLender && c.analysis.bestLender
          ? c.analysis.bestLender.apr - baseAnalysis.bestLender.apr
          : null,
        ltvDiff: c.analysis.deal.ltv - baseAnalysis.deal.ltv,
        amountFinancedDiff: c.analysis.deal.amountFinanced - baseAnalysis.deal.amountFinanced,
      },
    })),
  };
}

/**
 * Find optimal deal structure for target payment
 */
export function findOptimalDeal(params: {
  vehicleYear: number;
  vehicleMake: string;
  vehicleModel: string;
  vehicleMileage: number;
  sellingPrice: number;
  creditScore: number;
  monthlyIncome: number;
  targetPayment: number;
  maxTerm?: number;
}) {
  const { targetPayment, maxTerm = 84, ...baseParams } = params;

  const scenarios: Array<{
    cashDown: number;
    term: number;
    payment: number;
    apr: number;
    lender: string;
    meetsTarget: boolean;
  }> = [];

  // Try different down payment amounts
  const downPayments = [0, 1000, 2000, 3000, 5000, 7500, 10000];
  const terms = [48, 60, 66, 72, 75, 84].filter((t) => t <= maxTerm);

  for (const cashDown of downPayments) {
    for (const term of terms) {
      const analysis = analyzeDeal({
        ...baseParams,
        vehicleCondition: 'good',
        cashDown,
        monthlyDebt: 0,
        customerState: 'DE',
        requestedTerm: term,
      });

      if (analysis.bestLender) {
        scenarios.push({
          cashDown,
          term,
          payment: analysis.bestLender.payment,
          apr: analysis.bestLender.apr,
          lender: analysis.bestLender.name,
          meetsTarget: analysis.bestLender.payment <= targetPayment,
        });
      }
    }
  }

  // Sort by payment (closest to target first)
  scenarios.sort(
    (a, b) =>
      Math.abs(a.payment - targetPayment) - Math.abs(b.payment - targetPayment)
  );

  const meetingTarget = scenarios.filter((s) => s.meetsTarget);
  const optimal = meetingTarget.length > 0
    ? meetingTarget.reduce((best, current) =>
        current.cashDown < best.cashDown ? current : best
      )
    : scenarios[0];

  return {
    targetPayment,
    optimal,
    allScenarios: scenarios.slice(0, 10),
    meetingTargetCount: meetingTarget.length,
    minimumDownToMeetTarget: meetingTarget.length > 0
      ? Math.min(...meetingTarget.map((s) => s.cashDown))
      : null,
  };
}
