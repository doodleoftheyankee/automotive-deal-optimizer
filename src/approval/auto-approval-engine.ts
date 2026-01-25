// ============================================================================
// AUTO-APPROVAL ENGINE
// Mimics Lender Automated Decisioning Engines (ADE)
// Helps structure deals to trigger automatic approvals
// ============================================================================

import {
  CreditProfile,
  CreditTier,
  Vehicle,
  LenderConfig,
  ApprovalStatus,
} from '../types';
import { lenders, getCreditTierForScore } from '../config/lenders';
import {
  calculateMonthlyPayment,
  calculateLTV,
  calculatePTI,
  calculateDTI,
} from '../calculators/payment';

// ============================================================================
// FICO AUTO SCORE SIMULATION
// Auto-enhanced FICO scores weight auto loan history more heavily
// ============================================================================

export interface FICOAutoScore {
  baseScore: number;
  autoScore: number; // FICO Auto Score 8/9 typically used by lenders
  factors: ScoreFactor[];
  riskTier: RiskTier;
}

export interface ScoreFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: 'high' | 'medium' | 'low';
  description: string;
}

export type RiskTier = 'A+' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export function calculateFICOAutoScore(credit: CreditProfile): FICOAutoScore {
  let autoScore = credit.score;
  const factors: ScoreFactor[] = [];

  // FICO Auto Score adjustments based on auto-specific factors

  // Existing auto loan history (positive if good payment history)
  if (credit.openAutoLoans !== undefined) {
    if (credit.openAutoLoans >= 1 && credit.openAutoLoans <= 2) {
      autoScore += 15;
      factors.push({
        factor: 'Current Auto Loan',
        impact: 'positive',
        weight: 'high',
        description: 'Active auto loan with payment history demonstrates auto credit experience',
      });
    } else if (credit.openAutoLoans === 0) {
      factors.push({
        factor: 'No Auto History',
        impact: 'neutral',
        weight: 'medium',
        description: 'No prior auto loans - first time auto buyer',
      });
    } else if (credit.openAutoLoans > 2) {
      autoScore -= 10;
      factors.push({
        factor: 'Multiple Auto Loans',
        impact: 'negative',
        weight: 'medium',
        description: 'Multiple open auto loans may indicate over-extension',
      });
    }
  }

  // Bankruptcy impact on auto score
  if (credit.bankruptcyHistory) {
    if (credit.bankruptcyAge && credit.bankruptcyAge < 12) {
      autoScore -= 50;
      factors.push({
        factor: 'Recent Bankruptcy',
        impact: 'negative',
        weight: 'high',
        description: 'Bankruptcy within 12 months severely impacts auto lending decisions',
      });
    } else if (credit.bankruptcyAge && credit.bankruptcyAge < 24) {
      autoScore -= 30;
      factors.push({
        factor: 'Bankruptcy 12-24 months',
        impact: 'negative',
        weight: 'high',
        description: 'Bankruptcy between 12-24 months still significantly impacts score',
      });
    } else if (credit.bankruptcyAge && credit.bankruptcyAge >= 24) {
      autoScore -= 15;
      factors.push({
        factor: 'Bankruptcy 24+ months',
        impact: 'negative',
        weight: 'medium',
        description: 'Bankruptcy over 24 months has reduced but notable impact',
      });
    }
  }

  // Repo history
  if (credit.repoHistory) {
    if (credit.repoAge && credit.repoAge < 24) {
      autoScore -= 60;
      factors.push({
        factor: 'Recent Repossession',
        impact: 'negative',
        weight: 'high',
        description: 'Auto repossession within 24 months is a major red flag for auto lenders',
      });
    } else {
      autoScore -= 25;
      factors.push({
        factor: 'Past Repossession',
        impact: 'negative',
        weight: 'medium',
        description: 'Past repossession still impacts auto-specific scoring',
      });
    }
  }

  // Time on job stability
  if (credit.timeOnJob !== undefined) {
    if (credit.timeOnJob >= 24) {
      autoScore += 10;
      factors.push({
        factor: 'Job Stability',
        impact: 'positive',
        weight: 'medium',
        description: '2+ years at current job demonstrates stability',
      });
    } else if (credit.timeOnJob < 6) {
      autoScore -= 10;
      factors.push({
        factor: 'New Employment',
        impact: 'negative',
        weight: 'medium',
        description: 'Less than 6 months at current job indicates instability',
      });
    }
  }

  // Time at residence
  if (credit.timeAtResidence !== undefined) {
    if (credit.timeAtResidence >= 24) {
      autoScore += 5;
      factors.push({
        factor: 'Residence Stability',
        impact: 'positive',
        weight: 'low',
        description: '2+ years at current residence is favorable',
      });
    } else if (credit.timeAtResidence < 6) {
      autoScore -= 5;
      factors.push({
        factor: 'New Residence',
        impact: 'negative',
        weight: 'low',
        description: 'Less than 6 months at residence may indicate instability',
      });
    }
  }

  // Determine risk tier
  const riskTier = getRiskTier(autoScore);

  return {
    baseScore: credit.score,
    autoScore: Math.max(300, Math.min(850, autoScore)),
    factors,
    riskTier,
  };
}

function getRiskTier(score: number): RiskTier {
  if (score >= 780) return 'A+';
  if (score >= 720) return 'A';
  if (score >= 660) return 'B';
  if (score >= 600) return 'C';
  if (score >= 540) return 'D';
  if (score >= 480) return 'E';
  return 'F';
}

// ============================================================================
// AUTOMATED DECISIONING ENGINE (ADE) SIMULATION
// Mimics how lenders like Ally, GM Financial, Chase process applications
// ============================================================================

export interface ADEDecision {
  lenderId: string;
  lenderName: string;
  decision: 'AUTO_APPROVED' | 'CONDITIONAL' | 'PENDING_REVIEW' | 'DECLINED';
  decisionTime: 'instant' | '< 5 min' | '< 30 min' | 'manual review';
  score: number; // 0-1000 internal risk score
  tier: string;
  approvedRate?: number;
  approvedTerm?: number;
  maxApprovedAmount?: number;
  conditions: string[];
  declineReasons: string[];
  riskFactors: ADERiskFactor[];
  autoApprovalPath: AutoApprovalPath;
}

export interface ADERiskFactor {
  category: string;
  factor: string;
  value: number | string;
  threshold: number | string;
  status: 'pass' | 'warn' | 'fail';
  points: number; // positive = good, negative = bad
}

export interface AutoApprovalPath {
  eligible: boolean;
  missingCriteria: string[];
  adjustmentsNeeded: ApprovalAdjustment[];
  probabilityIfAdjusted: number;
}

export interface ApprovalAdjustment {
  type: 'increase_down' | 'reduce_amount' | 'shorten_term' | 'add_cosigner' | 'different_vehicle' | 'reduce_backend';
  description: string;
  currentValue: number | string;
  targetValue: number | string;
  impactOnApproval: 'high' | 'medium' | 'low';
  priorityOrder: number;
}

export class AutoDecisioningEngine {
  /**
   * Simulate how a lender's ADE processes the application
   */
  processApplication(params: ADEParams): ADEDecision[] {
    const decisions: ADEDecision[] = [];

    for (const lender of lenders.filter((l) => l.active)) {
      const decision = this.evaluateLender(lender, params);
      decisions.push(decision);
    }

    // Sort by decision quality and rate
    return decisions.sort((a, b) => {
      const decisionOrder = {
        AUTO_APPROVED: 0,
        CONDITIONAL: 1,
        PENDING_REVIEW: 2,
        DECLINED: 3,
      };
      const orderDiff = decisionOrder[a.decision] - decisionOrder[b.decision];
      if (orderDiff !== 0) return orderDiff;
      return (a.approvedRate || 99) - (b.approvedRate || 99);
    });
  }

  private evaluateLender(lender: LenderConfig, params: ADEParams): ADEDecision {
    const riskFactors: ADERiskFactor[] = [];
    let riskScore = 500; // Start at midpoint
    const conditions: string[] = [];
    const declineReasons: string[] = [];

    const ficoAuto = calculateFICOAutoScore(params.credit);
    const vehicleAge = new Date().getFullYear() - params.vehicle.year;

    // Find applicable tier
    const tierConfig = lender.creditTiers.find(
      (t) => ficoAuto.autoScore >= t.minScore && (!t.maxScore || ficoAuto.autoScore <= t.maxScore)
    );

    if (!tierConfig) {
      return this.createDeclinedDecision(lender, 'Credit score below minimum requirements', riskFactors);
    }

    // =========================================================================
    // CREDIT SCORING (40% of decision weight)
    // =========================================================================

    const creditPoints = this.evaluateCredit(ficoAuto, tierConfig, riskFactors);
    riskScore += creditPoints * 0.4;

    // =========================================================================
    // LTV ANALYSIS (25% of decision weight)
    // =========================================================================

    const ltv = calculateLTV(params.amountFinanced, params.vehicleValue);
    const ltvPoints = this.evaluateLTV(ltv, tierConfig.maxLTV, vehicleAge, lender, riskFactors);
    riskScore += ltvPoints * 0.25;

    // =========================================================================
    // PAYMENT AFFORDABILITY - PTI/DTI (20% of decision weight)
    // =========================================================================

    const payment = calculateMonthlyPayment(params.amountFinanced, tierConfig.baseRate, params.term);
    const pti = calculatePTI(payment, params.credit.monthlyIncome);
    const dti = calculateDTI(payment, params.credit.monthlyDebt || 0, params.credit.monthlyIncome);

    const affordabilityPoints = this.evaluateAffordability(pti, dti, tierConfig, riskFactors);
    riskScore += affordabilityPoints * 0.2;

    // =========================================================================
    // VEHICLE EVALUATION (10% of decision weight)
    // =========================================================================

    const vehiclePoints = this.evaluateVehicle(params.vehicle, lender, riskFactors);
    riskScore += vehiclePoints * 0.1;

    // =========================================================================
    // STABILITY FACTORS (5% of decision weight)
    // =========================================================================

    const stabilityPoints = this.evaluateStability(params.credit, riskFactors);
    riskScore += stabilityPoints * 0.05;

    // =========================================================================
    // DETERMINE DECISION
    // =========================================================================

    const failedFactors = riskFactors.filter((f) => f.status === 'fail');
    const warnFactors = riskFactors.filter((f) => f.status === 'warn');

    let decision: ADEDecision['decision'];
    let decisionTime: ADEDecision['decisionTime'];

    if (failedFactors.length > 0) {
      if (failedFactors.some((f) => f.category === 'Credit' || f.category === 'Vehicle')) {
        decision = 'DECLINED';
        decisionTime = 'instant';
        declineReasons.push(...failedFactors.map((f) => f.factor));
      } else {
        decision = 'PENDING_REVIEW';
        decisionTime = 'manual review';
        conditions.push(...failedFactors.map((f) => `Review required: ${f.factor}`));
      }
    } else if (warnFactors.length > 2) {
      decision = 'CONDITIONAL';
      decisionTime = '< 30 min';
      if (tierConfig.stipulations) {
        conditions.push(...tierConfig.stipulations);
      }
    } else if (warnFactors.length > 0) {
      decision = 'CONDITIONAL';
      decisionTime = '< 5 min';
      if (tierConfig.stipulations) {
        conditions.push(...tierConfig.stipulations);
      }
    } else {
      decision = 'AUTO_APPROVED';
      decisionTime = 'instant';
    }

    // Calculate auto-approval path
    const autoApprovalPath = this.calculateAutoApprovalPath(
      params,
      tierConfig,
      lender,
      riskFactors,
      ltv,
      pti,
      dti
    );

    return {
      lenderId: lender.id,
      lenderName: lender.name,
      decision,
      decisionTime,
      score: Math.round(riskScore),
      tier: tierConfig.tier,
      approvedRate: decision !== 'DECLINED' ? tierConfig.baseRate : undefined,
      approvedTerm: decision !== 'DECLINED' ? Math.min(params.term, tierConfig.maxTerm) : undefined,
      maxApprovedAmount: decision !== 'DECLINED' ? params.vehicleValue * (tierConfig.maxLTV / 100) : undefined,
      conditions,
      declineReasons,
      riskFactors,
      autoApprovalPath,
    };
  }

  private evaluateCredit(
    ficoAuto: FICOAutoScore,
    tierConfig: any,
    factors: ADERiskFactor[]
  ): number {
    let points = 0;

    // FICO Auto Score evaluation
    const scoreAboveMin = ficoAuto.autoScore - tierConfig.minScore;
    if (scoreAboveMin >= 50) {
      points += 100;
      factors.push({
        category: 'Credit',
        factor: 'FICO Auto Score',
        value: ficoAuto.autoScore,
        threshold: `${tierConfig.minScore}+ (50+ above min ideal)`,
        status: 'pass',
        points: 100,
      });
    } else if (scoreAboveMin >= 20) {
      points += 50;
      factors.push({
        category: 'Credit',
        factor: 'FICO Auto Score',
        value: ficoAuto.autoScore,
        threshold: `${tierConfig.minScore}+ (20+ above min good)`,
        status: 'pass',
        points: 50,
      });
    } else if (scoreAboveMin >= 0) {
      points += 0;
      factors.push({
        category: 'Credit',
        factor: 'FICO Auto Score',
        value: ficoAuto.autoScore,
        threshold: `${tierConfig.minScore} (at minimum)`,
        status: 'warn',
        points: 0,
      });
    } else {
      points -= 100;
      factors.push({
        category: 'Credit',
        factor: 'FICO Auto Score',
        value: ficoAuto.autoScore,
        threshold: tierConfig.minScore,
        status: 'fail',
        points: -100,
      });
    }

    // Risk tier bonus
    if (ficoAuto.riskTier === 'A+' || ficoAuto.riskTier === 'A') {
      points += 50;
    } else if (ficoAuto.riskTier === 'B') {
      points += 25;
    } else if (ficoAuto.riskTier === 'D' || ficoAuto.riskTier === 'E') {
      points -= 25;
    } else if (ficoAuto.riskTier === 'F') {
      points -= 50;
    }

    return points;
  }

  private evaluateLTV(
    ltv: number,
    maxLTV: number,
    vehicleAge: number,
    lender: LenderConfig,
    factors: ADERiskFactor[]
  ): number {
    let points = 0;

    // Check age-adjusted LTV if available
    let effectiveMaxLTV = maxLTV;
    if (lender.loanLimits.maxLTVByAge && lender.loanLimits.maxLTVByAge[vehicleAge]) {
      effectiveMaxLTV = lender.loanLimits.maxLTVByAge[vehicleAge];
    }

    const ltvBuffer = effectiveMaxLTV - ltv;

    if (ltvBuffer >= 20) {
      points += 100;
      factors.push({
        category: 'LTV',
        factor: 'Loan to Value Ratio',
        value: `${ltv.toFixed(1)}%`,
        threshold: `≤${effectiveMaxLTV}% (${ltvBuffer.toFixed(1)}% buffer)`,
        status: 'pass',
        points: 100,
      });
    } else if (ltvBuffer >= 10) {
      points += 50;
      factors.push({
        category: 'LTV',
        factor: 'Loan to Value Ratio',
        value: `${ltv.toFixed(1)}%`,
        threshold: `≤${effectiveMaxLTV}%`,
        status: 'pass',
        points: 50,
      });
    } else if (ltvBuffer >= 0) {
      points += 0;
      factors.push({
        category: 'LTV',
        factor: 'Loan to Value Ratio',
        value: `${ltv.toFixed(1)}%`,
        threshold: `≤${effectiveMaxLTV}% (at limit)`,
        status: 'warn',
        points: 0,
      });
    } else {
      points -= 100;
      factors.push({
        category: 'LTV',
        factor: 'Loan to Value Ratio',
        value: `${ltv.toFixed(1)}%`,
        threshold: `≤${effectiveMaxLTV}%`,
        status: 'fail',
        points: -100,
      });
    }

    return points;
  }

  private evaluateAffordability(
    pti: number,
    dti: number,
    tierConfig: any,
    factors: ADERiskFactor[]
  ): number {
    let points = 0;

    // PTI Evaluation
    const ptiBuffer = tierConfig.maxPTI - pti;
    if (ptiBuffer >= 5) {
      points += 50;
      factors.push({
        category: 'Affordability',
        factor: 'Payment to Income (PTI)',
        value: `${pti.toFixed(1)}%`,
        threshold: `≤${tierConfig.maxPTI}%`,
        status: 'pass',
        points: 50,
      });
    } else if (ptiBuffer >= 0) {
      points += 0;
      factors.push({
        category: 'Affordability',
        factor: 'Payment to Income (PTI)',
        value: `${pti.toFixed(1)}%`,
        threshold: `≤${tierConfig.maxPTI}% (at limit)`,
        status: 'warn',
        points: 0,
      });
    } else {
      points -= 50;
      factors.push({
        category: 'Affordability',
        factor: 'Payment to Income (PTI)',
        value: `${pti.toFixed(1)}%`,
        threshold: `≤${tierConfig.maxPTI}%`,
        status: 'fail',
        points: -50,
      });
    }

    // DTI Evaluation
    if (tierConfig.maxDTI) {
      const dtiBuffer = tierConfig.maxDTI - dti;
      if (dtiBuffer >= 10) {
        points += 50;
        factors.push({
          category: 'Affordability',
          factor: 'Debt to Income (DTI)',
          value: `${dti.toFixed(1)}%`,
          threshold: `≤${tierConfig.maxDTI}%`,
          status: 'pass',
          points: 50,
        });
      } else if (dtiBuffer >= 0) {
        points += 0;
        factors.push({
          category: 'Affordability',
          factor: 'Debt to Income (DTI)',
          value: `${dti.toFixed(1)}%`,
          threshold: `≤${tierConfig.maxDTI}% (at limit)`,
          status: 'warn',
          points: 0,
        });
      } else {
        points -= 50;
        factors.push({
          category: 'Affordability',
          factor: 'Debt to Income (DTI)',
          value: `${dti.toFixed(1)}%`,
          threshold: `≤${tierConfig.maxDTI}%`,
          status: 'fail',
          points: -50,
        });
      }
    }

    return points;
  }

  private evaluateVehicle(
    vehicle: Vehicle,
    lender: LenderConfig,
    factors: ADERiskFactor[]
  ): number {
    let points = 0;
    const vehicleAge = new Date().getFullYear() - vehicle.year;
    const restrictions = lender.vehicleRestrictions;

    // Age check
    if (vehicleAge <= restrictions.maxAge - 3) {
      points += 30;
      factors.push({
        category: 'Vehicle',
        factor: 'Vehicle Age',
        value: `${vehicleAge} years`,
        threshold: `≤${restrictions.maxAge} years`,
        status: 'pass',
        points: 30,
      });
    } else if (vehicleAge <= restrictions.maxAge) {
      points += 0;
      factors.push({
        category: 'Vehicle',
        factor: 'Vehicle Age',
        value: `${vehicleAge} years`,
        threshold: `≤${restrictions.maxAge} years`,
        status: 'warn',
        points: 0,
      });
    } else {
      points -= 100;
      factors.push({
        category: 'Vehicle',
        factor: 'Vehicle Age',
        value: `${vehicleAge} years`,
        threshold: `≤${restrictions.maxAge} years`,
        status: 'fail',
        points: -100,
      });
    }

    // Mileage check
    if (vehicle.mileage <= restrictions.maxMileage * 0.7) {
      points += 30;
      factors.push({
        category: 'Vehicle',
        factor: 'Mileage',
        value: vehicle.mileage.toLocaleString(),
        threshold: `≤${restrictions.maxMileage.toLocaleString()}`,
        status: 'pass',
        points: 30,
      });
    } else if (vehicle.mileage <= restrictions.maxMileage) {
      points += 0;
      factors.push({
        category: 'Vehicle',
        factor: 'Mileage',
        value: vehicle.mileage.toLocaleString(),
        threshold: `≤${restrictions.maxMileage.toLocaleString()}`,
        status: 'warn',
        points: 0,
      });
    } else {
      points -= 100;
      factors.push({
        category: 'Vehicle',
        factor: 'Mileage',
        value: vehicle.mileage.toLocaleString(),
        threshold: `≤${restrictions.maxMileage.toLocaleString()}`,
        status: 'fail',
        points: -100,
      });
    }

    // CPO bonus
    if (vehicle.certified) {
      points += 40;
      factors.push({
        category: 'Vehicle',
        factor: 'Certified Pre-Owned',
        value: 'Yes',
        threshold: 'CPO Preferred',
        status: 'pass',
        points: 40,
      });
    }

    return points;
  }

  private evaluateStability(credit: CreditProfile, factors: ADERiskFactor[]): number {
    let points = 0;

    // Time on job
    if (credit.timeOnJob !== undefined) {
      if (credit.timeOnJob >= 24) {
        points += 30;
        factors.push({
          category: 'Stability',
          factor: 'Employment Tenure',
          value: `${credit.timeOnJob} months`,
          threshold: '≥24 months ideal',
          status: 'pass',
          points: 30,
        });
      } else if (credit.timeOnJob >= 12) {
        points += 10;
        factors.push({
          category: 'Stability',
          factor: 'Employment Tenure',
          value: `${credit.timeOnJob} months`,
          threshold: '≥12 months acceptable',
          status: 'pass',
          points: 10,
        });
      } else if (credit.timeOnJob >= 6) {
        points += 0;
        factors.push({
          category: 'Stability',
          factor: 'Employment Tenure',
          value: `${credit.timeOnJob} months`,
          threshold: '≥6 months minimum',
          status: 'warn',
          points: 0,
        });
      } else {
        points -= 20;
        factors.push({
          category: 'Stability',
          factor: 'Employment Tenure',
          value: `${credit.timeOnJob} months`,
          threshold: '≥6 months minimum',
          status: 'warn',
          points: -20,
        });
      }
    }

    // Time at residence
    if (credit.timeAtResidence !== undefined) {
      if (credit.timeAtResidence >= 24) {
        points += 20;
        factors.push({
          category: 'Stability',
          factor: 'Residence Tenure',
          value: `${credit.timeAtResidence} months`,
          threshold: '≥24 months ideal',
          status: 'pass',
          points: 20,
        });
      } else if (credit.timeAtResidence >= 12) {
        points += 5;
        factors.push({
          category: 'Stability',
          factor: 'Residence Tenure',
          value: `${credit.timeAtResidence} months`,
          threshold: '≥12 months acceptable',
          status: 'pass',
          points: 5,
        });
      }
    }

    return points;
  }

  private calculateAutoApprovalPath(
    params: ADEParams,
    tierConfig: any,
    lender: LenderConfig,
    factors: ADERiskFactor[],
    currentLTV: number,
    currentPTI: number,
    currentDTI: number
  ): AutoApprovalPath {
    const failedFactors = factors.filter((f) => f.status === 'fail');
    const warnFactors = factors.filter((f) => f.status === 'warn');
    const adjustments: ApprovalAdjustment[] = [];
    const missingCriteria: string[] = [];

    if (failedFactors.length === 0 && warnFactors.length === 0) {
      return {
        eligible: true,
        missingCriteria: [],
        adjustmentsNeeded: [],
        probabilityIfAdjusted: 95,
      };
    }

    let priority = 1;

    // Analyze each issue and suggest fixes
    for (const factor of [...failedFactors, ...warnFactors]) {
      if (factor.category === 'LTV' && currentLTV > tierConfig.maxLTV) {
        const excessAmount = params.amountFinanced - (params.vehicleValue * tierConfig.maxLTV / 100);
        adjustments.push({
          type: 'increase_down',
          description: `Increase down payment by $${Math.ceil(excessAmount).toLocaleString()} to bring LTV to ${tierConfig.maxLTV}%`,
          currentValue: `$${params.downPayment?.toLocaleString() || 0}`,
          targetValue: `$${((params.downPayment || 0) + Math.ceil(excessAmount)).toLocaleString()}`,
          impactOnApproval: 'high',
          priorityOrder: priority++,
        });
        missingCriteria.push(`LTV ${currentLTV.toFixed(1)}% exceeds max ${tierConfig.maxLTV}%`);
      }

      if (factor.category === 'Affordability' && factor.factor.includes('PTI')) {
        const targetPayment = params.credit.monthlyIncome * (tierConfig.maxPTI / 100);
        const currentPayment = calculateMonthlyPayment(params.amountFinanced, tierConfig.baseRate, params.term);

        if (currentPayment > targetPayment) {
          // Option 1: Extend term
          const longerTerm = Math.min(tierConfig.maxTerm, params.term + 12);
          const newPayment = calculateMonthlyPayment(params.amountFinanced, tierConfig.baseRate, longerTerm);

          if (newPayment <= targetPayment && longerTerm > params.term) {
            adjustments.push({
              type: 'shorten_term',
              description: `Extend term to ${longerTerm} months to lower payment`,
              currentValue: `${params.term} months ($${currentPayment.toFixed(0)}/mo)`,
              targetValue: `${longerTerm} months ($${newPayment.toFixed(0)}/mo)`,
              impactOnApproval: 'medium',
              priorityOrder: priority++,
            });
          }

          // Option 2: Reduce amount financed
          const maxAmount = (targetPayment * ((1 + tierConfig.baseRate/100/12) ** params.term - 1)) /
            ((tierConfig.baseRate/100/12) * (1 + tierConfig.baseRate/100/12) ** params.term);
          const reduceBy = params.amountFinanced - maxAmount;

          if (reduceBy > 0) {
            adjustments.push({
              type: 'increase_down',
              description: `Increase down payment by $${Math.ceil(reduceBy).toLocaleString()} to meet PTI requirement`,
              currentValue: `${currentPTI.toFixed(1)}% PTI`,
              targetValue: `≤${tierConfig.maxPTI}% PTI`,
              impactOnApproval: 'high',
              priorityOrder: priority++,
            });
          }

          missingCriteria.push(`PTI ${currentPTI.toFixed(1)}% exceeds max ${tierConfig.maxPTI}%`);
        }
      }

      if (factor.category === 'Credit' && factor.status === 'fail') {
        adjustments.push({
          type: 'add_cosigner',
          description: 'Add a co-signer with stronger credit to improve approval odds',
          currentValue: `Score: ${params.credit.score}`,
          targetValue: `Co-signer score: 680+`,
          impactOnApproval: 'high',
          priorityOrder: priority++,
        });
        missingCriteria.push(`Credit score ${params.credit.score} below minimum ${tierConfig.minScore}`);
      }

      if (factor.category === 'Vehicle' && factor.status === 'fail') {
        missingCriteria.push(factor.factor);
        adjustments.push({
          type: 'different_vehicle',
          description: 'Select a different vehicle that meets lender guidelines',
          currentValue: factor.value.toString(),
          targetValue: factor.threshold.toString(),
          impactOnApproval: 'high',
          priorityOrder: priority++,
        });
      }
    }

    // Calculate probability if adjustments made
    let probability = 50;
    if (failedFactors.length === 0) {
      probability = 75;
    }
    if (adjustments.length > 0) {
      const highImpact = adjustments.filter((a) => a.impactOnApproval === 'high').length;
      probability = Math.min(90, probability + highImpact * 15);
    }

    return {
      eligible: failedFactors.length === 0,
      missingCriteria,
      adjustmentsNeeded: adjustments.sort((a, b) => a.priorityOrder - b.priorityOrder),
      probabilityIfAdjusted: probability,
    };
  }

  private createDeclinedDecision(
    lender: LenderConfig,
    reason: string,
    factors: ADERiskFactor[]
  ): ADEDecision {
    return {
      lenderId: lender.id,
      lenderName: lender.name,
      decision: 'DECLINED',
      decisionTime: 'instant',
      score: 0,
      tier: 'N/A',
      conditions: [],
      declineReasons: [reason],
      riskFactors: factors,
      autoApprovalPath: {
        eligible: false,
        missingCriteria: [reason],
        adjustmentsNeeded: [],
        probabilityIfAdjusted: 0,
      },
    };
  }
}

// ============================================================================
// AUTO-APPROVAL THRESHOLDS BY LENDER
// These are the "sweet spots" that trigger instant auto-approval
// ============================================================================

export interface AutoApprovalThreshold {
  lenderId: string;
  lenderName: string;
  tier: string;
  thresholds: {
    minScore: number;
    maxLTV: number;
    maxPTI: number;
    maxDTI: number;
    maxTerm: number;
    maxVehicleAge: number;
    maxMileage: number;
    minDownPercent: number;
  };
  bonusFactors: string[];
  notes: string;
}

export function getAutoApprovalThresholds(): AutoApprovalThreshold[] {
  return [
    // SUPER-PRIME AUTO-APPROVAL THRESHOLDS
    {
      lenderId: 'psecu',
      lenderName: 'PSECU',
      tier: 'super-prime',
      thresholds: {
        minScore: 750,
        maxLTV: 120,
        maxPTI: 15,
        maxDTI: 40,
        maxTerm: 84,
        maxVehicleAge: 7,
        maxMileage: 80000,
        minDownPercent: 0,
      },
      bonusFactors: ['Existing member', 'Direct deposit setup', 'Auto-pay enrollment'],
      notes: 'PSECU auto-approves instantly for members with 750+ and clean payment history',
    },
    {
      lenderId: 'citadel',
      lenderName: 'Citadel Credit Union',
      tier: 'super-prime',
      thresholds: {
        minScore: 750,
        maxLTV: 120,
        maxPTI: 15,
        maxDTI: 40,
        maxTerm: 84,
        maxVehicleAge: 7,
        maxMileage: 80000,
        minDownPercent: 0,
      },
      bonusFactors: ['Auto-pay from Citadel checking', 'Long-term member'],
      notes: 'Citadel uses rapid automated approval for prime members',
    },
    {
      lenderId: 'gm-financial',
      lenderName: 'GM Financial',
      tier: 'super-prime',
      thresholds: {
        minScore: 750,
        maxLTV: 125,
        maxPTI: 17,
        maxDTI: 45,
        maxTerm: 84,
        maxVehicleAge: 5,
        maxMileage: 60000,
        minDownPercent: 0,
      },
      bonusFactors: ['GM/Buick/GMC vehicle', 'GM CPO', 'Existing GM Financial customer'],
      notes: 'GM Financial auto-approves GM vehicles instantly for 750+ scores',
    },
    {
      lenderId: 'chase',
      lenderName: 'Chase Auto',
      tier: 'super-prime',
      thresholds: {
        minScore: 750,
        maxLTV: 115,
        maxPTI: 13,
        maxDTI: 40,
        maxTerm: 84,
        maxVehicleAge: 6,
        maxMileage: 70000,
        minDownPercent: 0,
      },
      bonusFactors: ['Chase banking relationship', 'Auto-pay enrollment'],
      notes: 'Chase has strict DTI requirements but instant approval for prime',
    },
    {
      lenderId: 'ally',
      lenderName: 'Ally Financial',
      tier: 'super-prime',
      thresholds: {
        minScore: 750,
        maxLTV: 120,
        maxPTI: 15,
        maxDTI: 45,
        maxTerm: 84,
        maxVehicleAge: 8,
        maxMileage: 100000,
        minDownPercent: 0,
      },
      bonusFactors: ['Previous Ally loan with good history', 'CPO vehicle'],
      notes: 'Ally SmartAuction system provides instant decisions',
    },

    // PRIME AUTO-APPROVAL THRESHOLDS
    {
      lenderId: 'ally',
      lenderName: 'Ally Financial',
      tier: 'prime',
      thresholds: {
        minScore: 700,
        maxLTV: 115,
        maxPTI: 14,
        maxDTI: 45,
        maxTerm: 84,
        maxVehicleAge: 7,
        maxMileage: 90000,
        minDownPercent: 5,
      },
      bonusFactors: ['Previous Ally loan', 'Newer vehicle'],
      notes: 'Ally auto-approves prime with minimal down for clean profiles',
    },
    {
      lenderId: 'gm-financial',
      lenderName: 'GM Financial',
      tier: 'prime',
      thresholds: {
        minScore: 700,
        maxLTV: 120,
        maxPTI: 15,
        maxDTI: 45,
        maxTerm: 84,
        maxVehicleAge: 6,
        maxMileage: 75000,
        minDownPercent: 5,
      },
      bonusFactors: ['GM vehicle', 'CPO'],
      notes: 'GM Financial gives best terms on GM products',
    },

    // NEAR-PRIME AUTO-APPROVAL THRESHOLDS
    {
      lenderId: 'ally',
      lenderName: 'Ally Financial',
      tier: 'near-prime',
      thresholds: {
        minScore: 650,
        maxLTV: 110,
        maxPTI: 12,
        maxDTI: 45,
        maxTerm: 72,
        maxVehicleAge: 6,
        maxMileage: 80000,
        minDownPercent: 10,
      },
      bonusFactors: ['Strong income documentation', 'Long job tenure'],
      notes: 'Ally can auto-approve near-prime with strong income and 10%+ down',
    },
    {
      lenderId: 'westlake',
      lenderName: 'Westlake Financial',
      tier: 'near-prime',
      thresholds: {
        minScore: 650,
        maxLTV: 115,
        maxPTI: 15,
        maxDTI: 48,
        maxTerm: 72,
        maxVehicleAge: 10,
        maxMileage: 120000,
        minDownPercent: 10,
      },
      bonusFactors: ['Verifiable income', 'Stable employment'],
      notes: 'Westlake specializes in near-prime with fast approvals',
    },

    // SUBPRIME AUTO-APPROVAL THRESHOLDS
    {
      lenderId: 'westlake',
      lenderName: 'Westlake Financial',
      tier: 'subprime',
      thresholds: {
        minScore: 550,
        maxLTV: 105,
        maxPTI: 12,
        maxDTI: 45,
        maxTerm: 66,
        maxVehicleAge: 10,
        maxMileage: 120000,
        minDownPercent: 15,
      },
      bonusFactors: ['All stipulations pre-submitted', '15%+ down', 'Strong POI'],
      notes: 'Westlake can auto-approve subprime if all docs submitted upfront',
    },
    {
      lenderId: 'first-help',
      lenderName: 'First Help Financial',
      tier: 'subprime',
      thresholds: {
        minScore: 500,
        maxLTV: 100,
        maxPTI: 12,
        maxDTI: 45,
        maxTerm: 60,
        maxVehicleAge: 12,
        maxMileage: 150000,
        minDownPercent: 20,
      },
      bonusFactors: ['20%+ down', 'Bank statements showing disposable income'],
      notes: 'First Help focuses on income verification over credit score',
    },
  ];
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface ADEParams {
  credit: CreditProfile;
  vehicle: Vehicle;
  amountFinanced: number;
  vehicleValue: number;
  term: number;
  downPayment?: number;
}

// Export singleton
export const autoDecisioningEngine = new AutoDecisioningEngine();
