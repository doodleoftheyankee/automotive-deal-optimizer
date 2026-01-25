// ============================================================================
// API ROUTES
// REST API for deal analysis and optimization
// ============================================================================

import { Router, Request, Response } from 'express';
import { Vehicle, CreditProfile } from '../types';
import { DealDesk, defaultFees, stateFeesConfig } from '../desking/deal-desk';
import { LenderMatcher } from '../optimizer/lender-matcher';
import { lenders, getCreditTierForScore } from '../config/lenders';
import {
  AutoDecisioningEngine,
  calculateFICOAutoScore,
  getAutoApprovalThresholds,
} from '../approval/auto-approval-engine';
import { DealStructureOptimizer } from '../approval/deal-structure-optimizer';
import { estimateBookValues, determineVehicleClass } from '../inventory/vehicle-manager';
import {
  calculateMonthlyPayment,
  calculatePayment,
  calculateLTV,
  calculatePTI,
  calculateDTI,
} from '../calculators/payment';

export const apiRouter = Router();

// ============================================================================
// QUICK PAYMENT CALCULATION
// ============================================================================

apiRouter.post('/calculate-payment', (req: Request, res: Response) => {
  try {
    const { amount, rate, term } = req.body;
    const calc = calculatePayment(amount, rate, term, false);

    res.json({
      success: true,
      data: {
        principal: amount,
        apr: rate,
        termMonths: term,
        monthlyPayment: calc.monthlyPayment,
        totalInterest: calc.totalInterest,
        totalOfPayments: calc.totalOfPayments,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============================================================================
// BOOK VALUE ESTIMATE
// ============================================================================

apiRouter.post('/estimate-value', (req: Request, res: Response) => {
  try {
    const { year, make, model, mileage, condition } = req.body;
    const bookValues = estimateBookValues(year, make, model, mileage, condition || 'good');

    res.json({
      success: true,
      data: {
        retail: bookValues.retail,
        wholesale: bookValues.wholesale,
        nada: bookValues.nada,
        kbb: bookValues.kbb,
        blackBook: bookValues.blackBook,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============================================================================
// FULL DEAL ANALYSIS
// ============================================================================

apiRouter.post('/analyze-deal', (req: Request, res: Response) => {
  try {
    const {
      // Vehicle
      vehicleYear,
      vehicleMake,
      vehicleModel,
      vehicleMileage,
      vehicleCondition,
      certified,
      // Pricing
      sellingPrice,
      tradeValue,
      tradePayoff,
      cashDown,
      rebates,
      // Customer
      creditScore,
      monthlyIncome,
      monthlyDebt,
      customerState,
      timeOnJob,
      timeAtResidence,
      bankruptcyHistory,
      bankruptcyAge,
      repoHistory,
      openAutoLoans,
      // Loan
      requestedTerm,
    } = req.body;

    // Build vehicle
    const bookValues = estimateBookValues(
      vehicleYear,
      vehicleMake,
      vehicleModel,
      vehicleMileage,
      vehicleCondition || 'good'
    );

    const vehicle: Vehicle = {
      year: vehicleYear,
      make: vehicleMake,
      model: vehicleModel,
      mileage: vehicleMileage,
      condition: vehicleCondition || 'good',
      certified: certified || false,
      vehicleClass: determineVehicleClass(vehicleMake, vehicleModel),
      bookValue: bookValues,
    };

    // Build credit profile
    const credit: CreditProfile = {
      score: creditScore,
      tier: getCreditTierForScore(creditScore),
      monthlyIncome,
      monthlyDebt: monthlyDebt || 0,
      timeOnJob,
      timeAtResidence,
      bankruptcyHistory,
      bankruptcyAge,
      repoHistory,
      openAutoLoans,
    };

    // Create deal desk
    const desk = new DealDesk(vehicle, credit, customerState || 'DE');
    desk
      .setSellingPrice(sellingPrice)
      .setTrade(tradeValue || 0, tradePayoff || 0)
      .setCashDown(cashDown || 0)
      .setRebates(rebates || 0);

    // Get deal metrics
    const amountFinanced = desk.getAmountFinanced();
    const vehicleValue = desk.getVehicleValue();
    const ltv = desk.getLTV();
    const netTrade = desk.getNetTrade();
    const salesTax = desk.getSalesTax();
    const totalFees = desk.getTotalFees();

    // Get lender recommendations
    const matcher = new LenderMatcher();
    const recommendations = matcher.getRecommendations({
      creditScore,
      credit,
      vehicle,
      amountFinanced,
      vehicleValue,
      requestedTerm: requestedTerm || 72,
      monthlyIncome,
      monthlyDebt: monthlyDebt || 0,
      downPaymentPercent: ((cashDown || 0) / sellingPrice) * 100,
    });

    // Generate payment grid
    const rates = [5.99, 7.99, 9.99, 12.99, 15.99, 19.99];
    const terms = [48, 60, 72, 84];
    const paymentGrid = rates.map((rate) => ({
      rate,
      payments: terms.map((term) => ({
        term,
        payment: calculateMonthlyPayment(amountFinanced, rate, term),
        pti: calculatePTI(calculateMonthlyPayment(amountFinanced, rate, term), monthlyIncome),
      })),
    }));

    res.json({
      success: true,
      data: {
        vehicle: {
          description: `${vehicleYear} ${vehicleMake} ${vehicleModel}`,
          mileage: vehicleMileage,
          certified: certified || false,
          bookValues,
          vehicleClass: vehicle.vehicleClass,
        },
        customer: {
          creditScore,
          creditTier: credit.tier,
          monthlyIncome,
          monthlyDebt: monthlyDebt || 0,
        },
        deal: {
          sellingPrice,
          tradeValue: tradeValue || 0,
          tradePayoff: tradePayoff || 0,
          netTrade,
          cashDown: cashDown || 0,
          rebates: rebates || 0,
          salesTax,
          fees: totalFees,
          amountFinanced,
          vehicleValue,
          ltv,
        },
        lenderRecommendations: recommendations.slice(0, 8).map((rec) => ({
          lender: rec.lender.name,
          lenderType: rec.lender.type,
          apr: rec.terms.apr,
          monthlyPayment: rec.terms.monthlyPayment,
          totalInterest: rec.terms.totalInterest,
          totalOfPayments: rec.terms.totalOfPayments,
          confidence: rec.confidence,
          status: rec.terms.approvalStatus,
          ltv: rec.terms.ltv,
          pti: rec.terms.pti,
          dti: rec.terms.dti,
          conditions: rec.terms.approvalConditions,
          warnings: rec.warnings,
          reasoning: rec.reasoning,
        })),
        paymentGrid,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============================================================================
// AUTO-APPROVAL OPTIMIZATION
// ============================================================================

apiRouter.post('/optimize-approval', (req: Request, res: Response) => {
  try {
    const {
      // Vehicle
      vehicleYear,
      vehicleMake,
      vehicleModel,
      vehicleMileage,
      vehicleCondition,
      certified,
      // Pricing
      sellingPrice,
      tradeValue,
      tradePayoff,
      cashDown,
      fees,
      fiProducts,
      // Customer
      creditScore,
      monthlyIncome,
      monthlyDebt,
      timeOnJob,
      timeAtResidence,
      bankruptcyHistory,
      bankruptcyAge,
      repoHistory,
      openAutoLoans,
      // Loan
      requestedTerm,
    } = req.body;

    // Build vehicle
    const bookValues = estimateBookValues(
      vehicleYear,
      vehicleMake,
      vehicleModel,
      vehicleMileage,
      vehicleCondition || 'good'
    );

    const vehicle: Vehicle = {
      year: vehicleYear,
      make: vehicleMake,
      model: vehicleModel,
      mileage: vehicleMileage,
      condition: vehicleCondition || 'good',
      certified: certified || false,
      vehicleClass: determineVehicleClass(vehicleMake, vehicleModel),
      bookValue: bookValues,
    };

    // Build credit profile
    const credit: CreditProfile = {
      score: creditScore,
      tier: getCreditTierForScore(creditScore),
      monthlyIncome,
      monthlyDebt: monthlyDebt || 0,
      timeOnJob,
      timeAtResidence,
      bankruptcyHistory,
      bankruptcyAge,
      repoHistory,
      openAutoLoans,
    };

    // Calculate amounts
    const netTrade = (tradeValue || 0) - (tradePayoff || 0);
    const totalFees = fees || 600;
    const fiTotal = fiProducts || 0;
    const amountFinanced = sellingPrice + totalFees + fiTotal - (cashDown || 0) - netTrade;
    const vehicleValue = bookValues.retail || sellingPrice;

    // Calculate FICO Auto Score
    const ficoAuto = calculateFICOAutoScore(credit);

    // Run ADE simulation
    const ade = new AutoDecisioningEngine();
    const adeResults = ade.processApplication({
      credit,
      vehicle,
      amountFinanced,
      vehicleValue,
      term: requestedTerm || 72,
      downPayment: cashDown || 0,
    });

    // Run deal structure optimizer
    const optimizer = new DealStructureOptimizer();
    const optimizationResult = optimizer.optimizeForApproval({
      credit,
      vehicle,
      sellingPrice,
      amountFinanced,
      vehicleValue,
      term: requestedTerm || 72,
      downPayment: cashDown || 0,
      fees: totalFees,
      fiFinanced: fiTotal,
    });

    // Get auto-approval thresholds
    const thresholds = getAutoApprovalThresholds();

    res.json({
      success: true,
      data: {
        ficoAutoScore: {
          baseScore: credit.score,
          autoScore: ficoAuto.autoScore,
          riskTier: ficoAuto.riskTier,
          factors: ficoAuto.factors,
        },
        currentMetrics: optimizationResult.currentAnalysis,
        adeResults: adeResults.slice(0, 10).map((result) => ({
          lender: result.lenderName,
          decision: result.decision,
          decisionTime: result.decisionTime,
          score: result.score,
          tier: result.tier,
          rate: result.approvedRate,
          maxAmount: result.maxApprovedAmount,
          conditions: result.conditions,
          declineReasons: result.declineReasons,
          riskFactors: result.riskFactors,
          autoApprovalPath: result.autoApprovalPath,
        })),
        autoApprovalThresholds: thresholds.filter((t) => {
          if (ficoAuto.autoScore >= 750) return t.tier === 'super-prime';
          if (ficoAuto.autoScore >= 700) return t.tier === 'prime' || t.tier === 'super-prime';
          if (ficoAuto.autoScore >= 650) return t.tier === 'near-prime';
          return t.tier === 'subprime' || t.tier === 'deep-subprime';
        }),
        recommendations: optimizationResult.recommendations,
        sweetSpot: optimizationResult.sweetSpotDeal,
        actionPlan: optimizationResult.actionPlan,
        approvalProbability: optimizationResult.approvalProbability,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============================================================================
// GET LENDERS
// ============================================================================

apiRouter.get('/lenders', (req: Request, res: Response) => {
  const tier = req.query.tier as string | undefined;

  let filteredLenders = lenders.filter((l) => l.active);

  if (tier) {
    filteredLenders = filteredLenders.filter((l) =>
      l.creditTiers.some((t) => t.tier === tier)
    );
  }

  res.json({
    success: true,
    data: filteredLenders.map((lender) => ({
      id: lender.id,
      name: lender.name,
      type: lender.type,
      creditTiers: lender.creditTiers.map((t) => ({
        tier: t.tier,
        minScore: t.minScore,
        maxScore: t.maxScore,
        baseRate: t.baseRate,
        maxLTV: t.maxLTV,
        maxPTI: t.maxPTI,
        maxDTI: t.maxDTI,
        maxTerm: t.maxTerm,
        minDown: t.minDown,
        stipulations: t.stipulations,
      })),
      vehicleRestrictions: lender.vehicleRestrictions,
      loanLimits: lender.loanLimits,
      programs: lender.programs,
    })),
  });
});

// ============================================================================
// GET CREDIT TIERS
// ============================================================================

apiRouter.get('/credit-tiers', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      {
        tier: 'super-prime',
        range: '750+',
        description: 'Excellent credit - Best rates, highest approvals',
        bestLenders: ['PSECU', 'Citadel', 'GM Financial', 'Bank of America'],
      },
      {
        tier: 'prime',
        range: '700-749',
        description: 'Good credit - Competitive rates, easy approvals',
        bestLenders: ['PSECU', 'Citadel', 'Chase', 'M&T Bank'],
      },
      {
        tier: 'near-prime',
        range: '650-699',
        description: 'Fair credit - Higher rates, some conditions',
        bestLenders: ['Ally Financial', 'GM Financial', 'Dexsta', 'MECU'],
      },
      {
        tier: 'subprime',
        range: '550-649',
        description: 'Challenged credit - Requires documentation, higher rates',
        bestLenders: ['Westlake', 'Ally Financial', 'First Help Financial'],
      },
      {
        tier: 'deep-subprime',
        range: 'Below 550',
        description: 'Credit rebuilding - Specialist lenders, significant down required',
        bestLenders: ['First Help Financial', 'Westlake'],
      },
    ],
  });
});

// ============================================================================
// WHAT-IF ANALYSIS
// ============================================================================

apiRouter.post('/what-if', (req: Request, res: Response) => {
  try {
    const { baseParams, scenarios } = req.body;

    const results = scenarios.map((scenario: any) => {
      const modifiedParams = { ...baseParams, ...scenario.changes };

      // Build vehicle
      const bookValues = estimateBookValues(
        modifiedParams.vehicleYear,
        modifiedParams.vehicleMake,
        modifiedParams.vehicleModel,
        modifiedParams.vehicleMileage,
        modifiedParams.vehicleCondition || 'good'
      );

      const vehicle: Vehicle = {
        year: modifiedParams.vehicleYear,
        make: modifiedParams.vehicleMake,
        model: modifiedParams.vehicleModel,
        mileage: modifiedParams.vehicleMileage,
        condition: modifiedParams.vehicleCondition || 'good',
        certified: modifiedParams.certified || false,
        vehicleClass: determineVehicleClass(modifiedParams.vehicleMake, modifiedParams.vehicleModel),
        bookValue: bookValues,
      };

      const credit: CreditProfile = {
        score: modifiedParams.creditScore,
        tier: getCreditTierForScore(modifiedParams.creditScore),
        monthlyIncome: modifiedParams.monthlyIncome,
        monthlyDebt: modifiedParams.monthlyDebt || 0,
      };

      const netTrade = (modifiedParams.tradeValue || 0) - (modifiedParams.tradePayoff || 0);
      const amountFinanced = modifiedParams.sellingPrice + 600 - (modifiedParams.cashDown || 0) - netTrade;
      const vehicleValue = bookValues.retail || modifiedParams.sellingPrice;

      const ade = new AutoDecisioningEngine();
      const adeResults = ade.processApplication({
        credit,
        vehicle,
        amountFinanced,
        vehicleValue,
        term: modifiedParams.requestedTerm || 72,
        downPayment: modifiedParams.cashDown || 0,
      });

      const best = adeResults[0];

      return {
        name: scenario.name,
        amountFinanced,
        ltv: calculateLTV(amountFinanced, vehicleValue),
        bestDecision: best?.decision,
        bestLender: best?.lenderName,
        rate: best?.approvedRate,
        payment: best ? calculateMonthlyPayment(amountFinanced, best.approvedRate || 10, modifiedParams.requestedTerm || 72) : null,
      };
    });

    res.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});
