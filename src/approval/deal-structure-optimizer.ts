// ============================================================================
// DEAL STRUCTURE OPTIMIZER
// Provides specific recommendations to achieve auto-approval
// ============================================================================

import {
  CreditProfile,
  Vehicle,
  LenderConfig,
  FIProduct,
} from '../types';
import { lenders } from '../config/lenders';
import {
  calculateMonthlyPayment,
  calculateLTV,
  calculatePTI,
  calculateDTI,
  calculatePrincipalFromPayment,
} from '../calculators/payment';
import {
  calculateFICOAutoScore,
  getAutoApprovalThresholds,
  AutoApprovalThreshold,
  FICOAutoScore,
} from './auto-approval-engine';

// ============================================================================
// DEAL STRUCTURE OPTIMIZER CLASS
// ============================================================================

export class DealStructureOptimizer {
  /**
   * Optimize deal structure for maximum approval probability
   */
  optimizeForApproval(params: OptimizationParams): OptimizationResult {
    const ficoAuto = calculateFICOAutoScore(params.credit);
    const thresholds = getAutoApprovalThresholds();

    // Find best target lenders for this credit profile
    const targetLenders = this.findTargetLenders(ficoAuto, params.vehicle);

    // Generate optimization recommendations
    const recommendations = this.generateOptimizations(params, ficoAuto, targetLenders);

    // Find the sweet spot deal structure
    const sweetSpot = this.findSweetSpot(params, targetLenders);

    // Generate step-by-step action plan
    const actionPlan = this.generateActionPlan(params, recommendations, sweetSpot);

    return {
      currentAnalysis: this.analyzeCurrentDeal(params, ficoAuto),
      targetLenders,
      recommendations,
      sweetSpotDeal: sweetSpot,
      actionPlan,
      approvalProbability: this.calculateApprovalProbability(params, recommendations),
    };
  }

  /**
   * Find the best lenders to target based on credit profile
   */
  private findTargetLenders(ficoAuto: FICOAutoScore, vehicle: Vehicle): TargetLender[] {
    const targets: TargetLender[] = [];
    const thresholds = getAutoApprovalThresholds();
    const vehicleAge = new Date().getFullYear() - vehicle.year;

    for (const lender of lenders.filter((l) => l.active)) {
      // Find the best tier this customer qualifies for
      const applicableTier = lender.creditTiers.find(
        (t) => ficoAuto.autoScore >= t.minScore && (!t.maxScore || ficoAuto.autoScore <= t.maxScore)
      );

      if (!applicableTier) continue;

      // Check vehicle compatibility
      if (vehicleAge > lender.vehicleRestrictions.maxAge) continue;
      if (vehicle.mileage > lender.vehicleRestrictions.maxMileage) continue;
      if (lender.vehicleRestrictions.excludedMakes?.includes(vehicle.make)) continue;

      // Find auto-approval threshold for this lender/tier
      const autoThreshold = thresholds.find(
        (t) => t.lenderId === lender.id && t.tier === applicableTier.tier
      );

      const scoreBuffer = ficoAuto.autoScore - applicableTier.minScore;

      targets.push({
        lender,
        tier: applicableTier.tier,
        baseRate: applicableTier.baseRate,
        maxLTV: applicableTier.maxLTV,
        maxPTI: applicableTier.maxPTI,
        maxDTI: applicableTier.maxDTI || 50,
        maxTerm: applicableTier.maxTerm,
        minDownPercent: applicableTier.minDown || 0,
        scoreBuffer,
        autoApprovalThreshold: autoThreshold || null,
        likelihood: this.calculateLenderLikelihood(scoreBuffer, lender.type),
        priority: this.calculatePriority(lender, applicableTier, vehicle),
      });
    }

    return targets.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Generate specific optimizations to achieve auto-approval
   */
  private generateOptimizations(
    params: OptimizationParams,
    ficoAuto: FICOAutoScore,
    targets: TargetLender[]
  ): DealOptimization[] {
    const optimizations: DealOptimization[] = [];
    const currentLTV = calculateLTV(params.amountFinanced, params.vehicleValue);
    const currentPayment = calculateMonthlyPayment(
      params.amountFinanced,
      targets[0]?.baseRate || 8,
      params.term
    );
    const currentPTI = calculatePTI(currentPayment, params.credit.monthlyIncome);
    const currentDTI = calculateDTI(currentPayment, params.credit.monthlyDebt || 0, params.credit.monthlyIncome);

    // Get best target for comparison
    const primaryTarget = targets[0];
    if (!primaryTarget) {
      return [{
        type: 'different_vehicle',
        priority: 'critical',
        title: 'Vehicle Not Financeable',
        description: 'This vehicle does not meet any lender guidelines',
        currentValue: `${params.vehicle.year} ${params.vehicle.make} ${params.vehicle.model}`,
        targetValue: 'Select a newer vehicle with lower mileage',
        impact: 'Required for any financing',
        estimatedApprovalIncrease: 0,
      }];
    }

    // =========================================================================
    // LTV OPTIMIZATION
    // =========================================================================

    if (currentLTV > primaryTarget.maxLTV) {
      const excessLTV = currentLTV - primaryTarget.maxLTV;
      const additionalDownNeeded = Math.ceil((excessLTV / 100) * params.vehicleValue);

      optimizations.push({
        type: 'increase_down_payment',
        priority: 'critical',
        title: 'LTV Exceeds Maximum',
        description: `Current LTV of ${currentLTV.toFixed(1)}% exceeds the ${primaryTarget.maxLTV}% maximum. This WILL cause a decline or conditional approval.`,
        currentValue: `$${(params.downPayment || 0).toLocaleString()} down (${currentLTV.toFixed(1)}% LTV)`,
        targetValue: `$${((params.downPayment || 0) + additionalDownNeeded).toLocaleString()} down (${primaryTarget.maxLTV}% LTV)`,
        impact: `Add $${additionalDownNeeded.toLocaleString()} to down payment`,
        estimatedApprovalIncrease: 40,
        calculation: {
          currentLTV,
          targetLTV: primaryTarget.maxLTV,
          additionalDownNeeded,
        },
      });
    } else if (currentLTV > primaryTarget.maxLTV - 10) {
      // LTV is close to limit - suggest buffer
      const bufferDown = Math.ceil(((currentLTV - (primaryTarget.maxLTV - 10)) / 100) * params.vehicleValue);

      optimizations.push({
        type: 'increase_down_payment',
        priority: 'recommended',
        title: 'LTV Near Maximum',
        description: `LTV of ${currentLTV.toFixed(1)}% is within 10% of the limit. Adding buffer improves auto-approval odds.`,
        currentValue: `${currentLTV.toFixed(1)}% LTV`,
        targetValue: `${(primaryTarget.maxLTV - 10).toFixed(1)}% LTV`,
        impact: `Add $${bufferDown.toLocaleString()} for comfortable LTV buffer`,
        estimatedApprovalIncrease: 15,
      });
    }

    // =========================================================================
    // PTI OPTIMIZATION
    // =========================================================================

    if (currentPTI > primaryTarget.maxPTI) {
      // Calculate how much to reduce payment
      const targetPayment = params.credit.monthlyIncome * (primaryTarget.maxPTI / 100);
      const paymentReduction = currentPayment - targetPayment;

      // Option 1: More down payment
      const additionalDown = this.calculateDownForPayment(
        params.amountFinanced,
        primaryTarget.baseRate,
        params.term,
        targetPayment
      );

      optimizations.push({
        type: 'reduce_payment',
        priority: 'critical',
        title: 'Payment Exceeds Income Threshold',
        description: `PTI of ${currentPTI.toFixed(1)}% exceeds the ${primaryTarget.maxPTI}% maximum. Lenders see this as unaffordable.`,
        currentValue: `$${currentPayment.toFixed(0)}/mo (${currentPTI.toFixed(1)}% of income)`,
        targetValue: `$${targetPayment.toFixed(0)}/mo (${primaryTarget.maxPTI}% of income)`,
        impact: `Reduce payment by $${paymentReduction.toFixed(0)}/mo`,
        estimatedApprovalIncrease: 35,
        solutions: [
          {
            method: 'Increase down payment',
            action: `Add $${additionalDown.toLocaleString()} down`,
          },
          {
            method: 'Extend term',
            action: `Extend to ${Math.min(primaryTarget.maxTerm, params.term + 12)} months`,
          },
          {
            method: 'Reduce selling price',
            action: `Negotiate $${Math.ceil(additionalDown * 0.8).toLocaleString()} off price`,
          },
        ],
      });
    } else if (currentPTI > primaryTarget.maxPTI - 3) {
      optimizations.push({
        type: 'reduce_payment',
        priority: 'recommended',
        title: 'PTI Near Threshold',
        description: `PTI of ${currentPTI.toFixed(1)}% is close to the ${primaryTarget.maxPTI}% limit.`,
        currentValue: `${currentPTI.toFixed(1)}% PTI`,
        targetValue: `≤${primaryTarget.maxPTI - 3}% PTI for comfort`,
        impact: 'Small buffer reduces conditional approval risk',
        estimatedApprovalIncrease: 10,
      });
    }

    // =========================================================================
    // DTI OPTIMIZATION
    // =========================================================================

    if (currentDTI > primaryTarget.maxDTI) {
      optimizations.push({
        type: 'reduce_dti',
        priority: 'high',
        title: 'Total Debt Ratio Too High',
        description: `DTI of ${currentDTI.toFixed(1)}% exceeds ${primaryTarget.maxDTI}%. This includes all monthly debts.`,
        currentValue: `${currentDTI.toFixed(1)}% DTI`,
        targetValue: `≤${primaryTarget.maxDTI}% DTI`,
        impact: 'Reduce other debts or increase income documentation',
        estimatedApprovalIncrease: 25,
        solutions: [
          {
            method: 'Pay off credit cards',
            action: 'Remove cards from bureau or pay down balances',
          },
          {
            method: 'Add co-borrower income',
            action: 'Add spouse/co-buyer income to reduce DTI',
          },
          {
            method: 'Provide additional income',
            action: 'Document overtime, bonuses, or second job',
          },
        ],
      });
    }

    // =========================================================================
    // TERM OPTIMIZATION
    // =========================================================================

    if (params.term > primaryTarget.maxTerm) {
      optimizations.push({
        type: 'shorten_term',
        priority: 'critical',
        title: 'Term Exceeds Maximum',
        description: `Requested ${params.term} months exceeds ${primaryTarget.lender.name} maximum of ${primaryTarget.maxTerm} months.`,
        currentValue: `${params.term} months`,
        targetValue: `${primaryTarget.maxTerm} months`,
        impact: `Shorten to ${primaryTarget.maxTerm} months or increase down payment`,
        estimatedApprovalIncrease: 30,
      });
    }

    // =========================================================================
    // DOWN PAYMENT MINIMUM
    // =========================================================================

    const downPercent = ((params.downPayment || 0) / params.sellingPrice) * 100;
    if (primaryTarget.minDownPercent > 0 && downPercent < primaryTarget.minDownPercent) {
      const minDown = Math.ceil(params.sellingPrice * (primaryTarget.minDownPercent / 100));
      const additional = minDown - (params.downPayment || 0);

      optimizations.push({
        type: 'increase_down_payment',
        priority: 'critical',
        title: 'Minimum Down Payment Required',
        description: `${primaryTarget.lender.name} requires minimum ${primaryTarget.minDownPercent}% down for this credit tier.`,
        currentValue: `$${(params.downPayment || 0).toLocaleString()} (${downPercent.toFixed(1)}%)`,
        targetValue: `$${minDown.toLocaleString()} (${primaryTarget.minDownPercent}%)`,
        impact: `Add $${additional.toLocaleString()} to meet minimum`,
        estimatedApprovalIncrease: 35,
      });
    }

    // =========================================================================
    // BACKEND OPTIMIZATION
    // =========================================================================

    if (params.fiProducts && params.fiProducts.length > 0) {
      const backendTotal = params.fiProducts.reduce((sum, p) => sum + p.sellPrice, 0);

      if (currentLTV > primaryTarget.maxLTV - 5 || currentPTI > primaryTarget.maxPTI - 2) {
        optimizations.push({
          type: 'reduce_backend',
          priority: 'recommended',
          title: 'Consider Reducing Backend Products',
          description: `$${backendTotal.toLocaleString()} in F&I products is adding to LTV/PTI. Consider cash sale or reduced products.`,
          currentValue: `$${backendTotal.toLocaleString()} financed products`,
          targetValue: 'Sell products for cash or reduce amount',
          impact: 'Improves LTV and payment ratios',
          estimatedApprovalIncrease: 10,
        });
      }
    }

    // =========================================================================
    // CPO BONUS
    // =========================================================================

    if (!params.vehicle.certified && params.vehicle.make === 'GMC' || params.vehicle.make === 'Buick') {
      optimizations.push({
        type: 'certify_vehicle',
        priority: 'recommended',
        title: 'Consider GM Certification',
        description: 'GM CPO certification can reduce rate by 0.5-0.75% and increase max LTV.',
        currentValue: 'Non-certified',
        targetValue: 'GM Certified Pre-Owned',
        impact: 'Better rate and higher approval odds with GM Financial',
        estimatedApprovalIncrease: 8,
      });
    }

    // =========================================================================
    // STABILITY DOCUMENTATION
    // =========================================================================

    if (ficoAuto.autoScore < 700) {
      optimizations.push({
        type: 'enhance_application',
        priority: 'recommended',
        title: 'Strengthen Application',
        description: 'For scores under 700, additional documentation can trigger auto-approval instead of conditions.',
        currentValue: 'Standard application',
        targetValue: 'Enhanced application with upfront docs',
        impact: 'Pre-submit POI, POR, and references with deal',
        estimatedApprovalIncrease: 15,
        solutions: [
          { method: 'Proof of Income', action: 'Include 2 recent paystubs' },
          { method: 'Proof of Residence', action: 'Include utility bill' },
          { method: 'Bank Statements', action: '2 months showing direct deposit' },
          { method: 'References', action: 'Pre-fill 5-8 references' },
        ],
      });
    }

    return optimizations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, recommended: 2, optional: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Find the "sweet spot" deal structure for auto-approval
   */
  private findSweetSpot(params: OptimizationParams, targets: TargetLender[]): SweetSpotDeal {
    const primaryTarget = targets[0];
    if (!primaryTarget) {
      return {
        achievable: false,
        reason: 'No lenders available for this vehicle/credit combination',
      } as any;
    }

    // Calculate ideal structure for auto-approval
    const targetLTV = primaryTarget.maxLTV - 10; // 10% buffer
    const targetPTI = primaryTarget.maxPTI - 3; // 3% buffer

    // Work backwards from target LTV
    const maxAmountFinanced = params.vehicleValue * (targetLTV / 100);
    const idealDown = Math.max(
      0,
      params.sellingPrice + (params.fees || 0) + (params.fiFinanced || 0) - maxAmountFinanced
    );

    // Calculate resulting payment
    const idealPayment = calculateMonthlyPayment(maxAmountFinanced, primaryTarget.baseRate, params.term);
    const resultingPTI = calculatePTI(idealPayment, params.credit.monthlyIncome);

    // Check if PTI is acceptable
    let adjustedTerm = params.term;
    let adjustedPayment = idealPayment;
    let adjustedDown = idealDown;

    if (resultingPTI > targetPTI) {
      // Need to either extend term or increase down
      // Try extending term first
      for (let term = params.term; term <= primaryTarget.maxTerm; term += 6) {
        const testPayment = calculateMonthlyPayment(maxAmountFinanced, primaryTarget.baseRate, term);
        const testPTI = calculatePTI(testPayment, params.credit.monthlyIncome);
        if (testPTI <= targetPTI) {
          adjustedTerm = term;
          adjustedPayment = testPayment;
          break;
        }
      }

      // If still too high, calculate additional down needed
      if (calculatePTI(adjustedPayment, params.credit.monthlyIncome) > targetPTI) {
        const targetPayment = params.credit.monthlyIncome * (targetPTI / 100);
        const maxPrincipal = calculatePrincipalFromPayment(targetPayment, primaryTarget.baseRate, primaryTarget.maxTerm);
        adjustedDown = params.sellingPrice + (params.fees || 0) - maxPrincipal;
        adjustedTerm = primaryTarget.maxTerm;
        adjustedPayment = targetPayment;
      }
    }

    const finalAmountFinanced = params.sellingPrice + (params.fees || 0) + (params.fiFinanced || 0) - adjustedDown;
    const finalLTV = calculateLTV(finalAmountFinanced, params.vehicleValue);
    const finalPTI = calculatePTI(adjustedPayment, params.credit.monthlyIncome);

    return {
      achievable: true,
      targetLender: primaryTarget.lender.name,
      structure: {
        sellingPrice: params.sellingPrice,
        downPayment: Math.ceil(adjustedDown),
        term: adjustedTerm,
        apr: primaryTarget.baseRate,
        monthlyPayment: Math.round(adjustedPayment * 100) / 100,
        amountFinanced: Math.round(finalAmountFinanced * 100) / 100,
      },
      metrics: {
        ltv: Math.round(finalLTV * 10) / 10,
        pti: Math.round(finalPTI * 10) / 10,
        targetLTV,
        targetPTI,
      },
      comparison: {
        downPaymentDiff: Math.ceil(adjustedDown) - (params.downPayment || 0),
        termDiff: adjustedTerm - params.term,
        paymentDiff: Math.round((adjustedPayment - calculateMonthlyPayment(params.amountFinanced, primaryTarget.baseRate, params.term)) * 100) / 100,
      },
      approvalProbability: 90,
      notes: this.generateSweetSpotNotes(adjustedDown, params.downPayment || 0, adjustedTerm, params.term),
    };
  }

  /**
   * Generate step-by-step action plan
   */
  private generateActionPlan(
    params: OptimizationParams,
    optimizations: DealOptimization[],
    sweetSpot: SweetSpotDeal
  ): ActionStep[] {
    const steps: ActionStep[] = [];
    let stepNum = 1;

    // Critical items first
    const critical = optimizations.filter((o) => o.priority === 'critical');
    for (const opt of critical) {
      steps.push({
        step: stepNum++,
        action: opt.title,
        details: opt.description,
        requirement: 'REQUIRED for approval',
        implementation: opt.impact,
      });
    }

    // High priority items
    const high = optimizations.filter((o) => o.priority === 'high');
    for (const opt of high) {
      steps.push({
        step: stepNum++,
        action: opt.title,
        details: opt.description,
        requirement: 'Strongly recommended',
        implementation: opt.impact,
      });
    }

    // Sweet spot structure
    if (sweetSpot.achievable && sweetSpot.structure) {
      steps.push({
        step: stepNum++,
        action: 'Structure deal to sweet spot',
        details: `Target ${sweetSpot.targetLender} with optimized structure`,
        requirement: 'Recommended for auto-approval',
        implementation: `Down: $${sweetSpot.structure.downPayment.toLocaleString()}, Term: ${sweetSpot.structure.term}mo, Payment: $${sweetSpot.structure.monthlyPayment}`,
      });
    }

    // Submit with documentation
    steps.push({
      step: stepNum++,
      action: 'Submit with complete documentation',
      details: 'Pre-submit all stipulations with the deal to trigger auto-approval',
      requirement: 'Best practice for conditional-to-auto conversion',
      implementation: 'POI (2 stubs), POR (utility), bank statement if available',
    });

    return steps;
  }

  /**
   * Analyze current deal structure
   */
  private analyzeCurrentDeal(params: OptimizationParams, ficoAuto: FICOAutoScore): CurrentAnalysis {
    const currentPayment = calculateMonthlyPayment(params.amountFinanced, 8, params.term); // Estimate at 8%
    const currentLTV = calculateLTV(params.amountFinanced, params.vehicleValue);
    const currentPTI = calculatePTI(currentPayment, params.credit.monthlyIncome);
    const currentDTI = calculateDTI(currentPayment, params.credit.monthlyDebt || 0, params.credit.monthlyIncome);

    return {
      ficoAutoScore: ficoAuto.autoScore,
      riskTier: ficoAuto.riskTier,
      currentLTV,
      currentPTI,
      currentDTI,
      currentPayment,
      issues: [
        ...(currentLTV > 120 ? ['LTV over 120% - most lenders will decline'] : []),
        ...(currentPTI > 18 ? ['PTI over 18% - payment may be unaffordable'] : []),
        ...(currentDTI > 50 ? ['DTI over 50% - total debt burden high'] : []),
        ...(ficoAuto.autoScore < 600 ? ['Sub-600 score requires specialist lenders'] : []),
      ],
      strengths: [
        ...(currentLTV <= 100 ? ['Strong LTV - equity in deal'] : []),
        ...(currentPTI <= 12 ? ['Low PTI - very affordable payment'] : []),
        ...(ficoAuto.autoScore >= 720 ? ['Prime credit tier - best rates available'] : []),
        ...(params.credit.timeOnJob && params.credit.timeOnJob >= 24 ? ['Strong job stability'] : []),
      ],
    };
  }

  /**
   * Calculate approval probability based on optimizations needed
   */
  private calculateApprovalProbability(
    params: OptimizationParams,
    optimizations: DealOptimization[]
  ): ApprovalProbability {
    const critical = optimizations.filter((o) => o.priority === 'critical');
    const high = optimizations.filter((o) => o.priority === 'high');
    const recommended = optimizations.filter((o) => o.priority === 'recommended');

    let currentProbability = 50;
    let potentialProbability = 50;

    if (critical.length === 0) {
      currentProbability = 70;
      if (high.length === 0) {
        currentProbability = 85;
        if (recommended.length <= 1) {
          currentProbability = 95;
        }
      }
    } else {
      currentProbability = 20;
    }

    // Calculate potential if all changes made
    potentialProbability = 95;
    if (critical.length > 2) {
      potentialProbability = 75;
    }

    return {
      currentAsStructured: currentProbability,
      ifOptimized: potentialProbability,
      criticalIssues: critical.length,
      highIssues: high.length,
      recommendation: critical.length > 0
        ? 'RESTRUCTURE REQUIRED - Critical issues must be addressed'
        : high.length > 0
        ? 'GOOD ODDS - Address high priority items to maximize approval'
        : 'EXCELLENT ODDS - Deal structure is optimized for approval',
    };
  }

  // Helper methods
  private calculateLenderLikelihood(scoreBuffer: number, lenderType: string): string {
    if (scoreBuffer >= 50) return 'Very High';
    if (scoreBuffer >= 20) return 'High';
    if (scoreBuffer >= 0) return 'Medium';
    return 'Low';
  }

  private calculatePriority(lender: LenderConfig, tier: any, vehicle: Vehicle): number {
    let priority = 50;

    // Credit union bonus for good rates
    if (lender.type === 'credit-union') priority += 10;

    // Captive bonus for matching make
    if (lender.type === 'captive') {
      if (vehicle.make === 'GMC' || vehicle.make === 'Buick' || vehicle.make === 'Chevrolet') {
        priority += 20;
      }
    }

    // Rate-based priority
    priority -= tier.baseRate;

    // CPO bonus
    if (vehicle.certified) priority += 5;

    return priority;
  }

  private calculateDownForPayment(
    currentAmount: number,
    rate: number,
    term: number,
    targetPayment: number
  ): number {
    const maxPrincipal = calculatePrincipalFromPayment(targetPayment, rate, term);
    return Math.max(0, Math.ceil(currentAmount - maxPrincipal));
  }

  private generateSweetSpotNotes(
    idealDown: number,
    currentDown: number,
    idealTerm: number,
    currentTerm: number
  ): string[] {
    const notes: string[] = [];

    if (idealDown > currentDown) {
      notes.push(`Increase down payment by $${(idealDown - currentDown).toLocaleString()}`);
    }
    if (idealTerm !== currentTerm) {
      notes.push(`${idealTerm > currentTerm ? 'Extend' : 'Shorten'} term to ${idealTerm} months`);
    }
    if (notes.length === 0) {
      notes.push('Current structure is already optimized');
    }

    return notes;
  }
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface OptimizationParams {
  credit: CreditProfile;
  vehicle: Vehicle;
  sellingPrice: number;
  amountFinanced: number;
  vehicleValue: number;
  term: number;
  downPayment?: number;
  fees?: number;
  fiProducts?: FIProduct[];
  fiFinanced?: number;
}

export interface OptimizationResult {
  currentAnalysis: CurrentAnalysis;
  targetLenders: TargetLender[];
  recommendations: DealOptimization[];
  sweetSpotDeal: SweetSpotDeal;
  actionPlan: ActionStep[];
  approvalProbability: ApprovalProbability;
}

export interface TargetLender {
  lender: LenderConfig;
  tier: string;
  baseRate: number;
  maxLTV: number;
  maxPTI: number;
  maxDTI: number;
  maxTerm: number;
  minDownPercent: number;
  scoreBuffer: number;
  autoApprovalThreshold: AutoApprovalThreshold | null;
  likelihood: string;
  priority: number;
}

export interface DealOptimization {
  type: string;
  priority: 'critical' | 'high' | 'recommended' | 'optional';
  title: string;
  description: string;
  currentValue: string;
  targetValue: string;
  impact: string;
  estimatedApprovalIncrease: number;
  calculation?: any;
  solutions?: Array<{ method: string; action: string }>;
}

export interface SweetSpotDeal {
  achievable: boolean;
  targetLender?: string;
  structure?: {
    sellingPrice: number;
    downPayment: number;
    term: number;
    apr: number;
    monthlyPayment: number;
    amountFinanced: number;
  };
  metrics?: {
    ltv: number;
    pti: number;
    targetLTV: number;
    targetPTI: number;
  };
  comparison?: {
    downPaymentDiff: number;
    termDiff: number;
    paymentDiff: number;
  };
  approvalProbability?: number;
  notes?: string[];
  reason?: string;
}

export interface ActionStep {
  step: number;
  action: string;
  details: string;
  requirement: string;
  implementation: string;
}

export interface CurrentAnalysis {
  ficoAutoScore: number;
  riskTier: string;
  currentLTV: number;
  currentPTI: number;
  currentDTI: number;
  currentPayment: number;
  issues: string[];
  strengths: string[];
}

export interface ApprovalProbability {
  currentAsStructured: number;
  ifOptimized: number;
  criticalIssues: number;
  highIssues: number;
  recommendation: string;
}

// Export singleton
export const dealStructureOptimizer = new DealStructureOptimizer();
