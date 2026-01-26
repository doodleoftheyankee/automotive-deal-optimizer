// ============================================================================
// DEAL SCENARIO COMPARISON
// Compare multiple deal structures side-by-side
// ============================================================================

import { Vehicle, CreditProfile, DealScenario, LoanTerms } from '../types';
import { DealDesk, DealSummary } from '../desking/deal-desk';
import { LenderMatcher, MatchParams } from '../optimizer/lender-matcher';
import { getCreditTierForScore } from '../config/lenders';

// ============================================================================
// SCENARIO BUILDER
// ============================================================================

export class ScenarioBuilder {
  private scenarios: Map<string, DealScenarioConfig> = new Map();
  private baseVehicle: Vehicle | null = null;
  private baseCredit: CreditProfile | null = null;

  /**
   * Set base vehicle for all scenarios
   */
  setVehicle(vehicle: Vehicle): this {
    this.baseVehicle = vehicle;
    return this;
  }

  /**
   * Set base credit profile for all scenarios
   */
  setCredit(credit: CreditProfile): this {
    this.baseCredit = credit;
    return this;
  }

  /**
   * Add a scenario
   */
  addScenario(name: string, config: Partial<DealScenarioConfig>): this {
    this.scenarios.set(name, {
      sellingPrice: config.sellingPrice || 0,
      tradeValue: config.tradeValue || 0,
      tradePayoff: config.tradePayoff || 0,
      cashDown: config.cashDown || 0,
      rebates: config.rebates || 0,
      term: config.term || 72,
      customerState: config.customerState || 'DE',
      includeProducts: config.includeProducts || [],
    });
    return this;
  }

  /**
   * Build and compare all scenarios
   */
  compare(): ScenarioComparison {
    if (!this.baseVehicle || !this.baseCredit) {
      throw new Error('Vehicle and credit profile must be set before comparison');
    }

    const results: ScenarioResult[] = [];
    const matcher = new LenderMatcher();

    for (const [name, config] of this.scenarios) {
      const desk = new DealDesk(this.baseVehicle, this.baseCredit, config.customerState);
      desk
        .setSellingPrice(config.sellingPrice)
        .setTrade(config.tradeValue, config.tradePayoff)
        .setCashDown(config.cashDown)
        .setRebates(config.rebates);

      const amountFinanced = desk.getAmountFinanced();
      const vehicleValue = desk.getVehicleValue();

      const recommendations = matcher.getRecommendations({
        creditScore: this.baseCredit.score,
        credit: this.baseCredit,
        vehicle: this.baseVehicle,
        amountFinanced,
        vehicleValue,
        requestedTerm: config.term,
        monthlyIncome: this.baseCredit.monthlyIncome,
        monthlyDebt: this.baseCredit.monthlyDebt,
        downPaymentPercent: (config.cashDown / config.sellingPrice) * 100,
      });

      const bestRec = recommendations[0];

      results.push({
        name,
        config,
        metrics: {
          amountFinanced,
          vehicleValue,
          ltv: desk.getLTV(),
          salesTax: desk.getSalesTax(),
          totalFees: desk.getTotalFees(),
          netTrade: desk.getNetTrade(),
        },
        bestLender: bestRec
          ? {
              name: bestRec.lender.name,
              type: bestRec.lender.type,
              apr: bestRec.terms.apr,
              payment: bestRec.terms.monthlyPayment,
              totalInterest: bestRec.terms.totalInterest,
              totalOfPayments: bestRec.terms.totalOfPayments,
              confidence: bestRec.confidence,
              status: bestRec.terms.approvalStatus,
              pti: bestRec.terms.pti || 0,
              dti: bestRec.terms.dti || 0,
            }
          : null,
        allLenders: recommendations.slice(0, 5).map((r) => ({
          name: r.lender.name,
          apr: r.terms.apr,
          payment: r.terms.monthlyPayment,
          confidence: r.confidence,
        })),
      });
    }

    // Calculate comparison metrics
    const comparison = this.calculateComparison(results);

    return {
      vehicle: `${this.baseVehicle.year} ${this.baseVehicle.make} ${this.baseVehicle.model}`,
      creditScore: this.baseCredit.score,
      creditTier: this.baseCredit.tier,
      scenarios: results,
      comparison,
      recommendation: this.generateRecommendation(results),
    };
  }

  /**
   * Calculate comparison metrics between scenarios
   */
  private calculateComparison(results: ScenarioResult[]): ComparisonMetrics {
    const withLenders = results.filter((r) => r.bestLender !== null);

    if (withLenders.length === 0) {
      return {
        lowestPayment: null,
        lowestRate: null,
        lowestTotalCost: null,
        highestApprovalConfidence: null,
        lowestLTV: null,
      };
    }

    return {
      lowestPayment: withLenders.reduce((min, r) =>
        r.bestLender!.payment < (min.bestLender?.payment || Infinity) ? r : min
      ).name,
      lowestRate: withLenders.reduce((min, r) =>
        r.bestLender!.apr < (min.bestLender?.apr || Infinity) ? r : min
      ).name,
      lowestTotalCost: withLenders.reduce((min, r) =>
        r.bestLender!.totalOfPayments < (min.bestLender?.totalOfPayments || Infinity)
          ? r
          : min
      ).name,
      highestApprovalConfidence: withLenders.reduce((best, r) => {
        const confidenceRank = { high: 3, medium: 2, low: 1 };
        const currentRank = confidenceRank[r.bestLender!.confidence];
        const bestRank = confidenceRank[best.bestLender?.confidence || 'low'];
        return currentRank > bestRank ? r : best;
      }).name,
      lowestLTV: withLenders.reduce((min, r) =>
        r.metrics.ltv < min.metrics.ltv ? r : min
      ).name,
    };
  }

  /**
   * Generate recommendation based on comparison
   */
  private generateRecommendation(results: ScenarioResult[]): string {
    const withLenders = results.filter((r) => r.bestLender !== null);

    if (withLenders.length === 0) {
      return 'No lenders found for any scenario. Consider increasing down payment or reducing price.';
    }

    // Find scenario with best balance of payment and approval confidence
    const highConfidence = withLenders.filter(
      (r) => r.bestLender!.confidence === 'high'
    );

    if (highConfidence.length > 0) {
      const best = highConfidence.reduce((min, r) =>
        r.bestLender!.payment < min.bestLender!.payment ? r : min
      );
      return `Recommended: "${best.name}" - $${best.bestLender!.payment.toFixed(2)}/mo @ ${best.bestLender!.apr}% with ${best.bestLender!.name} (High approval confidence)`;
    }

    const mediumConfidence = withLenders.filter(
      (r) => r.bestLender!.confidence === 'medium'
    );

    if (mediumConfidence.length > 0) {
      const best = mediumConfidence.reduce((min, r) =>
        r.bestLender!.payment < min.bestLender!.payment ? r : min
      );
      return `Recommended: "${best.name}" - $${best.bestLender!.payment.toFixed(2)}/mo @ ${best.bestLender!.apr}% with ${best.bestLender!.name} (Medium approval confidence - stipulations may apply)`;
    }

    const lowest = withLenders.reduce((min, r) =>
      r.bestLender!.payment < min.bestLender!.payment ? r : min
    );
    return `Best available: "${lowest.name}" - $${lowest.bestLender!.payment.toFixed(2)}/mo @ ${lowest.bestLender!.apr}% with ${lowest.bestLender!.name} (Low confidence - additional documentation likely required)`;
  }

  /**
   * Clear all scenarios
   */
  clear(): this {
    this.scenarios.clear();
    return this;
  }
}

// ============================================================================
// WHAT-IF ANALYSIS
// ============================================================================

export class WhatIfAnalyzer {
  private baseScenario: DealScenarioConfig;
  private vehicle: Vehicle;
  private credit: CreditProfile;

  constructor(vehicle: Vehicle, credit: CreditProfile, baseScenario: DealScenarioConfig) {
    this.vehicle = vehicle;
    this.credit = credit;
    this.baseScenario = baseScenario;
  }

  /**
   * What if we increase down payment?
   */
  whatIfMoreDown(additionalDown: number[]): WhatIfResult[] {
    return additionalDown.map((amount) => {
      const newDown = this.baseScenario.cashDown + amount;
      return this.analyzeChange(
        `+$${amount.toLocaleString()} down`,
        { cashDown: newDown }
      );
    });
  }

  /**
   * What if we extend/shorten term?
   */
  whatIfDifferentTerm(terms: number[]): WhatIfResult[] {
    return terms.map((term) =>
      this.analyzeChange(`${term} month term`, { term })
    );
  }

  /**
   * What if we reduce price?
   */
  whatIfLowerPrice(reductions: number[]): WhatIfResult[] {
    return reductions.map((amount) => {
      const newPrice = this.baseScenario.sellingPrice - amount;
      return this.analyzeChange(
        `-$${amount.toLocaleString()} price`,
        { sellingPrice: newPrice }
      );
    });
  }

  /**
   * What if credit score was different?
   */
  whatIfCreditScore(scores: number[]): WhatIfResult[] {
    return scores.map((score) => {
      const newCredit: CreditProfile = {
        ...this.credit,
        score,
        tier: getCreditTierForScore(score),
      };
      return this.analyzeChangeWithCredit(
        `${score} credit score`,
        {},
        newCredit
      );
    });
  }

  /**
   * What if we add a trade?
   */
  whatIfAddTrade(tradeValue: number, tradePayoff: number = 0): WhatIfResult {
    return this.analyzeChange(
      `Trade: $${tradeValue.toLocaleString()} value / $${tradePayoff.toLocaleString()} payoff`,
      { tradeValue, tradePayoff }
    );
  }

  /**
   * Analyze a specific change
   */
  private analyzeChange(
    description: string,
    changes: Partial<DealScenarioConfig>
  ): WhatIfResult {
    return this.analyzeChangeWithCredit(description, changes, this.credit);
  }

  private analyzeChangeWithCredit(
    description: string,
    changes: Partial<DealScenarioConfig>,
    credit: CreditProfile
  ): WhatIfResult {
    const config = { ...this.baseScenario, ...changes };
    const desk = new DealDesk(this.vehicle, credit, config.customerState);
    desk
      .setSellingPrice(config.sellingPrice)
      .setTrade(config.tradeValue, config.tradePayoff)
      .setCashDown(config.cashDown)
      .setRebates(config.rebates);

    const matcher = new LenderMatcher();
    const amountFinanced = desk.getAmountFinanced();
    const vehicleValue = desk.getVehicleValue();

    const recommendations = matcher.getRecommendations({
      creditScore: credit.score,
      credit,
      vehicle: this.vehicle,
      amountFinanced,
      vehicleValue,
      requestedTerm: config.term,
      monthlyIncome: credit.monthlyIncome,
      monthlyDebt: credit.monthlyDebt,
      downPaymentPercent: (config.cashDown / config.sellingPrice) * 100,
    });

    const bestRec = recommendations[0];

    // Calculate baseline for comparison
    const baseDesk = new DealDesk(this.vehicle, this.credit, this.baseScenario.customerState);
    baseDesk
      .setSellingPrice(this.baseScenario.sellingPrice)
      .setTrade(this.baseScenario.tradeValue, this.baseScenario.tradePayoff)
      .setCashDown(this.baseScenario.cashDown)
      .setRebates(this.baseScenario.rebates);

    const baseAmountFinanced = baseDesk.getAmountFinanced();
    const baseVehicleValue = baseDesk.getVehicleValue();

    const baseRecs = matcher.getRecommendations({
      creditScore: this.credit.score,
      credit: this.credit,
      vehicle: this.vehicle,
      amountFinanced: baseAmountFinanced,
      vehicleValue: baseVehicleValue,
      requestedTerm: this.baseScenario.term,
      monthlyIncome: this.credit.monthlyIncome,
      monthlyDebt: this.credit.monthlyDebt,
      downPaymentPercent: (this.baseScenario.cashDown / this.baseScenario.sellingPrice) * 100,
    });

    const baseRec = baseRecs[0];

    return {
      description,
      amountFinanced,
      ltv: desk.getLTV(),
      bestLender: bestRec
        ? {
            name: bestRec.lender.name,
            apr: bestRec.terms.apr,
            payment: bestRec.terms.monthlyPayment,
            confidence: bestRec.confidence,
          }
        : null,
      comparedToBase: {
        amountFinancedDiff: amountFinanced - baseAmountFinanced,
        ltvDiff: desk.getLTV() - baseDesk.getLTV(),
        paymentDiff:
          bestRec && baseRec
            ? bestRec.terms.monthlyPayment - baseRec.terms.monthlyPayment
            : null,
        rateDiff:
          bestRec && baseRec ? bestRec.terms.apr - baseRec.terms.apr : null,
      },
    };
  }
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface DealScenarioConfig {
  sellingPrice: number;
  tradeValue: number;
  tradePayoff: number;
  cashDown: number;
  rebates: number;
  term: number;
  customerState: string;
  includeProducts: string[];
}

export interface ScenarioResult {
  name: string;
  config: DealScenarioConfig;
  metrics: {
    amountFinanced: number;
    vehicleValue: number;
    ltv: number;
    salesTax: number;
    totalFees: number;
    netTrade: number;
  };
  bestLender: {
    name: string;
    type: string;
    apr: number;
    payment: number;
    totalInterest: number;
    totalOfPayments: number;
    confidence: 'high' | 'medium' | 'low';
    status: string;
    pti: number;
    dti: number;
  } | null;
  allLenders: Array<{
    name: string;
    apr: number;
    payment: number;
    confidence: 'high' | 'medium' | 'low';
  }>;
}

export interface ComparisonMetrics {
  lowestPayment: string | null;
  lowestRate: string | null;
  lowestTotalCost: string | null;
  highestApprovalConfidence: string | null;
  lowestLTV: string | null;
}

export interface ScenarioComparison {
  vehicle: string;
  creditScore: number;
  creditTier: string;
  scenarios: ScenarioResult[];
  comparison: ComparisonMetrics;
  recommendation: string;
}

export interface WhatIfResult {
  description: string;
  amountFinanced: number;
  ltv: number;
  bestLender: {
    name: string;
    apr: number;
    payment: number;
    confidence: 'high' | 'medium' | 'low';
  } | null;
  comparedToBase: {
    amountFinancedDiff: number;
    ltvDiff: number;
    paymentDiff: number | null;
    rateDiff: number | null;
  };
}
