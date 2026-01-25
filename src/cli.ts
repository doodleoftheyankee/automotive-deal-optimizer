#!/usr/bin/env node
// ============================================================================
// UNIFIED DEAL OPTIMIZER CLI
// ERA Ignite Style F&I Desking Tool
// ============================================================================

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';

import { Vehicle, CreditProfile, CreditTier, FIProduct } from './types';
import { DealDesk, standardFIProducts, defaultFees, stateFeesConfig } from './desking/deal-desk';
import { LenderMatcher } from './optimizer/lender-matcher';
import { lenders, getCreditTierForScore } from './config/lenders';
import {
  calculateMonthlyPayment,
  calculatePayment,
  calculateLTV,
  calculatePTI,
} from './calculators/payment';
import {
  estimateBookValues,
  determineVehicleClass,
} from './inventory/vehicle-manager';

const program = new Command();

// ============================================================================
// CLI CONFIGURATION
// ============================================================================

program
  .name('deal-desk')
  .description('Unified Automotive Deal Optimizer - ERA Ignite Style F&I Desking')
  .version('1.0.0');

// ============================================================================
// INTERACTIVE DEAL DESK COMMAND
// ============================================================================

program
  .command('desk')
  .description('Start interactive deal desking session')
  .action(async () => {
    console.log(chalk.blue.bold('\n╔════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.blue.bold('║          UNION PARK DEAL OPTIMIZER - F&I DESKING               ║'));
    console.log(chalk.blue.bold('╚════════════════════════════════════════════════════════════════╝\n'));

    // Step 1: Vehicle Information
    console.log(chalk.yellow.bold('STEP 1: Vehicle Information'));
    console.log(chalk.gray('─'.repeat(60)));

    const vehicleAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'year',
        message: 'Vehicle Year:',
        validate: (input) => {
          const year = parseInt(input);
          return year >= 2000 && year <= 2026 ? true : 'Enter a valid year (2000-2026)';
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
        validate: (input) => {
          const miles = parseInt(input);
          return miles >= 0 ? true : 'Enter valid mileage';
        },
      },
      {
        type: 'list',
        name: 'condition',
        message: 'Condition:',
        choices: ['excellent', 'good', 'fair', 'poor'],
        default: 'good',
      },
      {
        type: 'confirm',
        name: 'certified',
        message: 'Is this a Certified Pre-Owned vehicle?',
        default: false,
      },
      {
        type: 'list',
        name: 'certificationProgram',
        message: 'Certification Program:',
        choices: ['gm-certified', 'honda-certified', 'dealer-certified', 'none'],
        when: (answers) => answers.certified,
        default: 'gm-certified',
      },
    ]);

    // Estimate book values
    const bookValues = estimateBookValues(
      parseInt(vehicleAnswers.year),
      vehicleAnswers.make,
      vehicleAnswers.model,
      parseInt(vehicleAnswers.mileage),
      vehicleAnswers.condition
    );

    const vehicle: Vehicle = {
      year: parseInt(vehicleAnswers.year),
      make: vehicleAnswers.make,
      model: vehicleAnswers.model,
      mileage: parseInt(vehicleAnswers.mileage),
      condition: vehicleAnswers.condition,
      certified: vehicleAnswers.certified,
      certificationProgram: vehicleAnswers.certified
        ? vehicleAnswers.certificationProgram
        : 'none',
      vehicleClass: determineVehicleClass(vehicleAnswers.make, vehicleAnswers.model),
      bookValue: bookValues,
    };

    console.log(chalk.green(`\nEstimated Book Values:`));
    console.log(`  Retail: $${bookValues.retail?.toLocaleString()}`);
    console.log(`  NADA: $${bookValues.nada?.toLocaleString()}`);
    console.log(`  KBB: $${bookValues.kbb?.toLocaleString()}\n`);

    // Step 2: Customer Credit Profile
    console.log(chalk.yellow.bold('\nSTEP 2: Customer Credit Profile'));
    console.log(chalk.gray('─'.repeat(60)));

    const creditAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'creditScore',
        message: 'Credit Score:',
        validate: (input) => {
          const score = parseInt(input);
          return score >= 300 && score <= 850 ? true : 'Enter valid score (300-850)';
        },
      },
      {
        type: 'input',
        name: 'monthlyIncome',
        message: 'Monthly Gross Income: $',
        validate: (input) => {
          const income = parseFloat(input);
          return income > 0 ? true : 'Enter valid income';
        },
      },
      {
        type: 'input',
        name: 'monthlyDebt',
        message: 'Monthly Debt Payments (rent, cards, loans): $',
        default: '0',
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
        type: 'list',
        name: 'state',
        message: 'Customer State:',
        choices: ['DE', 'PA', 'MD', 'NJ'],
        default: 'DE',
      },
    ]);

    const creditScore = parseInt(creditAnswers.creditScore);
    const creditTier = getCreditTierForScore(creditScore);

    const credit: CreditProfile = {
      score: creditScore,
      tier: creditTier,
      monthlyIncome: parseFloat(creditAnswers.monthlyIncome),
      monthlyDebt: parseFloat(creditAnswers.monthlyDebt),
      bankruptcyHistory: creditAnswers.bankruptcy,
      bankruptcyAge: creditAnswers.bankruptcy
        ? parseInt(creditAnswers.bankruptcyAge)
        : undefined,
      repoHistory: creditAnswers.repo,
    };

    console.log(chalk.green(`\nCredit Tier: ${chalk.bold(creditTier.toUpperCase())}`));

    // Step 3: Deal Structure
    console.log(chalk.yellow.bold('\nSTEP 3: Deal Structure'));
    console.log(chalk.gray('─'.repeat(60)));

    const dealAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'sellingPrice',
        message: 'Selling Price: $',
        default: bookValues.retail?.toString(),
        validate: (input) => parseFloat(input) > 0 || 'Enter valid price',
      },
      {
        type: 'confirm',
        name: 'hasTrade',
        message: 'Is there a trade-in?',
        default: false,
      },
      {
        type: 'input',
        name: 'tradeValue',
        message: 'Trade-in Value (ACV): $',
        when: (answers) => answers.hasTrade,
        default: '0',
      },
      {
        type: 'input',
        name: 'tradePayoff',
        message: 'Trade Payoff Amount: $',
        when: (answers) => answers.hasTrade,
        default: '0',
      },
      {
        type: 'input',
        name: 'cashDown',
        message: 'Cash Down Payment: $',
        default: '0',
      },
      {
        type: 'input',
        name: 'rebates',
        message: 'Rebates/Incentives: $',
        default: '0',
      },
    ]);

    // Initialize Deal Desk
    const deskTool = new DealDesk(vehicle, credit, creditAnswers.state);
    deskTool.setSellingPrice(parseFloat(dealAnswers.sellingPrice));
    deskTool.setCashDown(parseFloat(dealAnswers.cashDown));
    deskTool.setRebates(parseFloat(dealAnswers.rebates));

    if (dealAnswers.hasTrade) {
      deskTool.setTrade(
        parseFloat(dealAnswers.tradeValue),
        parseFloat(dealAnswers.tradePayoff)
      );
    }

    // Step 4: F&I Products
    console.log(chalk.yellow.bold('\nSTEP 4: F&I Products'));
    console.log(chalk.gray('─'.repeat(60)));

    const fiAnswers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'products',
        message: 'Select F&I Products to add:',
        choices: standardFIProducts.map((p) => ({
          name: `${p.name} - $${p.sellPrice}`,
          value: p.name,
        })),
      },
    ]);

    for (const productName of fiAnswers.products) {
      const product = standardFIProducts.find((p) => p.name === productName);
      if (product) {
        deskTool.addFIProduct({ ...product, financed: true });
      }
    }

    // Step 5: Generate Lender Recommendations
    console.log(chalk.yellow.bold('\nSTEP 5: Lender Analysis'));
    console.log(chalk.gray('─'.repeat(60)));

    const amountFinanced = deskTool.getAmountFinanced();
    const vehicleValue = deskTool.getVehicleValue();
    const ltv = deskTool.getLTV();

    console.log(chalk.cyan(`\nDeal Summary:`));
    console.log(`  Selling Price:    $${parseFloat(dealAnswers.sellingPrice).toLocaleString()}`);
    console.log(`  Net Trade:        $${deskTool.getNetTrade().toLocaleString()}`);
    console.log(`  Cash Down:        $${parseFloat(dealAnswers.cashDown).toLocaleString()}`);
    console.log(`  Sales Tax:        $${deskTool.getSalesTax().toLocaleString()}`);
    console.log(`  Fees:             $${deskTool.getTotalFees().toLocaleString()}`);
    console.log(`  F&I Products:     $${deskTool.getFinancedProducts().toLocaleString()}`);
    console.log(chalk.bold(`  Amount Financed:  $${amountFinanced.toLocaleString()}`));
    console.log(chalk.bold(`  LTV:              ${ltv.toFixed(1)}%`));

    // Get term preference
    const termAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'term',
        message: 'Preferred Term (months):',
        choices: ['36', '48', '60', '66', '72', '75', '84'],
        default: '72',
      },
    ]);

    const requestedTerm = parseInt(termAnswer.term);

    // Run lender matcher
    const matcher = new LenderMatcher();
    const recommendations = matcher.getRecommendations({
      creditScore: credit.score,
      credit,
      vehicle,
      amountFinanced,
      vehicleValue,
      requestedTerm,
      monthlyIncome: credit.monthlyIncome,
      monthlyDebt: credit.monthlyDebt,
      downPaymentPercent:
        (parseFloat(dealAnswers.cashDown) / parseFloat(dealAnswers.sellingPrice)) * 100,
    });

    // Display Results
    console.log(chalk.blue.bold('\n╔════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.blue.bold('║                    LENDER RECOMMENDATIONS                       ║'));
    console.log(chalk.blue.bold('╚════════════════════════════════════════════════════════════════╝\n'));

    if (recommendations.length === 0) {
      console.log(chalk.red('No lenders found for this deal structure. Consider:'));
      console.log('  - Increasing down payment');
      console.log('  - Reducing selling price');
      console.log('  - Adding a co-signer');
      return;
    }

    // Create lender table
    const lenderTable = new Table({
      head: [
        chalk.white.bold('Lender'),
        chalk.white.bold('Rate'),
        chalk.white.bold('Payment'),
        chalk.white.bold('Confidence'),
        chalk.white.bold('Status'),
      ],
      colWidths: [25, 10, 12, 12, 18],
    });

    for (const rec of recommendations.slice(0, 8)) {
      const confidenceColor =
        rec.confidence === 'high'
          ? chalk.green
          : rec.confidence === 'medium'
          ? chalk.yellow
          : chalk.red;

      const statusColor =
        rec.terms.approvalStatus === 'auto-approved'
          ? chalk.green
          : rec.terms.approvalStatus === 'conditional'
          ? chalk.yellow
          : chalk.red;

      lenderTable.push([
        rec.lender.name,
        `${rec.terms.apr.toFixed(2)}%`,
        `$${rec.terms.monthlyPayment.toFixed(2)}`,
        confidenceColor(rec.confidence.toUpperCase()),
        statusColor(rec.terms.approvalStatus),
      ]);
    }

    console.log(lenderTable.toString());

    // Show top recommendation details
    const topRec = recommendations[0];
    console.log(chalk.green.bold(`\n★ TOP RECOMMENDATION: ${topRec.lender.name}`));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(`  APR:              ${topRec.terms.apr.toFixed(2)}%`);
    console.log(`  Monthly Payment:  $${topRec.terms.monthlyPayment.toFixed(2)}`);
    console.log(`  Total Interest:   $${topRec.terms.totalInterest.toFixed(2)}`);
    console.log(`  Total of Payments: $${topRec.terms.totalOfPayments.toFixed(2)}`);
    console.log(`  LTV:              ${topRec.terms.ltv?.toFixed(1)}%`);
    console.log(`  PTI:              ${topRec.terms.pti?.toFixed(1)}%`);
    console.log(`  DTI:              ${topRec.terms.dti?.toFixed(1)}%`);

    if (topRec.terms.approvalConditions && topRec.terms.approvalConditions.length > 0) {
      console.log(chalk.yellow(`\n  Stipulations:`));
      for (const cond of topRec.terms.approvalConditions) {
        console.log(chalk.yellow(`    • ${cond}`));
      }
    }

    if (topRec.reasoning.length > 0) {
      console.log(chalk.cyan(`\n  Why this lender:`));
      for (const reason of topRec.reasoning) {
        console.log(chalk.cyan(`    ✓ ${reason}`));
      }
    }

    if (topRec.warnings.length > 0) {
      console.log(chalk.red(`\n  Warnings:`));
      for (const warning of topRec.warnings) {
        console.log(chalk.red(`    ⚠ ${warning}`));
      }
    }

    // Payment Grid
    console.log(chalk.blue.bold('\n╔════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.blue.bold('║                      PAYMENT GRID                              ║'));
    console.log(chalk.blue.bold('╚════════════════════════════════════════════════════════════════╝\n'));

    const rates = [5.99, 7.99, 9.99, 12.99, 15.99, 19.99];
    const terms = [48, 60, 72, 84];

    const paymentGrid = new Table({
      head: ['APR / Term', ...terms.map((t) => `${t} mo`)],
    });

    for (const rate of rates) {
      const row: string[] = [`${rate.toFixed(2)}%`];
      for (const term of terms) {
        const payment = calculateMonthlyPayment(amountFinanced, rate, term);
        const pti = calculatePTI(payment, credit.monthlyIncome);
        const color = pti <= 15 ? chalk.green : pti <= 18 ? chalk.yellow : chalk.red;
        row.push(color(`$${payment.toFixed(0)}`));
      }
      paymentGrid.push(row);
    }

    console.log(paymentGrid.toString());
    console.log(chalk.gray('Colors: Green = PTI ≤15% | Yellow = PTI ≤18% | Red = PTI >18%\n'));

    // Ask if user wants to see more details
    const moreDetails = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'showMore',
        message: 'Would you like to see all lender details?',
        default: false,
      },
    ]);

    if (moreDetails.showMore) {
      for (const rec of recommendations) {
        console.log(chalk.cyan(`\n━━━ ${rec.lender.name} ━━━`));
        console.log(`  Type: ${rec.lender.type}`);
        console.log(`  Rate: ${rec.terms.apr.toFixed(2)}% | Payment: $${rec.terms.monthlyPayment.toFixed(2)}`);
        console.log(`  LTV: ${rec.terms.ltv?.toFixed(1)}% | PTI: ${rec.terms.pti?.toFixed(1)}%`);
        console.log(`  Status: ${rec.terms.approvalStatus} | Confidence: ${rec.confidence}`);
        if (rec.warnings.length > 0) {
          console.log(chalk.yellow(`  Warnings: ${rec.warnings.join(', ')}`));
        }
      }
    }

    console.log(chalk.green.bold('\n✓ Deal analysis complete!\n'));
  });

// ============================================================================
// QUICK PAYMENT CALCULATOR
// ============================================================================

program
  .command('calc')
  .description('Quick payment calculator')
  .option('-a, --amount <amount>', 'Amount financed')
  .option('-r, --rate <rate>', 'APR (e.g., 7.99)')
  .option('-t, --term <term>', 'Term in months')
  .action(async (options) => {
    let amount = parseFloat(options.amount);
    let rate = parseFloat(options.rate);
    let term = parseInt(options.term);

    if (isNaN(amount) || isNaN(rate) || isNaN(term)) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'amount',
          message: 'Amount Financed: $',
          when: isNaN(amount),
        },
        {
          type: 'input',
          name: 'rate',
          message: 'APR (%):',
          when: isNaN(rate),
        },
        {
          type: 'input',
          name: 'term',
          message: 'Term (months):',
          when: isNaN(term),
        },
      ]);

      amount = amount || parseFloat(answers.amount);
      rate = rate || parseFloat(answers.rate);
      term = term || parseInt(answers.term);
    }

    const calc = calculatePayment(amount, rate, term, false);

    console.log(chalk.blue.bold('\n━━━ Payment Calculation ━━━'));
    console.log(`  Amount Financed:   $${amount.toLocaleString()}`);
    console.log(`  APR:               ${rate}%`);
    console.log(`  Term:              ${term} months`);
    console.log(chalk.green.bold(`  Monthly Payment:   $${calc.monthlyPayment.toFixed(2)}`));
    console.log(`  Total Interest:    $${calc.totalInterest.toFixed(2)}`);
    console.log(`  Total of Payments: $${calc.totalOfPayments.toFixed(2)}\n`);
  });

// ============================================================================
// LENDER LIST COMMAND
// ============================================================================

program
  .command('lenders')
  .description('List all configured lenders')
  .option('-t, --tier <tier>', 'Filter by credit tier (super-prime, prime, near-prime, subprime, deep-subprime)')
  .action((options) => {
    console.log(chalk.blue.bold('\n╔════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.blue.bold('║                    CONFIGURED LENDERS                          ║'));
    console.log(chalk.blue.bold('╚════════════════════════════════════════════════════════════════╝\n'));

    const filteredLenders = options.tier
      ? lenders.filter((l) => l.creditTiers.some((t) => t.tier === options.tier))
      : lenders;

    for (const lender of filteredLenders) {
      console.log(chalk.cyan.bold(`\n${lender.name}`));
      console.log(chalk.gray(`  Type: ${lender.type}`));
      console.log(chalk.gray('  Credit Tiers:'));

      for (const tier of lender.creditTiers) {
        const tierColor =
          tier.tier === 'super-prime' || tier.tier === 'prime'
            ? chalk.green
            : tier.tier === 'near-prime'
            ? chalk.yellow
            : chalk.red;

        console.log(
          `    ${tierColor(tier.tier.padEnd(15))} | Score: ${tier.minScore}${tier.maxScore ? '-' + tier.maxScore : '+'} | Rate: ${tier.baseRate}% | Max LTV: ${tier.maxLTV}% | Max Term: ${tier.maxTerm}mo`
        );
      }

      console.log(
        chalk.gray(
          `  Vehicle Limits: Max Age ${lender.vehicleRestrictions.maxAge}yr | Max Miles ${lender.vehicleRestrictions.maxMileage.toLocaleString()}`
        )
      );
    }

    console.log('\n');
  });

// ============================================================================
// CREDIT TIER INFO COMMAND
// ============================================================================

program
  .command('tiers')
  .description('Show credit tier definitions and best lenders')
  .action(() => {
    console.log(chalk.blue.bold('\n╔════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.blue.bold('║                    CREDIT TIER GUIDE                           ║'));
    console.log(chalk.blue.bold('╚════════════════════════════════════════════════════════════════╝\n'));

    const tiers: Array<{ name: CreditTier; range: string; description: string; bestLenders: string[] }> = [
      {
        name: 'super-prime',
        range: '750+',
        description: 'Excellent credit - Best rates, highest approvals',
        bestLenders: ['PSECU', 'Citadel', 'GM Financial', 'Bank of America'],
      },
      {
        name: 'prime',
        range: '700-749',
        description: 'Good credit - Competitive rates, easy approvals',
        bestLenders: ['PSECU', 'Citadel', 'Chase', 'M&T Bank'],
      },
      {
        name: 'near-prime',
        range: '650-699',
        description: 'Fair credit - Higher rates, some conditions',
        bestLenders: ['Ally Financial', 'GM Financial', 'Dexsta', 'MECU'],
      },
      {
        name: 'subprime',
        range: '550-649',
        description: 'Challenged credit - Requires documentation, higher rates',
        bestLenders: ['Westlake', 'Ally Financial', 'First Help Financial'],
      },
      {
        name: 'deep-subprime',
        range: 'Below 550',
        description: 'Credit rebuilding - Specialist lenders, significant down required',
        bestLenders: ['First Help Financial', 'Westlake'],
      },
    ];

    for (const tier of tiers) {
      const color =
        tier.name === 'super-prime' || tier.name === 'prime'
          ? chalk.green
          : tier.name === 'near-prime'
          ? chalk.yellow
          : chalk.red;

      console.log(color.bold(`\n${tier.name.toUpperCase()} (${tier.range})`));
      console.log(chalk.gray(`  ${tier.description}`));
      console.log(chalk.cyan(`  Best Lenders: ${tier.bestLenders.join(', ')}`));
    }

    console.log('\n');
  });

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

program.parse();
