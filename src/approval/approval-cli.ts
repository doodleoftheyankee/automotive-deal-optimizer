// ============================================================================
// AUTO-APPROVAL OPTIMIZER CLI
// Interactive interface for optimizing deals for automatic approval
// ============================================================================

import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';

import { Vehicle, CreditProfile } from '../types';
import { getCreditTierForScore } from '../config/lenders';
import {
  AutoDecisioningEngine,
  calculateFICOAutoScore,
  getAutoApprovalThresholds,
  ADEDecision,
} from './auto-approval-engine';
import {
  DealStructureOptimizer,
  OptimizationResult,
} from './deal-structure-optimizer';
import { estimateBookValues, determineVehicleClass } from '../inventory/vehicle-manager';
import { calculateMonthlyPayment, calculateLTV, calculatePTI, calculateDTI } from '../calculators/payment';

// ============================================================================
// MAIN APPROVAL OPTIMIZER FLOW
// ============================================================================

export async function runApprovalOptimizer(): Promise<void> {
  console.clear();
  printHeader();

  // Step 1: Gather deal information
  const { vehicle, credit, dealInfo } = await gatherDealInfo();

  // Step 2: Run ADE simulation
  console.log(chalk.yellow.bold('\n━━━ ANALYZING DEAL THROUGH LENDER ADEs ━━━\n'));
  await simulateProgress('Running credit bureau pull simulation', 1000);
  await simulateProgress('Calculating FICO Auto Score', 800);
  await simulateProgress('Analyzing through 13 lender decision engines', 1500);
  await simulateProgress('Evaluating LTV, PTI, DTI ratios', 600);
  await simulateProgress('Checking vehicle eligibility', 400);
  await simulateProgress('Generating optimization recommendations', 800);

  // Calculate all the metrics
  const ficoAuto = calculateFICOAutoScore(credit);
  const ade = new AutoDecisioningEngine();
  const optimizer = new DealStructureOptimizer();

  const adeResults = ade.processApplication({
    credit,
    vehicle,
    amountFinanced: dealInfo.amountFinanced,
    vehicleValue: dealInfo.vehicleValue,
    term: dealInfo.term,
    downPayment: dealInfo.downPayment,
  });

  const optimizationResult = optimizer.optimizeForApproval({
    credit,
    vehicle,
    sellingPrice: dealInfo.sellingPrice,
    amountFinanced: dealInfo.amountFinanced,
    vehicleValue: dealInfo.vehicleValue,
    term: dealInfo.term,
    downPayment: dealInfo.downPayment,
  });

  // Display results
  console.clear();
  printHeader();

  // FICO Auto Score Analysis
  displayFICOAnalysis(ficoAuto, credit.score);

  // Current Deal Analysis
  displayCurrentDealAnalysis(dealInfo, optimizationResult);

  // ADE Results
  displayADEResults(adeResults);

  // Auto-Approval Thresholds
  displayAutoApprovalThresholds(ficoAuto);

  // Optimization Recommendations
  displayOptimizations(optimizationResult);

  // Sweet Spot Deal Structure
  displaySweetSpot(optimizationResult.sweetSpotDeal);

  // Action Plan
  displayActionPlan(optimizationResult.actionPlan);

  // Approval Probability Meter
  displayApprovalMeter(optimizationResult.approvalProbability);

  // Interactive options
  await handleUserOptions(adeResults, optimizationResult, vehicle, credit, dealInfo);
}

// ============================================================================
// DATA GATHERING
// ============================================================================

async function gatherDealInfo(): Promise<{
  vehicle: Vehicle;
  credit: CreditProfile;
  dealInfo: DealInfo;
}> {
  console.log(chalk.cyan.bold('\n📋 DEAL INFORMATION\n'));

  // Vehicle
  const vehicleAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'year',
      message: 'Vehicle Year:',
      validate: (input) => {
        const year = parseInt(input);
        return year >= 2010 && year <= 2026 ? true : 'Enter a valid year (2010-2026)';
      },
    },
    {
      type: 'input',
      name: 'make',
      message: 'Make:',
      default: 'GMC',
    },
    {
      type: 'input',
      name: 'model',
      message: 'Model:',
    },
    {
      type: 'input',
      name: 'mileage',
      message: 'Mileage:',
    },
    {
      type: 'confirm',
      name: 'certified',
      message: 'Certified Pre-Owned?',
      default: false,
    },
  ]);

  const bookValues = estimateBookValues(
    parseInt(vehicleAnswers.year),
    vehicleAnswers.make,
    vehicleAnswers.model,
    parseInt(vehicleAnswers.mileage),
    'good'
  );

  const vehicle: Vehicle = {
    year: parseInt(vehicleAnswers.year),
    make: vehicleAnswers.make,
    model: vehicleAnswers.model,
    mileage: parseInt(vehicleAnswers.mileage),
    condition: 'good',
    certified: vehicleAnswers.certified,
    vehicleClass: determineVehicleClass(vehicleAnswers.make, vehicleAnswers.model),
    bookValue: bookValues,
  };

  console.log(chalk.gray(`  Book Value (Retail): $${bookValues.retail?.toLocaleString()}`));

  // Credit
  console.log(chalk.cyan.bold('\n💳 CREDIT PROFILE\n'));

  const creditAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'creditScore',
      message: 'Credit Score (300-850):',
      validate: (input) => {
        const score = parseInt(input);
        return score >= 300 && score <= 850 ? true : 'Enter valid score';
      },
    },
    {
      type: 'input',
      name: 'monthlyIncome',
      message: 'Monthly Gross Income: $',
    },
    {
      type: 'input',
      name: 'monthlyDebt',
      message: 'Monthly Debt Payments (credit cards, loans, rent): $',
      default: '0',
    },
    {
      type: 'input',
      name: 'timeOnJob',
      message: 'Time at current job (months):',
      default: '24',
    },
    {
      type: 'input',
      name: 'timeAtResidence',
      message: 'Time at current residence (months):',
      default: '24',
    },
    {
      type: 'confirm',
      name: 'bankruptcy',
      message: 'Any bankruptcy history?',
      default: false,
    },
    {
      type: 'input',
      name: 'bankruptcyAge',
      message: 'Months since discharge:',
      when: (answers) => answers.bankruptcy,
      default: '24',
    },
    {
      type: 'confirm',
      name: 'repo',
      message: 'Any repossession history?',
      default: false,
    },
    {
      type: 'input',
      name: 'openAutoLoans',
      message: 'Current open auto loans (0-3):',
      default: '0',
    },
  ]);

  const credit: CreditProfile = {
    score: parseInt(creditAnswers.creditScore),
    tier: getCreditTierForScore(parseInt(creditAnswers.creditScore)),
    monthlyIncome: parseFloat(creditAnswers.monthlyIncome),
    monthlyDebt: parseFloat(creditAnswers.monthlyDebt),
    timeOnJob: parseInt(creditAnswers.timeOnJob),
    timeAtResidence: parseInt(creditAnswers.timeAtResidence),
    bankruptcyHistory: creditAnswers.bankruptcy,
    bankruptcyAge: creditAnswers.bankruptcy ? parseInt(creditAnswers.bankruptcyAge) : undefined,
    repoHistory: creditAnswers.repo,
    openAutoLoans: parseInt(creditAnswers.openAutoLoans),
  };

  // Deal Structure
  console.log(chalk.cyan.bold('\n💰 DEAL STRUCTURE\n'));

  const dealAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'sellingPrice',
      message: 'Selling Price: $',
      default: bookValues.retail?.toString(),
    },
    {
      type: 'input',
      name: 'downPayment',
      message: 'Down Payment: $',
      default: '0',
    },
    {
      type: 'input',
      name: 'tradeEquity',
      message: 'Net Trade Equity (value - payoff): $',
      default: '0',
    },
    {
      type: 'input',
      name: 'fees',
      message: 'Total Fees & Tax: $',
      default: '600',
    },
    {
      type: 'input',
      name: 'fiProducts',
      message: 'Financed F&I Products: $',
      default: '0',
    },
    {
      type: 'list',
      name: 'term',
      message: 'Requested Term:',
      choices: ['48', '60', '66', '72', '75', '84'],
      default: '72',
    },
  ]);

  const sellingPrice = parseFloat(dealAnswers.sellingPrice);
  const downPayment = parseFloat(dealAnswers.downPayment);
  const tradeEquity = parseFloat(dealAnswers.tradeEquity);
  const fees = parseFloat(dealAnswers.fees);
  const fiProducts = parseFloat(dealAnswers.fiProducts);
  const term = parseInt(dealAnswers.term);

  const amountFinanced = sellingPrice + fees + fiProducts - downPayment - tradeEquity;

  return {
    vehicle,
    credit,
    dealInfo: {
      sellingPrice,
      downPayment,
      tradeEquity,
      fees,
      fiProducts,
      term,
      amountFinanced,
      vehicleValue: bookValues.retail || sellingPrice,
    },
  };
}

// ============================================================================
// DISPLAY FUNCTIONS
// ============================================================================

function printHeader(): void {
  console.log(chalk.blue.bold('╔════════════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.blue.bold('║           🎯 AUTO-APPROVAL OPTIMIZER - Lender ADE Simulation 🎯           ║'));
  console.log(chalk.blue.bold('║     Structure deals to trigger AUTOMATIC APPROVAL from lender systems     ║'));
  console.log(chalk.blue.bold('╚════════════════════════════════════════════════════════════════════════════╝'));
}

function displayFICOAnalysis(ficoAuto: any, baseScore: number): void {
  console.log(chalk.yellow.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.yellow.bold('  📊 FICO AUTO SCORE ANALYSIS (What Lenders Actually See)'));
  console.log(chalk.yellow.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  const scoreColor = ficoAuto.autoScore >= 720 ? chalk.green :
    ficoAuto.autoScore >= 660 ? chalk.yellow :
    ficoAuto.autoScore >= 600 ? chalk.hex('#FFA500') : chalk.red;

  console.log(`  Base Credit Score:     ${baseScore}`);
  console.log(`  ${chalk.bold('FICO Auto Score:')}       ${scoreColor.bold(ficoAuto.autoScore)} ${ficoAuto.autoScore > baseScore ? chalk.green(`(+${ficoAuto.autoScore - baseScore})`) : ficoAuto.autoScore < baseScore ? chalk.red(`(${ficoAuto.autoScore - baseScore})`) : ''}`);
  console.log(`  Risk Tier:             ${scoreColor.bold(ficoAuto.riskTier)}`);

  console.log(chalk.gray('\n  Auto lenders use FICO Auto Score 8/9, which weights auto loan history differently.\n'));

  if (ficoAuto.factors.length > 0) {
    console.log(chalk.cyan('  Score Factors:'));
    for (const factor of ficoAuto.factors) {
      const icon = factor.impact === 'positive' ? '✓' : factor.impact === 'negative' ? '✗' : '○';
      const color = factor.impact === 'positive' ? chalk.green : factor.impact === 'negative' ? chalk.red : chalk.gray;
      console.log(color(`    ${icon} ${factor.factor}: ${factor.description}`));
    }
  }
}

function displayCurrentDealAnalysis(dealInfo: DealInfo, result: OptimizationResult): void {
  console.log(chalk.yellow.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.yellow.bold('  📈 CURRENT DEAL METRICS (How ADEs Evaluate Your Deal)'));
  console.log(chalk.yellow.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  const analysis = result.currentAnalysis;

  const metricsTable = new Table({
    head: [chalk.white('Metric'), chalk.white('Current'), chalk.white('Status'), chalk.white('Impact')],
    colWidths: [25, 15, 15, 35],
  });

  // LTV
  const ltvStatus = analysis.currentLTV <= 100 ? 'EXCELLENT' :
    analysis.currentLTV <= 115 ? 'GOOD' :
    analysis.currentLTV <= 125 ? 'MARGINAL' : 'HIGH RISK';
  const ltvColor = analysis.currentLTV <= 100 ? chalk.green :
    analysis.currentLTV <= 115 ? chalk.green :
    analysis.currentLTV <= 125 ? chalk.yellow : chalk.red;

  metricsTable.push([
    'Loan to Value (LTV)',
    `${analysis.currentLTV.toFixed(1)}%`,
    ltvColor(ltvStatus),
    analysis.currentLTV > 120 ? 'May cause decline' : 'Within guidelines',
  ]);

  // PTI
  const ptiStatus = analysis.currentPTI <= 12 ? 'EXCELLENT' :
    analysis.currentPTI <= 15 ? 'GOOD' :
    analysis.currentPTI <= 18 ? 'MARGINAL' : 'HIGH';
  const ptiColor = analysis.currentPTI <= 12 ? chalk.green :
    analysis.currentPTI <= 15 ? chalk.green :
    analysis.currentPTI <= 18 ? chalk.yellow : chalk.red;

  metricsTable.push([
    'Payment to Income (PTI)',
    `${analysis.currentPTI.toFixed(1)}%`,
    ptiColor(ptiStatus),
    analysis.currentPTI > 15 ? 'May trigger conditions' : 'Affordable payment',
  ]);

  // DTI
  const dtiStatus = analysis.currentDTI <= 35 ? 'EXCELLENT' :
    analysis.currentDTI <= 45 ? 'GOOD' :
    analysis.currentDTI <= 50 ? 'MARGINAL' : 'HIGH';
  const dtiColor = analysis.currentDTI <= 35 ? chalk.green :
    analysis.currentDTI <= 45 ? chalk.green :
    analysis.currentDTI <= 50 ? chalk.yellow : chalk.red;

  metricsTable.push([
    'Debt to Income (DTI)',
    `${analysis.currentDTI.toFixed(1)}%`,
    dtiColor(dtiStatus),
    analysis.currentDTI > 50 ? 'Debt burden concern' : 'Manageable debt',
  ]);

  // Payment
  metricsTable.push([
    'Monthly Payment',
    `$${analysis.currentPayment.toFixed(0)}`,
    chalk.cyan('EST'),
    `${dealInfo.term} months @ est. rate`,
  ]);

  console.log(metricsTable.toString());

  // Issues and Strengths
  if (analysis.issues.length > 0) {
    console.log(chalk.red.bold('\n  ⚠️  Issues Detected:'));
    for (const issue of analysis.issues) {
      console.log(chalk.red(`      • ${issue}`));
    }
  }

  if (analysis.strengths.length > 0) {
    console.log(chalk.green.bold('\n  ✓ Deal Strengths:'));
    for (const strength of analysis.strengths) {
      console.log(chalk.green(`      • ${strength}`));
    }
  }
}

function displayADEResults(results: ADEDecision[]): void {
  console.log(chalk.yellow.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.yellow.bold('  🏦 LENDER ADE DECISIONS (Automated Decisioning Engine Results)'));
  console.log(chalk.yellow.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  const resultTable = new Table({
    head: [
      chalk.white('Lender'),
      chalk.white('Decision'),
      chalk.white('Time'),
      chalk.white('Rate'),
      chalk.white('Score'),
    ],
    colWidths: [25, 18, 14, 10, 10],
  });

  for (const result of results.slice(0, 10)) {
    let decisionDisplay: string;
    switch (result.decision) {
      case 'AUTO_APPROVED':
        decisionDisplay = chalk.green.bold('✓ AUTO-APPROVED');
        break;
      case 'CONDITIONAL':
        decisionDisplay = chalk.yellow('◐ CONDITIONAL');
        break;
      case 'PENDING_REVIEW':
        decisionDisplay = chalk.hex('#FFA500')('◌ PENDING');
        break;
      case 'DECLINED':
        decisionDisplay = chalk.red('✗ DECLINED');
        break;
    }

    resultTable.push([
      result.lenderName,
      decisionDisplay,
      result.decisionTime,
      result.approvedRate ? `${result.approvedRate.toFixed(2)}%` : '-',
      result.score.toString(),
    ]);
  }

  console.log(resultTable.toString());

  // Show best auto-approved option details
  const autoApproved = results.find((r) => r.decision === 'AUTO_APPROVED');
  if (autoApproved) {
    console.log(chalk.green.bold(`\n  ★ BEST AUTO-APPROVAL: ${autoApproved.lenderName}`));
    console.log(chalk.green(`    Rate: ${autoApproved.approvedRate?.toFixed(2)}% | Term: up to ${autoApproved.approvedTerm}mo | Max: $${autoApproved.maxApprovedAmount?.toLocaleString()}`));
  } else {
    const conditional = results.find((r) => r.decision === 'CONDITIONAL');
    if (conditional) {
      console.log(chalk.yellow.bold(`\n  ◐ BEST CONDITIONAL: ${conditional.lenderName}`));
      console.log(chalk.yellow(`    Rate: ${conditional.approvedRate?.toFixed(2)}% | Conditions:`));
      for (const cond of conditional.conditions.slice(0, 3)) {
        console.log(chalk.yellow(`      • ${cond}`));
      }
    }
  }
}

function displayAutoApprovalThresholds(ficoAuto: any): void {
  console.log(chalk.yellow.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.yellow.bold('  🎯 AUTO-APPROVAL THRESHOLDS (Hit These Numbers for Instant Approval)'));
  console.log(chalk.yellow.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  const thresholds = getAutoApprovalThresholds();

  // Filter to relevant tiers based on score
  const relevantThresholds = thresholds.filter((t) => {
    if (ficoAuto.autoScore >= 750) return t.tier === 'super-prime';
    if (ficoAuto.autoScore >= 700) return t.tier === 'prime' || t.tier === 'super-prime';
    if (ficoAuto.autoScore >= 650) return t.tier === 'near-prime';
    return t.tier === 'subprime' || t.tier === 'deep-subprime';
  });

  const thresholdTable = new Table({
    head: [
      chalk.white('Lender'),
      chalk.white('Max LTV'),
      chalk.white('Max PTI'),
      chalk.white('Max DTI'),
      chalk.white('Min Down'),
    ],
    colWidths: [22, 12, 12, 12, 12],
  });

  for (const t of relevantThresholds.slice(0, 6)) {
    thresholdTable.push([
      t.lenderName,
      `≤${t.thresholds.maxLTV}%`,
      `≤${t.thresholds.maxPTI}%`,
      `≤${t.thresholds.maxDTI}%`,
      t.thresholds.minDownPercent > 0 ? `${t.thresholds.minDownPercent}%+` : 'None',
    ]);
  }

  console.log(thresholdTable.toString());
  console.log(chalk.gray('\n  💡 Structure your deal to stay UNDER these limits for auto-approval.\n'));
}

function displayOptimizations(result: OptimizationResult): void {
  console.log(chalk.yellow.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.yellow.bold('  🔧 DEAL OPTIMIZATION RECOMMENDATIONS'));
  console.log(chalk.yellow.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  if (result.recommendations.length === 0) {
    console.log(chalk.green.bold('  ✓ Deal is already optimized for auto-approval!'));
    return;
  }

  for (const rec of result.recommendations) {
    let priorityIcon: string;
    let titleLine: string;

    switch (rec.priority) {
      case 'critical':
        priorityIcon = '🚨';
        titleLine = chalk.red.bold(`  ${priorityIcon} ${rec.title.toUpperCase()} [${rec.priority.toUpperCase()}]`);
        break;
      case 'high':
        priorityIcon = '⚠️';
        titleLine = chalk.hex('#FFA500').bold(`  ${priorityIcon} ${rec.title.toUpperCase()} [${rec.priority.toUpperCase()}]`);
        break;
      case 'recommended':
        priorityIcon = '💡';
        titleLine = chalk.yellow.bold(`  ${priorityIcon} ${rec.title.toUpperCase()} [${rec.priority.toUpperCase()}]`);
        break;
      default:
        priorityIcon = '○';
        titleLine = chalk.gray.bold(`  ${priorityIcon} ${rec.title.toUpperCase()} [${rec.priority.toUpperCase()}]`);
    }

    console.log(titleLine);
    console.log(chalk.white(`     ${rec.description}`));
    console.log(chalk.gray(`     Current: ${rec.currentValue}`));
    console.log(chalk.green(`     Target:  ${rec.targetValue}`));
    console.log(chalk.cyan(`     Action:  ${rec.impact}`));
    console.log(chalk.gray(`     Approval Impact: +${rec.estimatedApprovalIncrease}%\n`));

    if (rec.solutions) {
      console.log(chalk.cyan('     Solutions:'));
      for (const sol of rec.solutions) {
        console.log(chalk.cyan(`       • ${sol.method}: ${sol.action}`));
      }
      console.log('');
    }
  }
}

function displaySweetSpot(sweetSpot: any): void {
  console.log(chalk.yellow.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.yellow.bold('  🎯 SWEET SPOT DEAL STRUCTURE (Optimal for Auto-Approval)'));
  console.log(chalk.yellow.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  if (!sweetSpot.achievable) {
    console.log(chalk.red(`  ✗ ${sweetSpot.reason}`));
    return;
  }

  console.log(chalk.green.bold(`  Target Lender: ${sweetSpot.targetLender}`));
  console.log(chalk.green.bold(`  Approval Probability: ${sweetSpot.approvalProbability}%\n`));

  const structureTable = new Table({
    head: [chalk.white('Parameter'), chalk.white('Value'), chalk.white('Change')],
    colWidths: [25, 20, 20],
  });

  structureTable.push([
    'Down Payment',
    chalk.green.bold(`$${sweetSpot.structure.downPayment.toLocaleString()}`),
    sweetSpot.comparison.downPaymentDiff > 0
      ? chalk.yellow(`+$${sweetSpot.comparison.downPaymentDiff.toLocaleString()}`)
      : chalk.green('No change'),
  ]);

  structureTable.push([
    'Term',
    `${sweetSpot.structure.term} months`,
    sweetSpot.comparison.termDiff !== 0
      ? chalk.yellow(`${sweetSpot.comparison.termDiff > 0 ? '+' : ''}${sweetSpot.comparison.termDiff} months`)
      : chalk.green('No change'),
  ]);

  structureTable.push([
    'Amount Financed',
    `$${sweetSpot.structure.amountFinanced.toLocaleString()}`,
    '',
  ]);

  structureTable.push([
    'APR',
    `${sweetSpot.structure.apr.toFixed(2)}%`,
    '',
  ]);

  structureTable.push([
    chalk.bold('Monthly Payment'),
    chalk.green.bold(`$${sweetSpot.structure.monthlyPayment.toFixed(2)}`),
    sweetSpot.comparison.paymentDiff !== 0
      ? `${sweetSpot.comparison.paymentDiff > 0 ? '+' : ''}$${sweetSpot.comparison.paymentDiff.toFixed(0)}`
      : '',
  ]);

  console.log(structureTable.toString());

  console.log(chalk.cyan('\n  Resulting Metrics:'));
  console.log(chalk.cyan(`    LTV: ${sweetSpot.metrics.ltv}% (target: ≤${sweetSpot.metrics.targetLTV}%)`));
  console.log(chalk.cyan(`    PTI: ${sweetSpot.metrics.pti}% (target: ≤${sweetSpot.metrics.targetPTI}%)`));

  if (sweetSpot.notes) {
    console.log(chalk.gray('\n  Notes:'));
    for (const note of sweetSpot.notes) {
      console.log(chalk.gray(`    • ${note}`));
    }
  }
}

function displayActionPlan(actionPlan: any[]): void {
  console.log(chalk.yellow.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.yellow.bold('  📋 STEP-BY-STEP ACTION PLAN'));
  console.log(chalk.yellow.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  for (const step of actionPlan) {
    console.log(chalk.cyan.bold(`  STEP ${step.step}: ${step.action}`));
    console.log(chalk.white(`     ${step.details}`));
    console.log(chalk.gray(`     Requirement: ${step.requirement}`));
    console.log(chalk.green(`     Implementation: ${step.implementation}\n`));
  }
}

function displayApprovalMeter(probability: any): void {
  console.log(chalk.yellow.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.yellow.bold('  📊 APPROVAL PROBABILITY METER'));
  console.log(chalk.yellow.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  // Current probability bar
  const currentBar = createProgressBar(probability.currentAsStructured, 40);
  const currentColor = probability.currentAsStructured >= 70 ? chalk.green :
    probability.currentAsStructured >= 50 ? chalk.yellow : chalk.red;

  console.log(chalk.white('  As Currently Structured:'));
  console.log(`  ${currentColor(currentBar)} ${currentColor.bold(`${probability.currentAsStructured}%`)}`);

  // Optimized probability bar
  const optimizedBar = createProgressBar(probability.ifOptimized, 40);
  console.log(chalk.white('\n  If Optimized:'));
  console.log(`  ${chalk.green(optimizedBar)} ${chalk.green.bold(`${probability.ifOptimized}%`)}`);

  // Summary
  console.log('');
  const statusColor = probability.criticalIssues > 0 ? chalk.red :
    probability.highIssues > 0 ? chalk.yellow : chalk.green;

  console.log(statusColor.bold(`  ${probability.recommendation}`));

  if (probability.criticalIssues > 0) {
    console.log(chalk.red(`\n  Critical Issues: ${probability.criticalIssues} | High Priority: ${probability.highIssues}`));
  }
}

function createProgressBar(percentage: number, width: number): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

async function simulateProgress(message: string, duration: number): Promise<void> {
  process.stdout.write(chalk.gray(`  ⏳ ${message}...`));
  await new Promise((resolve) => setTimeout(resolve, duration));
  console.log(chalk.green(' ✓'));
}

// ============================================================================
// INTERACTIVE OPTIONS
// ============================================================================

async function handleUserOptions(
  adeResults: ADEDecision[],
  optimizationResult: OptimizationResult,
  vehicle: Vehicle,
  credit: CreditProfile,
  dealInfo: DealInfo
): Promise<void> {
  console.log(chalk.blue.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '📊 View detailed lender breakdown', value: 'lender_details' },
        { name: '🔍 See what-if scenarios', value: 'what_if' },
        { name: '📋 Export recommendations', value: 'export' },
        { name: '🔄 Analyze new deal', value: 'new_deal' },
        { name: '❌ Exit', value: 'exit' },
      ],
    },
  ]);

  switch (action) {
    case 'lender_details':
      await showLenderDetails(adeResults);
      await handleUserOptions(adeResults, optimizationResult, vehicle, credit, dealInfo);
      break;
    case 'what_if':
      await showWhatIf(vehicle, credit, dealInfo);
      await handleUserOptions(adeResults, optimizationResult, vehicle, credit, dealInfo);
      break;
    case 'new_deal':
      await runApprovalOptimizer();
      break;
    case 'exit':
      console.log(chalk.green('\n  Thank you for using the Auto-Approval Optimizer!\n'));
      break;
  }
}

async function showLenderDetails(results: ADEDecision[]): Promise<void> {
  console.log(chalk.yellow.bold('\n━━━ DETAILED LENDER ANALYSIS ━━━\n'));

  for (const result of results.slice(0, 8)) {
    const statusColor = result.decision === 'AUTO_APPROVED' ? chalk.green :
      result.decision === 'CONDITIONAL' ? chalk.yellow :
      result.decision === 'PENDING_REVIEW' ? chalk.hex('#FFA500') : chalk.red;

    console.log(statusColor.bold(`\n${result.lenderName}`));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`  Decision: ${statusColor(result.decision)}`);
    console.log(`  Decision Time: ${result.decisionTime}`);
    console.log(`  Internal Score: ${result.score}/1000`);

    if (result.approvedRate) {
      console.log(`  Approved Rate: ${result.approvedRate.toFixed(2)}%`);
      console.log(`  Max Amount: $${result.maxApprovedAmount?.toLocaleString()}`);
      console.log(`  Max Term: ${result.approvedTerm} months`);
    }

    if (result.riskFactors.length > 0) {
      console.log(chalk.cyan('\n  Risk Factors Evaluated:'));
      for (const factor of result.riskFactors) {
        const icon = factor.status === 'pass' ? '✓' : factor.status === 'warn' ? '◐' : '✗';
        const color = factor.status === 'pass' ? chalk.green :
          factor.status === 'warn' ? chalk.yellow : chalk.red;
        console.log(color(`    ${icon} ${factor.factor}: ${factor.value} (threshold: ${factor.threshold})`));
      }
    }

    if (result.conditions.length > 0) {
      console.log(chalk.yellow('\n  Conditions:'));
      for (const cond of result.conditions) {
        console.log(chalk.yellow(`    • ${cond}`));
      }
    }

    if (result.autoApprovalPath.adjustmentsNeeded.length > 0) {
      console.log(chalk.cyan('\n  Path to Auto-Approval:'));
      for (const adj of result.autoApprovalPath.adjustmentsNeeded) {
        console.log(chalk.cyan(`    ${adj.priorityOrder}. ${adj.description}`));
      }
    }
  }
}

async function showWhatIf(vehicle: Vehicle, credit: CreditProfile, dealInfo: DealInfo): Promise<void> {
  console.log(chalk.yellow.bold('\n━━━ WHAT-IF SCENARIOS ━━━\n'));

  const scenarios = [
    { name: 'Add $1,000 more down', downDiff: 1000 },
    { name: 'Add $2,000 more down', downDiff: 2000 },
    { name: 'Add $3,000 more down', downDiff: 3000 },
    { name: 'Add $5,000 more down', downDiff: 5000 },
  ];

  const ade = new AutoDecisioningEngine();

  const scenarioTable = new Table({
    head: [chalk.white('Scenario'), chalk.white('LTV'), chalk.white('PTI'), chalk.white('Best Decision')],
    colWidths: [25, 12, 12, 20],
  });

  for (const scenario of scenarios) {
    const newDown = (dealInfo.downPayment || 0) + scenario.downDiff;
    const newAmountFinanced = dealInfo.amountFinanced - scenario.downDiff;

    const results = ade.processApplication({
      credit,
      vehicle,
      amountFinanced: newAmountFinanced,
      vehicleValue: dealInfo.vehicleValue,
      term: dealInfo.term,
      downPayment: newDown,
    });

    const best = results[0];
    const ltv = calculateLTV(newAmountFinanced, dealInfo.vehicleValue);
    const payment = calculateMonthlyPayment(newAmountFinanced, best?.approvedRate || 8, dealInfo.term);
    const pti = calculatePTI(payment, credit.monthlyIncome);

    const decisionColor = best?.decision === 'AUTO_APPROVED' ? chalk.green :
      best?.decision === 'CONDITIONAL' ? chalk.yellow : chalk.red;

    scenarioTable.push([
      scenario.name,
      `${ltv.toFixed(1)}%`,
      `${pti.toFixed(1)}%`,
      decisionColor(best?.decision || 'N/A'),
    ]);
  }

  console.log(scenarioTable.toString());
}

// ============================================================================
// INTERFACES
// ============================================================================

interface DealInfo {
  sellingPrice: number;
  downPayment: number;
  tradeEquity: number;
  fees: number;
  fiProducts: number;
  term: number;
  amountFinanced: number;
  vehicleValue: number;
}
