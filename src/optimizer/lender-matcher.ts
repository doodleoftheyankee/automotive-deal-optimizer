// ============================================================================
// LENDER MATCHING & APPROVAL OPTIMIZER
// Analyzes deals and recommends best lender options for approval
// ============================================================================

import {
  LenderConfig,
  LenderCreditTier,
  CreditProfile,
  CreditTier,
  Vehicle,
  ApprovalStatus,
  ApprovalRecommendation,
  LoanTerms,
  DealAdjustment,
} from '../types';
import { lenders, getActiveLenders, getCreditTierForScore } from '../config/lenders';
import { calculateMonthlyPayment, calculateLTV, calculatePTI, calculateDTI } from '../calculators/payment';

// ============================================================================
// LENDER MATCHER CLASS
// ============================================================================

export class LenderMatcher {
  private activeLenders: LenderConfig[];

  constructor() {
    this.activeLenders = getActiveLenders();
  }

  /**
   * Find all lenders that could potentially approve a deal
   */
  findMatchingLenders(params: MatchParams): LenderMatch[] {
    const matches: LenderMatch[] = [];
    const creditTier = getCreditTierForScore(params.creditScore);
    const vehicleAge = new Date().getFullYear() - params.vehicle.year;

    for (const lender of this.activeLenders) {
      const tierConfig = this.findBestTierForScore(lender, params.creditScore);

      if (!tierConfig) continue;

      // Check vehicle restrictions
      const vehicleCheck = this.checkVehicleRestrictions(lender, params.vehicle);
      if (!vehicleCheck.eligible && vehicleCheck.blockers.length > 0) {
        continue; // Skip this lender entirely
      }

      // Calculate terms
      const payment = calculateMonthlyPayment(
        params.amountFinanced,
        tierConfig.baseRate,
        params.requestedTerm
      );

      const ltv = calculateLTV(params.amountFinanced, params.vehicleValue);
      const pti = calculatePTI(payment, params.monthlyIncome);
      const dti = calculateDTI(payment, params.monthlyDebt || 0, params.monthlyIncome);

      // Check approval likelihood
      const approval = this.assessApprovalLikelihood(
        tierConfig,
        lender,
        {
          ltv,
          pti,
          dti,
          vehicleAge,
          vehicleMileage: params.vehicle.mileage,
          amountFinanced: params.amountFinanced,
          term: params.requestedTerm,
          downPaymentPercent: params.downPaymentPercent || 0,
        },
        params.credit
      );

      matches.push({
        lender,
        tierConfig,
        baseRate: tierConfig.baseRate,
        adjustedRate: this.calculateAdjustedRate(tierConfig, params),
        payment,
        ltv,
        pti,
        dti,
        approvalStatus: approval.status,
        approvalConfidence: approval.confidence,
        warnings: approval.warnings,
        conditions: approval.conditions,
        vehicleWarnings: vehicleCheck.warnings,
      });
    }

    // Sort by approval confidence, then by rate
    return matches.sort((a, b) => {
      const confidenceOrder = { high: 0, medium: 1, low: 2 };
      const confDiff =
        confidenceOrder[a.approvalConfidence] - confidenceOrder[b.approvalConfidence];
      if (confDiff !== 0) return confDiff;
      return a.adjustedRate - b.adjustedRate;
    });
  }

  /**
   * Get detailed recommendations for a deal
   */
  getRecommendations(params: MatchParams): ApprovalRecommendation[] {
    const matches = this.findMatchingLenders(params);
    const recommendations: ApprovalRecommendation[] = [];

    for (const match of matches) {
      const reasoning: string[] = [];
      const warnings: string[] = [...match.warnings, ...match.vehicleWarnings];
      const suggestedAdjustments: DealAdjustment[] = [];

      // Build reasoning
      if (match.approvalConfidence === 'high') {
        reasoning.push(
          `${match.lender.name} has strong programs for ${match.tierConfig.tier} credit`
        );
      }

      if (match.ltv <= match.tierConfig.maxLTV - 10) {
        reasoning.push(`LTV of ${match.ltv.toFixed(1)}% is well within guidelines`);
      }

      if (match.pti <= match.tierConfig.maxPTI - 2) {
        reasoning.push(`PTI of ${match.pti.toFixed(1)}% shows strong payment affordability`);
      }

      // Add lender-specific reasoning
      if (match.lender.type === 'credit-union') {
        reasoning.push('Credit unions often offer the best rates for qualified borrowers');
      }

      if (match.lender.id === 'gm-financial' && params.vehicle.make === 'GMC') {
        reasoning.push('GM Financial provides enhanced terms for GMC vehicles');
      }

      if (match.lender.type === 'subprime' && params.creditScore < 600) {
        reasoning.push(`${match.lender.name} specializes in credit rebuilding`);
      }

      // Suggest adjustments if needed
      if (match.approvalStatus !== 'auto-approved') {
        if (match.ltv > match.tierConfig.maxLTV) {
          const excessLTV = match.ltv - match.tierConfig.maxLTV;
          const additionalDown = (params.amountFinanced * excessLTV) / 100;
          suggestedAdjustments.push({
            type: 'increase-down',
            description: `Increase down payment by $${additionalDown.toFixed(0)}`,
            impact: `Reduces LTV to ${match.tierConfig.maxLTV}%`,
            newValue: additionalDown,
          });
        }

        if (match.pti > match.tierConfig.maxPTI) {
          suggestedAdjustments.push({
            type: 'shorten-term',
            description: 'Consider extending term to lower payment',
            impact: `Reduces PTI below ${match.tierConfig.maxPTI}%`,
          });
        }
      }

      const terms: LoanTerms = {
        apr: match.adjustedRate,
        termMonths: params.requestedTerm,
        monthlyPayment: match.payment,
        totalInterest: match.payment * params.requestedTerm - params.amountFinanced,
        totalOfPayments: match.payment * params.requestedTerm,
        firstPaymentDate: this.calculateFirstPaymentDate(),
        lenderId: match.lender.id,
        lenderName: match.lender.name,
        approvalStatus: match.approvalStatus,
        approvalConditions: match.conditions,
        buyRate: match.baseRate,
        dealerReserve: this.estimateDealerReserve(
          params.amountFinanced,
          match.baseRate,
          match.adjustedRate,
          params.requestedTerm
        ),
        ltv: match.ltv,
        pti: match.pti,
        dti: match.dti,
      };

      recommendations.push({
        lender: match.lender,
        terms,
        confidence: match.approvalConfidence,
        reasoning,
        warnings,
        suggestedAdjustments,
      });
    }

    return recommendations;
  }

  /**
   * Find the best lender for a specific scenario
   */
  findBestLender(
    params: MatchParams,
    priority: 'lowest-rate' | 'highest-approval' | 'balanced' = 'balanced'
  ): ApprovalRecommendation | null {
    const recommendations = this.getRecommendations(params);

    if (recommendations.length === 0) return null;

    switch (priority) {
      case 'lowest-rate':
        return recommendations.reduce((best, current) =>
          current.terms.apr < best.terms.apr ? current : best
        );

      case 'highest-approval':
        return recommendations.find((r) => r.confidence === 'high') || recommendations[0];

      case 'balanced':
      default:
        // Find high confidence with lowest rate
        const highConfidence = recommendations.filter((r) => r.confidence === 'high');
        if (highConfidence.length > 0) {
          return highConfidence.reduce((best, current) =>
            current.terms.apr < best.terms.apr ? current : best
          );
        }
        return recommendations[0];
    }
  }

  /**
   * Get lender recommendations by credit tier
   */
  getLendersByTier(tier: CreditTier): LenderRecommendation[] {
    const recommendations: LenderRecommendation[] = [];

    for (const lender of this.activeLenders) {
      const tierConfig = lender.creditTiers.find((t) => t.tier === tier);
      if (tierConfig) {
        recommendations.push({
          lender,
          tier: tierConfig,
          strengths: this.getLenderStrengths(lender, tier),
          bestFor: this.getLenderBestFor(lender, tier),
        });
      }
    }

    return recommendations.sort((a, b) => a.tier.baseRate - b.tier.baseRate);
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private findBestTierForScore(
    lender: LenderConfig,
    score: number
  ): LenderCreditTier | null {
    // Find the tier that matches the score
    for (const tier of lender.creditTiers) {
      if (score >= tier.minScore && (!tier.maxScore || score <= tier.maxScore)) {
        return tier;
      }
    }

    // Check if score qualifies for any tier
    const sortedTiers = [...lender.creditTiers].sort(
      (a, b) => b.minScore - a.minScore
    );
    for (const tier of sortedTiers) {
      if (score >= tier.minScore) {
        return tier;
      }
    }

    return null;
  }

  private checkVehicleRestrictions(
    lender: LenderConfig,
    vehicle: Vehicle
  ): { eligible: boolean; warnings: string[]; blockers: string[] } {
    const warnings: string[] = [];
    const blockers: string[] = [];
    const vehicleAge = new Date().getFullYear() - vehicle.year;

    const { vehicleRestrictions } = lender;

    // Check age
    if (vehicleAge > vehicleRestrictions.maxAge) {
      blockers.push(
        `Vehicle age (${vehicleAge} years) exceeds ${lender.name} maximum of ${vehicleRestrictions.maxAge} years`
      );
    } else if (vehicleAge > vehicleRestrictions.maxAge - 2) {
      warnings.push(`Vehicle age (${vehicleAge} years) approaching ${lender.name} maximum`);
    }

    // Check mileage
    if (vehicle.mileage > vehicleRestrictions.maxMileage) {
      blockers.push(
        `Mileage (${vehicle.mileage.toLocaleString()}) exceeds ${lender.name} maximum of ${vehicleRestrictions.maxMileage.toLocaleString()}`
      );
    } else if (vehicle.mileage > vehicleRestrictions.maxMileage * 0.9) {
      warnings.push(`Mileage approaching ${lender.name} maximum`);
    }

    // Check excluded makes
    if (vehicleRestrictions.excludedMakes?.includes(vehicle.make)) {
      blockers.push(`${lender.name} does not finance ${vehicle.make} vehicles`);
    }

    // Check excluded classes
    if (vehicleRestrictions.excludedClasses?.includes(vehicle.vehicleClass)) {
      blockers.push(
        `${lender.name} does not finance ${vehicle.vehicleClass} class vehicles`
      );
    }

    // Check minimum value
    const vehicleValue = vehicle.bookValue.retail || 0;
    if (
      vehicleRestrictions.minValue &&
      vehicleValue < vehicleRestrictions.minValue
    ) {
      blockers.push(
        `Vehicle value ($${vehicleValue.toLocaleString()}) below ${lender.name} minimum of $${vehicleRestrictions.minValue.toLocaleString()}`
      );
    }

    return {
      eligible: blockers.length === 0,
      warnings,
      blockers,
    };
  }

  private assessApprovalLikelihood(
    tierConfig: LenderCreditTier,
    lender: LenderConfig,
    metrics: {
      ltv: number;
      pti: number;
      dti: number;
      vehicleAge: number;
      vehicleMileage: number;
      amountFinanced: number;
      term: number;
      downPaymentPercent: number;
    },
    credit: CreditProfile
  ): {
    status: ApprovalStatus;
    confidence: 'high' | 'medium' | 'low';
    warnings: string[];
    conditions: string[];
  } {
    const warnings: string[] = [];
    const conditions: string[] = [];
    let issueCount = 0;
    let severeIssues = 0;

    // Check LTV
    if (metrics.ltv > tierConfig.maxLTV) {
      severeIssues++;
      warnings.push(`LTV ${metrics.ltv.toFixed(1)}% exceeds max ${tierConfig.maxLTV}%`);
    } else if (metrics.ltv > tierConfig.maxLTV - 5) {
      issueCount++;
      warnings.push(`LTV ${metrics.ltv.toFixed(1)}% is near maximum`);
    }

    // Check PTI
    if (metrics.pti > tierConfig.maxPTI) {
      severeIssues++;
      warnings.push(`PTI ${metrics.pti.toFixed(1)}% exceeds max ${tierConfig.maxPTI}%`);
    } else if (metrics.pti > tierConfig.maxPTI - 2) {
      issueCount++;
      warnings.push(`PTI ${metrics.pti.toFixed(1)}% is near maximum`);
    }

    // Check DTI if specified
    if (tierConfig.maxDTI && metrics.dti > tierConfig.maxDTI) {
      severeIssues++;
      warnings.push(`DTI ${metrics.dti.toFixed(1)}% exceeds max ${tierConfig.maxDTI}%`);
    }

    // Check term
    if (metrics.term > tierConfig.maxTerm) {
      severeIssues++;
      warnings.push(
        `Requested term ${metrics.term} months exceeds max ${tierConfig.maxTerm} months`
      );
    }

    // Check minimum down payment
    if (tierConfig.minDown && metrics.downPaymentPercent < tierConfig.minDown) {
      issueCount++;
      warnings.push(
        `Down payment ${metrics.downPaymentPercent.toFixed(1)}% below minimum ${tierConfig.minDown}%`
      );
    }

    // Check loan amount limits
    if (metrics.amountFinanced < lender.loanLimits.minAmount) {
      severeIssues++;
      warnings.push(
        `Amount financed $${metrics.amountFinanced.toLocaleString()} below minimum $${lender.loanLimits.minAmount.toLocaleString()}`
      );
    }
    if (metrics.amountFinanced > lender.loanLimits.maxAmount) {
      severeIssues++;
      warnings.push(
        `Amount financed $${metrics.amountFinanced.toLocaleString()} exceeds maximum $${lender.loanLimits.maxAmount.toLocaleString()}`
      );
    }

    // Check bankruptcy
    if (credit.bankruptcyHistory) {
      if (credit.bankruptcyAge && credit.bankruptcyAge < 24) {
        severeIssues++;
        warnings.push('Recent bankruptcy (< 24 months) may affect approval');
      } else {
        issueCount++;
        conditions.push('Bankruptcy discharge documentation required');
      }
    }

    // Check repo history
    if (credit.repoHistory) {
      if (credit.repoAge && credit.repoAge < 24) {
        severeIssues++;
        warnings.push('Recent repossession may affect approval');
      } else {
        issueCount++;
        conditions.push('Additional down payment may be required');
      }
    }

    // Add tier stipulations as conditions
    if (tierConfig.stipulations) {
      conditions.push(...tierConfig.stipulations);
    }

    // Determine status and confidence
    let status: ApprovalStatus;
    let confidence: 'high' | 'medium' | 'low';

    if (severeIssues > 0) {
      status = severeIssues > 1 ? 'likely-decline' : 'review-needed';
      confidence = 'low';
    } else if (issueCount > 2) {
      status = 'conditional';
      confidence = 'low';
    } else if (issueCount > 0) {
      status = 'conditional';
      confidence = 'medium';
    } else {
      status = 'auto-approved';
      confidence = 'high';
    }

    return { status, confidence, warnings, conditions };
  }

  private calculateAdjustedRate(
    tierConfig: LenderCreditTier,
    params: MatchParams
  ): number {
    let rate = tierConfig.baseRate;

    for (const adjustment of tierConfig.rateAdjustments) {
      // Apply relevant adjustments
      if (
        adjustment.condition.includes('mileage') &&
        params.vehicle.mileage > 80000
      ) {
        rate += adjustment.adjustment;
      }
      if (
        adjustment.condition.includes('age') &&
        new Date().getFullYear() - params.vehicle.year > 7
      ) {
        rate += adjustment.adjustment;
      }
      if (
        adjustment.condition.includes('Certified') &&
        params.vehicle.certified
      ) {
        rate += adjustment.adjustment; // This is usually negative
      }
      if (
        adjustment.condition.includes('down') &&
        (params.downPaymentPercent || 0) < 10
      ) {
        rate += adjustment.adjustment;
      }
    }

    // Cap maximum rate markup (dealer reserve typically 2-2.5%)
    const maxMarkup = 2.5;
    return Math.min(rate + maxMarkup, rate * 1.4);
  }

  private calculateFirstPaymentDate(): Date {
    const today = new Date();
    const firstPayment = new Date(today);
    firstPayment.setDate(firstPayment.getDate() + 45); // 45 days to first payment
    return firstPayment;
  }

  private estimateDealerReserve(
    amountFinanced: number,
    buyRate: number,
    sellRate: number,
    term: number
  ): number {
    const buyPayment = calculateMonthlyPayment(amountFinanced, buyRate, term);
    const sellPayment = calculateMonthlyPayment(amountFinanced, sellRate, term);
    const monthlySpread = sellPayment - buyPayment;
    const totalSpread = monthlySpread * term;
    return Math.round(totalSpread * 0.75 * 100) / 100;
  }

  private getLenderStrengths(lender: LenderConfig, tier: CreditTier): string[] {
    const strengths: string[] = [];

    switch (lender.type) {
      case 'captive':
        strengths.push('Best rates for GM vehicles');
        strengths.push('Higher LTV allowance for CPO');
        break;
      case 'credit-union':
        strengths.push('Often lowest rates available');
        strengths.push('More flexible on DTI');
        strengths.push('Member loyalty benefits');
        break;
      case 'full-spectrum':
        strengths.push('Finances all credit tiers');
        strengths.push('Quick approvals');
        strengths.push('Flexible terms');
        break;
      case 'subprime':
        strengths.push('Specializes in credit rebuilding');
        strengths.push('Higher approval rates');
        strengths.push('Works with challenged credit');
        break;
      case 'national-bank':
        strengths.push('Competitive rates');
        strengths.push('Large network');
        break;
      case 'regional-bank':
        strengths.push('Local decision making');
        strengths.push('Relationship pricing');
        break;
    }

    return strengths;
  }

  private getLenderBestFor(lender: LenderConfig, tier: CreditTier): string[] {
    const bestFor: string[] = [];

    if (tier === 'super-prime' || tier === 'prime') {
      if (lender.type === 'credit-union') {
        bestFor.push('Customers seeking lowest possible rate');
      }
      if (lender.id === 'gm-financial') {
        bestFor.push('GMC/Buick purchases');
        bestFor.push('GM Certified Pre-Owned');
      }
    }

    if (tier === 'near-prime') {
      if (lender.type === 'full-spectrum') {
        bestFor.push('Customers rebuilding credit');
        bestFor.push('Quick approval needed');
      }
    }

    if (tier === 'subprime' || tier === 'deep-subprime') {
      if (lender.type === 'subprime') {
        bestFor.push('Fresh start customers');
        bestFor.push('Bankruptcy/repo rebuilding');
        bestFor.push('First time buyers with limited history');
      }
    }

    return bestFor;
  }
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface MatchParams {
  creditScore: number;
  credit: CreditProfile;
  vehicle: Vehicle;
  amountFinanced: number;
  vehicleValue: number;
  requestedTerm: number;
  monthlyIncome: number;
  monthlyDebt?: number;
  downPaymentPercent?: number;
}

export interface LenderMatch {
  lender: LenderConfig;
  tierConfig: LenderCreditTier;
  baseRate: number;
  adjustedRate: number;
  payment: number;
  ltv: number;
  pti: number;
  dti: number;
  approvalStatus: ApprovalStatus;
  approvalConfidence: 'high' | 'medium' | 'low';
  warnings: string[];
  conditions: string[];
  vehicleWarnings: string[];
}

export interface LenderRecommendation {
  lender: LenderConfig;
  tier: LenderCreditTier;
  strengths: string[];
  bestFor: string[];
}

// Export singleton instance
export const lenderMatcher = new LenderMatcher();
