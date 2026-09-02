// ============================================================================
// CONFIGURATION - Union Park Buick GMC
// All 13 lenders, state fees, F&I products, helpers
// ============================================================================

var STANDARD_RATE_ADJUSTMENTS = {
  highMileage: { condition: 'Vehicle mileage > 80,000', adjustment: 0.5 },
  oldVehicle: { condition: 'Vehicle age > 7 years', adjustment: 0.75 },
  lowDown: { condition: 'Down payment < 10%', adjustment: 0.25 },
  shortTimeOnJob: { condition: 'Time on job < 12 months', adjustment: 0.5 },
  bankruptcy: { condition: 'Bankruptcy < 24 months', adjustment: 1.0 },
  certified: { condition: 'Certified Pre-Owned vehicle', adjustment: -0.5 },
  highLTV: { condition: 'LTV > 120%', adjustment: 0.5 },
  firstTimeBuyer: { condition: 'First time buyer', adjustment: 0.25 },
  longTerm: { condition: 'Term > 72 months', adjustment: 0.25 }
};

var LENDERS = [
  {
    id: 'ally', name: 'Ally Financial', type: 'full-spectrum', active: true,
    creditTiers: [
      { tier: 'super-prime', minScore: 750, baseRate: 5.99, maxLTV: 130, maxPTI: 18, maxDTI: 50, maxTerm: 84,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.highMileage, STANDARD_RATE_ADJUSTMENTS.oldVehicle, STANDARD_RATE_ADJUSTMENTS.certified] },
      { tier: 'prime', minScore: 700, maxScore: 749, baseRate: 7.49, maxLTV: 125, maxPTI: 16, maxDTI: 50, maxTerm: 84,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.highMileage, STANDARD_RATE_ADJUSTMENTS.oldVehicle, STANDARD_RATE_ADJUSTMENTS.certified, STANDARD_RATE_ADJUSTMENTS.lowDown] },
      { tier: 'near-prime', minScore: 650, maxScore: 699, baseRate: 10.99, maxLTV: 115, maxPTI: 15, maxDTI: 50, maxTerm: 75, minDown: 10,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.highMileage, STANDARD_RATE_ADJUSTMENTS.oldVehicle, STANDARD_RATE_ADJUSTMENTS.shortTimeOnJob],
        stipulations: ['Proof of income required', 'Proof of residence required'] },
      { tier: 'subprime', minScore: 550, maxScore: 649, baseRate: 15.99, maxLTV: 110, maxPTI: 12, maxDTI: 45, maxTerm: 72, minDown: 15,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.highMileage, STANDARD_RATE_ADJUSTMENTS.oldVehicle, STANDARD_RATE_ADJUSTMENTS.bankruptcy],
        stipulations: ['Proof of income (2 recent paystubs)', 'Proof of residence (utility bill)', '6 references required'] },
      { tier: 'deep-subprime', minScore: 500, baseRate: 21.99, maxLTV: 100, maxPTI: 10, maxDTI: 40, maxTerm: 60, minDown: 20,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.highMileage],
        stipulations: ['Proof of income (2 recent paystubs)', 'Proof of residence (utility bill)', '8 references required', 'May require interview'] }
    ],
    vehicleRestrictions: { maxAge: 10, maxMileage: 125000, minValue: 8000, certifiedRateReduction: 0.5 },
    loanLimits: { minAmount: 7500, maxAmount: 100000, minTerm: 24, maxTerm: 84,
      maxLTVByAge: { 0: 130, 1: 130, 2: 125, 3: 125, 4: 120, 5: 115, 6: 110, 7: 105, 8: 100, 9: 95, 10: 90 } },
    programs: [{ name: 'Ally SmartAuction', description: 'Preferred rates for SmartAuction purchases', requirements: ['Vehicle purchased through Ally SmartAuction'], rateReduction: 0.25 }],
    portalUrl: 'https://www.allydealer.com'
  },
  {
    id: 'gm-financial', name: 'GM Financial', type: 'captive', active: true,
    creditTiers: [
      { tier: 'super-prime', minScore: 750, baseRate: 5.49, maxLTV: 135, maxPTI: 20, maxDTI: 55, maxTerm: 84,
        rateAdjustments: [{ condition: 'GM Certified Pre-Owned', adjustment: -0.75 }, { condition: 'Non-GM vehicle', adjustment: 1.0 }, STANDARD_RATE_ADJUSTMENTS.oldVehicle] },
      { tier: 'prime', minScore: 700, maxScore: 749, baseRate: 6.99, maxLTV: 130, maxPTI: 18, maxDTI: 50, maxTerm: 84,
        rateAdjustments: [{ condition: 'GM Certified Pre-Owned', adjustment: -0.5 }, { condition: 'Non-GM vehicle', adjustment: 1.0 }, STANDARD_RATE_ADJUSTMENTS.oldVehicle] },
      { tier: 'near-prime', minScore: 625, maxScore: 699, baseRate: 10.49, maxLTV: 120, maxPTI: 15, maxDTI: 50, maxTerm: 75, minDown: 10,
        rateAdjustments: [{ condition: 'GM Certified Pre-Owned', adjustment: -0.25 }, { condition: 'Non-GM vehicle', adjustment: 1.5 }],
        stipulations: ['Income verification required'] },
      { tier: 'subprime', minScore: 550, maxScore: 624, baseRate: 14.99, maxLTV: 110, maxPTI: 12, maxDTI: 45, maxTerm: 72, minDown: 15,
        rateAdjustments: [{ condition: 'Non-GM vehicle', adjustment: 2.0 }],
        stipulations: ['Full income documentation', 'Proof of residence', 'References required'] }
    ],
    vehicleRestrictions: { maxAge: 8, maxMileage: 100000, minValue: 10000, excludedMakes: ['Audi', 'BMW', 'Mercedes-Benz', 'Lexus', 'Porsche'], certifiedRateReduction: 0.75 },
    loanLimits: { minAmount: 10000, maxAmount: 125000, minTerm: 24, maxTerm: 84 },
    programs: [
      { name: 'GM Certified Pre-Owned', description: 'Special rates for GM CPO vehicles', requirements: ['GM CPO certified vehicle'], rateReduction: 0.75, ltvBonus: 10 },
      { name: 'Conquest Program', description: 'Competitive rates for customers trading non-GM vehicles', requirements: ['Trading in non-GM vehicle', 'Credit score 680+'], rateReduction: 0.25 }
    ],
    portalUrl: 'https://www.gmfinancial.com/dealer'
  },
  {
    id: 'chase', name: 'Chase Auto Finance', type: 'national-bank', active: true,
    creditTiers: [
      { tier: 'super-prime', minScore: 750, baseRate: 5.74, maxLTV: 125, maxPTI: 15, maxDTI: 45, maxTerm: 84,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.certified, STANDARD_RATE_ADJUSTMENTS.highMileage] },
      { tier: 'prime', minScore: 700, maxScore: 749, baseRate: 7.24, maxLTV: 120, maxPTI: 14, maxDTI: 45, maxTerm: 84,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.certified, STANDARD_RATE_ADJUSTMENTS.highMileage, STANDARD_RATE_ADJUSTMENTS.lowDown] },
      { tier: 'near-prime', minScore: 660, maxScore: 699, baseRate: 9.99, maxLTV: 115, maxPTI: 12, maxDTI: 42, maxTerm: 72, minDown: 10,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.highMileage], stipulations: ['Proof of income'] }
    ],
    vehicleRestrictions: { maxAge: 7, maxMileage: 100000, minValue: 12000, excludedClasses: ['luxury'], certifiedRateReduction: 0.5 },
    loanLimits: { minAmount: 10000, maxAmount: 100000, minTerm: 24, maxTerm: 84 },
    programs: [{ name: 'Chase Relationship Bonus', description: 'Rate discount for existing Chase customers', requirements: ['Existing Chase checking account'], rateReduction: 0.25 }],
    portalUrl: 'https://www.chase.com/auto'
  },
  {
    id: 'wells-fargo', name: 'Wells Fargo Auto', type: 'national-bank', active: true,
    creditTiers: [
      { tier: 'super-prime', minScore: 750, baseRate: 5.89, maxLTV: 125, maxPTI: 15, maxDTI: 48, maxTerm: 84,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.certified] },
      { tier: 'prime', minScore: 700, maxScore: 749, baseRate: 7.39, maxLTV: 120, maxPTI: 14, maxDTI: 45, maxTerm: 84,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.certified, STANDARD_RATE_ADJUSTMENTS.lowDown] },
      { tier: 'near-prime', minScore: 660, maxScore: 699, baseRate: 10.49, maxLTV: 110, maxPTI: 12, maxDTI: 42, maxTerm: 72, minDown: 10,
        rateAdjustments: [], stipulations: ['Income verification required'] }
    ],
    vehicleRestrictions: { maxAge: 7, maxMileage: 100000, minValue: 10000, certifiedRateReduction: 0.5 },
    loanLimits: { minAmount: 7500, maxAmount: 100000, minTerm: 24, maxTerm: 84 },
    portalUrl: 'https://www.wellsfargo.com/dealer'
  },
  {
    id: 'mt-bank', name: 'M&T Bank', type: 'regional-bank', active: true,
    creditTiers: [
      { tier: 'super-prime', minScore: 750, baseRate: 5.79, maxLTV: 125, maxPTI: 16, maxDTI: 45, maxTerm: 84,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.certified] },
      { tier: 'prime', minScore: 700, maxScore: 749, baseRate: 7.29, maxLTV: 120, maxPTI: 15, maxDTI: 45, maxTerm: 84,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.certified] },
      { tier: 'near-prime', minScore: 650, maxScore: 699, baseRate: 9.99, maxLTV: 115, maxPTI: 14, maxDTI: 42, maxTerm: 72, minDown: 10,
        rateAdjustments: [], stipulations: ['Proof of income', 'Must be in M&T service area'] }
    ],
    vehicleRestrictions: { maxAge: 8, maxMileage: 100000, minValue: 8000, certifiedRateReduction: 0.5 },
    loanLimits: { minAmount: 5000, maxAmount: 100000, minTerm: 24, maxTerm: 84 },
    programs: [{ name: 'M&T Relationship Rate', description: 'Discount for existing M&T customers', requirements: ['M&T checking or savings account'], rateReduction: 0.25 }],
    portalUrl: 'https://www.mtb.com/dealer-services'
  },
  {
    id: 'bank-of-america', name: 'Bank of America', type: 'national-bank', active: true,
    creditTiers: [
      { tier: 'super-prime', minScore: 750, baseRate: 5.69, maxLTV: 125, maxPTI: 15, maxDTI: 45, maxTerm: 84,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.certified] },
      { tier: 'prime', minScore: 700, maxScore: 749, baseRate: 7.19, maxLTV: 120, maxPTI: 14, maxDTI: 43, maxTerm: 84,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.certified, STANDARD_RATE_ADJUSTMENTS.lowDown] },
      { tier: 'near-prime', minScore: 660, maxScore: 699, baseRate: 9.99, maxLTV: 115, maxPTI: 12, maxDTI: 40, maxTerm: 72, minDown: 10,
        rateAdjustments: [], stipulations: ['Income verification'] }
    ],
    vehicleRestrictions: { maxAge: 7, maxMileage: 90000, minValue: 10000, certifiedRateReduction: 0.5 },
    loanLimits: { minAmount: 7500, maxAmount: 100000, minTerm: 24, maxTerm: 84 },
    programs: [{ name: 'Preferred Rewards', description: 'Rate discount based on Preferred Rewards tier', requirements: ['Preferred Rewards member'], rateReduction: 0.5 }],
    portalUrl: 'https://www.bankofamerica.com/dealer'
  },
  {
    id: 'pnc', name: 'PNC Bank', type: 'regional-bank', active: true,
    creditTiers: [
      { tier: 'super-prime', minScore: 750, baseRate: 5.84, maxLTV: 125, maxPTI: 16, maxDTI: 45, maxTerm: 84,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.certified] },
      { tier: 'prime', minScore: 700, maxScore: 749, baseRate: 7.34, maxLTV: 120, maxPTI: 15, maxDTI: 43, maxTerm: 84,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.certified] },
      { tier: 'near-prime', minScore: 650, maxScore: 699, baseRate: 10.24, maxLTV: 115, maxPTI: 14, maxDTI: 42, maxTerm: 72, minDown: 10,
        rateAdjustments: [], stipulations: ['Proof of income'] }
    ],
    vehicleRestrictions: { maxAge: 7, maxMileage: 100000, minValue: 8000, certifiedRateReduction: 0.5 },
    loanLimits: { minAmount: 5000, maxAmount: 100000, minTerm: 24, maxTerm: 84 },
    programs: [{ name: 'PNC WorkPlace Banking', description: 'Rate discount for WorkPlace Banking participants', requirements: ['Employer participates in PNC WorkPlace Banking'], rateReduction: 0.25 }],
    portalUrl: 'https://www.pnc.com/dealer'
  },
  {
    id: 'westlake', name: 'Westlake Financial', type: 'subprime', active: true,
    creditTiers: [
      { tier: 'near-prime', minScore: 650, maxScore: 699, baseRate: 12.99, maxLTV: 120, maxPTI: 18, maxDTI: 50, maxTerm: 72, minDown: 10,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.highMileage], stipulations: ['Proof of income', 'Proof of residence'] },
      { tier: 'subprime', minScore: 550, maxScore: 649, baseRate: 17.99, maxLTV: 115, maxPTI: 15, maxDTI: 50, maxTerm: 66, minDown: 15,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.highMileage, STANDARD_RATE_ADJUSTMENTS.bankruptcy],
        stipulations: ['2 most recent paystubs', 'Proof of residence (utility bill)', '5 personal references', 'Bank statements may be required'] },
      { tier: 'deep-subprime', minScore: 450, maxScore: 549, baseRate: 23.99, maxLTV: 105, maxPTI: 12, maxDTI: 45, maxTerm: 60, minDown: 20,
        rateAdjustments: [],
        stipulations: ['2 most recent paystubs', 'Proof of residence (utility bill)', '8 personal references', 'Bank statements required', 'Employment verification call', 'GPS/Starter interrupt may be required'] }
    ],
    vehicleRestrictions: { maxAge: 12, maxMileage: 150000, minValue: 5000 },
    loanLimits: { minAmount: 5000, maxAmount: 75000, minTerm: 24, maxTerm: 72 },
    programs: [{ name: 'Fresh Start', description: 'Program for customers rebuilding credit', requirements: ['Minimum 20% down', 'Verifiable income'], ltvBonus: 5 }],
    portalUrl: 'https://www.westlakefinancial.com/dealer'
  },
  {
    id: 'psecu', name: 'PSECU', type: 'credit-union', active: true,
    creditTiers: [
      { tier: 'super-prime', minScore: 750, baseRate: 5.24, maxLTV: 130, maxPTI: 18, maxDTI: 45, maxTerm: 84,
        rateAdjustments: [{ condition: 'Member for 2+ years', adjustment: -0.25 }, STANDARD_RATE_ADJUSTMENTS.certified] },
      { tier: 'prime', minScore: 700, maxScore: 749, baseRate: 6.49, maxLTV: 125, maxPTI: 16, maxDTI: 43, maxTerm: 84,
        rateAdjustments: [{ condition: 'Member for 2+ years', adjustment: -0.25 }, STANDARD_RATE_ADJUSTMENTS.certified] },
      { tier: 'near-prime', minScore: 650, maxScore: 699, baseRate: 8.99, maxLTV: 115, maxPTI: 14, maxDTI: 40, maxTerm: 72, minDown: 10,
        rateAdjustments: [{ condition: 'Member for 2+ years', adjustment: -0.25 }], stipulations: ['Must be PSECU member or eligible to join'] },
      { tier: 'subprime', minScore: 580, maxScore: 649, baseRate: 12.99, maxLTV: 105, maxPTI: 12, maxDTI: 38, maxTerm: 60, minDown: 15,
        rateAdjustments: [], stipulations: ['Must be PSECU member', 'Income verification required', 'May require credit counseling'] }
    ],
    vehicleRestrictions: { maxAge: 10, maxMileage: 120000, minValue: 5000, certifiedRateReduction: 0.5 },
    loanLimits: { minAmount: 5000, maxAmount: 100000, minTerm: 24, maxTerm: 84 },
    programs: [{ name: 'PSECU Member Loyalty', description: 'Additional rate discount for long-term members', requirements: ['Member for 5+ years', 'Direct deposit active'], rateReduction: 0.5 }],
    portalUrl: 'https://www.psecu.com/dealer'
  },
  {
    id: 'dexsta', name: 'Dexsta Federal Credit Union', type: 'credit-union', active: true,
    creditTiers: [
      { tier: 'super-prime', minScore: 750, baseRate: 5.49, maxLTV: 125, maxPTI: 18, maxDTI: 45, maxTerm: 84,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.certified] },
      { tier: 'prime', minScore: 700, maxScore: 749, baseRate: 6.74, maxLTV: 120, maxPTI: 16, maxDTI: 43, maxTerm: 84,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.certified] },
      { tier: 'near-prime', minScore: 640, maxScore: 699, baseRate: 9.49, maxLTV: 115, maxPTI: 14, maxDTI: 40, maxTerm: 72, minDown: 10,
        rateAdjustments: [], stipulations: ['Must be Dexsta member or eligible to join'] },
      { tier: 'subprime', minScore: 580, maxScore: 639, baseRate: 13.49, maxLTV: 105, maxPTI: 12, maxDTI: 38, maxTerm: 60, minDown: 15,
        rateAdjustments: [], stipulations: ['Must be Dexsta member', 'Income verification'] }
    ],
    vehicleRestrictions: { maxAge: 10, maxMileage: 100000, minValue: 5000, certifiedRateReduction: 0.5 },
    loanLimits: { minAmount: 5000, maxAmount: 75000, minTerm: 24, maxTerm: 84 },
    portalUrl: 'https://www.dexsta.com'
  },
  {
    id: 'citadel', name: 'Citadel Credit Union', type: 'credit-union', active: true,
    creditTiers: [
      { tier: 'super-prime', minScore: 750, baseRate: 5.29, maxLTV: 130, maxPTI: 18, maxDTI: 45, maxTerm: 84,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.certified, { condition: 'Auto-pay from Citadel checking', adjustment: -0.25 }] },
      { tier: 'prime', minScore: 700, maxScore: 749, baseRate: 6.54, maxLTV: 125, maxPTI: 16, maxDTI: 43, maxTerm: 84,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.certified, { condition: 'Auto-pay from Citadel checking', adjustment: -0.25 }] },
      { tier: 'near-prime', minScore: 650, maxScore: 699, baseRate: 9.29, maxLTV: 115, maxPTI: 14, maxDTI: 40, maxTerm: 72, minDown: 10,
        rateAdjustments: [], stipulations: ['Must be Citadel member or eligible'] },
      { tier: 'subprime', minScore: 580, maxScore: 649, baseRate: 12.79, maxLTV: 105, maxPTI: 12, maxDTI: 38, maxTerm: 60, minDown: 15,
        rateAdjustments: [], stipulations: ['Citadel membership required', 'Income docs needed'] }
    ],
    vehicleRestrictions: { maxAge: 10, maxMileage: 110000, minValue: 5000, certifiedRateReduction: 0.5 },
    loanLimits: { minAmount: 5000, maxAmount: 100000, minTerm: 24, maxTerm: 84 },
    programs: [{ name: 'Citadel Auto-Pay Discount', description: 'Rate reduction for automatic payments', requirements: ['Auto-pay from Citadel checking'], rateReduction: 0.25 }],
    portalUrl: 'https://www.citadelbanking.com'
  },
  {
    id: 'mecu', name: 'MECU', type: 'credit-union', active: true,
    creditTiers: [
      { tier: 'super-prime', minScore: 750, baseRate: 5.39, maxLTV: 125, maxPTI: 18, maxDTI: 45, maxTerm: 84,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.certified] },
      { tier: 'prime', minScore: 700, maxScore: 749, baseRate: 6.64, maxLTV: 120, maxPTI: 16, maxDTI: 43, maxTerm: 84,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.certified] },
      { tier: 'near-prime', minScore: 650, maxScore: 699, baseRate: 9.39, maxLTV: 115, maxPTI: 14, maxDTI: 40, maxTerm: 72, minDown: 10,
        rateAdjustments: [], stipulations: ['MECU membership required'] },
      { tier: 'subprime', minScore: 580, maxScore: 649, baseRate: 13.39, maxLTV: 105, maxPTI: 12, maxDTI: 38, maxTerm: 60, minDown: 15,
        rateAdjustments: [], stipulations: ['MECU membership', 'Income verification'] }
    ],
    vehicleRestrictions: { maxAge: 10, maxMileage: 100000, minValue: 5000, certifiedRateReduction: 0.5 },
    loanLimits: { minAmount: 5000, maxAmount: 75000, minTerm: 24, maxTerm: 84 },
    portalUrl: 'https://www.mecu.com'
  },
  {
    id: 'first-help', name: 'First Help Financial', type: 'subprime', active: true,
    creditTiers: [
      { tier: 'subprime', minScore: 500, maxScore: 649, baseRate: 19.99, maxLTV: 115, maxPTI: 18, maxDTI: 55, maxTerm: 60, minDown: 15,
        rateAdjustments: [STANDARD_RATE_ADJUSTMENTS.highMileage],
        stipulations: ['2 recent paystubs', 'Proof of residence', '6 references', 'Bank statement'] },
      { tier: 'deep-subprime', minScore: 400, maxScore: 499, baseRate: 24.99, maxLTV: 100, maxPTI: 15, maxDTI: 50, maxTerm: 48, minDown: 25,
        rateAdjustments: [],
        stipulations: ['2 recent paystubs', 'Proof of residence (utility bill)', '8 references', '3 months bank statements', 'Employment verification', 'GPS/Starter interrupt required', 'May require co-signer'] }
    ],
    vehicleRestrictions: { maxAge: 15, maxMileage: 175000, minValue: 4000 },
    loanLimits: { minAmount: 4000, maxAmount: 50000, minTerm: 24, maxTerm: 60 },
    programs: [
      { name: 'ITIN Program', description: 'Financing for customers with ITIN instead of SSN', requirements: ['Valid ITIN', '2 years US residency', '25% minimum down'], ltvBonus: 0 },
      { name: 'First Time Buyer', description: 'Program for customers with no auto credit history', requirements: ['No prior auto loans', 'Stable employment 6+ months'], rateReduction: 1.0 }
    ],
    portalUrl: 'https://www.firsthelpfinancial.com/dealer'
  }
];

// ============================================================================
// STATE FEES (DE/PA/MD/NJ)
// ============================================================================

var STATE_FEES = {
  DE: { stateTaxRate: 5.25, docFee: 499, titleFee: 55, registrationFee: 40, electronicFilingFee: 35 },
  PA: { stateTaxRate: 6, localTaxRate: 0, docFee: 499, titleFee: 55, registrationFee: 40, electronicFilingFee: 35 },
  MD: { stateTaxRate: 6.5, localTaxRate: 0, docFee: 499, titleFee: 55, registrationFee: 40, electronicFilingFee: 35 },
  NJ: { stateTaxRate: 6.625, localTaxRate: 0, docFee: 499, titleFee: 55, registrationFee: 40, electronicFilingFee: 35 }
};

var DEFAULT_FEES = {
  docFee: 499, titleFee: 55, registrationFee: 40, inspectionFee: 0,
  electronicFilingFee: 35, dealerConveyanceFee: 0, stateTaxRate: 5.25, localTaxRate: 0
};

// ============================================================================
// STANDARD F&I PRODUCTS (8 products)
// ============================================================================

var STANDARD_FI_PRODUCTS = [
  { name: 'Vehicle Service Contract - Platinum', type: 'vsc', cost: 895, sellPrice: 2495, term: 60, deductible: 100 },
  { name: 'Vehicle Service Contract - Gold', type: 'vsc', cost: 695, sellPrice: 1995, term: 48, deductible: 100 },
  { name: 'Vehicle Service Contract - Silver', type: 'vsc', cost: 495, sellPrice: 1495, term: 36, deductible: 100 },
  { name: 'GAP Insurance', type: 'gap', cost: 295, sellPrice: 895 },
  { name: 'Prepaid Maintenance - 3yr/36k', type: 'maintenance', cost: 395, sellPrice: 995, term: 36 },
  { name: 'Tire & Wheel Protection', type: 'tire-wheel', cost: 295, sellPrice: 795, term: 36 },
  { name: 'Key Replacement', type: 'key-replacement', cost: 195, sellPrice: 495, term: 60 },
  { name: 'Paint & Fabric Protection', type: 'paint-fabric', cost: 195, sellPrice: 595 }
];

// ============================================================================
// ESTIMATED MSRP LOOKUP TABLE
// ============================================================================

var MSRP_TABLE = {
  GMC: { Sierra: 45000, 'Sierra 1500': 45000, 'Sierra 2500': 55000, Yukon: 58000, 'Yukon XL': 62000, Acadia: 38000, Terrain: 32000, Canyon: 35000, Savana: 42000 },
  Buick: { Enclave: 45000, Envision: 38000, Encore: 28000, 'Encore GX': 30000, LaCrosse: 35000, Regal: 32000 },
  Chevrolet: { Silverado: 42000, 'Silverado 1500': 42000, Tahoe: 55000, Suburban: 58000, Equinox: 30000, Traverse: 38000, Malibu: 28000, Camaro: 35000, Colorado: 32000, Trax: 24000, Blazer: 38000 },
  Honda: { Accord: 30000, Civic: 25000, 'CR-V': 32000, Pilot: 40000, 'HR-V': 26000, Odyssey: 38000, Passport: 38000, Ridgeline: 42000 },
  Toyota: { Camry: 28000, Corolla: 24000, RAV4: 32000, Highlander: 40000, Tacoma: 35000, Tundra: 45000, '4Runner': 42000, Sienna: 40000 },
  Ford: { 'F-150': 45000, 'F-250': 55000, Explorer: 40000, Escape: 32000, Edge: 38000, Mustang: 35000, Expedition: 55000, Bronco: 42000, Ranger: 35000 },
  Nissan: { Altima: 28000, Sentra: 22000, Rogue: 32000, Pathfinder: 38000, Murano: 40000, Titan: 45000, Frontier: 35000 },
  Hyundai: { Sonata: 28000, Elantra: 23000, 'Santa Fe': 35000, Tucson: 30000, Palisade: 42000, Kona: 26000 },
  Kia: { Optima: 27000, K5: 28000, Sorento: 35000, Sportage: 30000, Telluride: 45000, Seltos: 26000 },
  Jeep: { 'Grand Cherokee': 45000, Cherokee: 35000, Wrangler: 38000, Compass: 30000, Gladiator: 42000 },
  Ram: { '1500': 45000, '2500': 55000, '3500': 60000 },
  Dodge: { Charger: 35000, Challenger: 35000, Durango: 42000 },
  Subaru: { Outback: 32000, Forester: 30000, Crosstrek: 28000, Ascent: 38000, Legacy: 28000, Impreza: 24000 },
  Mazda: { CX5: 30000, 'CX-5': 30000, CX9: 38000, 'CX-9': 38000, Mazda3: 25000, Mazda6: 28000 },
  Volkswagen: { Jetta: 24000, Passat: 28000, Tiguan: 30000, Atlas: 38000, ID4: 42000 }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getLenderById(id) {
  for (var i = 0; i < LENDERS.length; i++) {
    if (LENDERS[i].id === id) return LENDERS[i];
  }
  return null;
}

function getActiveLenders() {
  return LENDERS.filter(function(l) { return l.active; });
}

function getLendersByType(type) {
  return LENDERS.filter(function(l) { return l.type === type && l.active; });
}

function getCreditTierForScore(score) {
  if (score >= 750) return 'super-prime';
  if (score >= 700) return 'prime';
  if (score >= 650) return 'near-prime';
  if (score >= 550) return 'subprime';
  return 'deep-subprime';
}

function getEstimatedMSRP(make, model) {
  var makeTable = MSRP_TABLE[make];
  if (!makeTable) return 30000;
  if (makeTable[model]) return makeTable[model];
  var keys = Object.keys(makeTable);
  for (var i = 0; i < keys.length; i++) {
    if (model.toLowerCase().indexOf(keys[i].toLowerCase()) >= 0 || keys[i].toLowerCase().indexOf(model.toLowerCase()) >= 0) {
      return makeTable[keys[i]];
    }
  }
  return 30000;
}

function getFeesForState(state) {
  var fees = JSON.parse(JSON.stringify(DEFAULT_FEES));
  if (STATE_FEES[state]) {
    var sf = STATE_FEES[state];
    var keys = Object.keys(sf);
    for (var i = 0; i < keys.length; i++) {
      fees[keys[i]] = sf[keys[i]];
    }
  }
  return fees;
}
