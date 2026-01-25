// ============================================================================
// UNIFIED AUTOMOTIVE DEAL OPTIMIZER - TYPE DEFINITIONS
// Replicates ERA Ignite F&I Desking Functionality
// ============================================================================

// Credit Score Tiers
export type CreditTier =
  | 'super-prime'    // 750+
  | 'prime'          // 700-749
  | 'near-prime'     // 650-699
  | 'subprime'       // 550-649
  | 'deep-subprime'; // Below 550

export interface CreditProfile {
  score: number;
  tier: CreditTier;
  // Additional credit factors
  bankruptcyHistory?: boolean;
  bankruptcyAge?: number; // months since discharge
  repoHistory?: boolean;
  repoAge?: number; // months since repo
  openAutoLoans?: number;
  timeOnJob?: number; // months
  timeAtResidence?: number; // months
  monthlyIncome: number;
  monthlyDebt?: number; // existing monthly debt payments
}

export interface Vehicle {
  year: number;
  make: string;
  model: string;
  trim?: string;
  vin?: string;
  mileage: number;
  msrp?: number;
  invoiceCost?: number;
  bookValue: {
    retail?: number;
    wholesale?: number;
    nada?: number;
    kbb?: number;
    blackBook?: number;
  };
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  certified?: boolean;
  certificationProgram?: 'gm-certified' | 'honda-certified' | 'dealer-certified' | 'none';
  vehicleClass: VehicleClass;
  fuelType?: 'gas' | 'diesel' | 'hybrid' | 'electric';
}

export type VehicleClass =
  | 'economy'
  | 'compact'
  | 'midsize'
  | 'fullsize'
  | 'luxury'
  | 'suv'
  | 'truck'
  | 'van'
  | 'sports';

// Deal Structure
export interface DealStructure {
  // Vehicle pricing
  sellingPrice: number;
  tradeValue?: number;
  tradePayoff?: number;
  rebates?: number;

  // Cash components
  cashDown: number;

  // F&I Products
  fiProducts: FIProduct[];

  // Fees
  fees: DealFees;

  // Calculated totals
  totalCashPrice?: number;
  amountFinanced?: number;
  netTrade?: number;
}

export interface FIProduct {
  name: string;
  type: FIProductType;
  cost: number;
  sellPrice: number;
  term?: number;
  deductible?: number;
  financed: boolean;
}

export type FIProductType =
  | 'vsc'           // Vehicle Service Contract
  | 'gap'           // GAP Insurance
  | 'maintenance'   // Prepaid Maintenance
  | 'tire-wheel'    // Tire & Wheel Protection
  | 'key-replacement'
  | 'paint-fabric'
  | 'theft-protection'
  | 'credit-life'
  | 'credit-disability';

export interface DealFees {
  docFee: number;
  titleFee: number;
  registrationFee: number;
  inspectionFee?: number;
  electronicFilingFee?: number;
  dealerConveyanceFee?: number;
  stateTaxRate: number; // percentage
  localTaxRate?: number; // percentage
  luxuryTax?: number;
}

// Loan Terms
export interface LoanTerms {
  apr: number;
  termMonths: number;
  monthlyPayment: number;
  totalInterest: number;
  totalOfPayments: number;
  firstPaymentDate: Date;
  lenderId: string;
  lenderName: string;
  approvalStatus: ApprovalStatus;
  approvalConditions?: string[];
  buyRate?: number; // dealer cost rate
  dealerReserve?: number; // markup profit
  maxAdvance?: number;
  ltv?: number;
  pti?: number; // payment to income ratio
  dti?: number; // debt to income ratio
}

export type ApprovalStatus =
  | 'auto-approved'
  | 'conditional'
  | 'review-needed'
  | 'likely-decline'
  | 'declined';

// Lender Configuration
export interface LenderConfig {
  id: string;
  name: string;
  type: LenderType;
  active: boolean;

  // Credit requirements by tier
  creditTiers: LenderCreditTier[];

  // Vehicle restrictions
  vehicleRestrictions: VehicleRestrictions;

  // Loan limits
  loanLimits: LoanLimits;

  // Special programs
  programs?: LenderProgram[];

  // Contact info
  dealerContact?: string;
  dealerPhone?: string;
  portalUrl?: string;
}

export type LenderType =
  | 'captive'        // Manufacturer captive (GM Financial)
  | 'national-bank'  // Chase, BoA, Wells
  | 'regional-bank'  // M&T, PNC
  | 'credit-union'   // PSECU, Citadel, etc.
  | 'subprime'       // Westlake, First Help
  | 'full-spectrum'; // Ally (all credit tiers)

export interface LenderCreditTier {
  tier: CreditTier;
  minScore: number;
  maxScore?: number;
  baseRate: number;
  rateAdjustments: RateAdjustment[];
  maxLTV: number;
  maxPTI: number;
  maxDTI?: number;
  maxTerm: number;
  minDown?: number; // minimum down payment percentage
  stipulations?: string[];
}

export interface RateAdjustment {
  condition: string;
  adjustment: number; // positive = increase, negative = decrease
}

export interface VehicleRestrictions {
  maxAge: number; // maximum vehicle age in years
  maxMileage: number;
  minValue?: number;
  excludedMakes?: string[];
  excludedClasses?: VehicleClass[];
  requiresCertified?: boolean;
  certifiedRateReduction?: number;
}

export interface LoanLimits {
  minAmount: number;
  maxAmount: number;
  minTerm: number;
  maxTerm: number;
  maxLTVByAge?: { [ageYears: number]: number };
}

export interface LenderProgram {
  name: string;
  description: string;
  requirements: string[];
  rateReduction?: number;
  ltvBonus?: number;
  termExtension?: number;
}

// Deal Comparison
export interface DealScenario {
  id: string;
  name: string;
  structure: DealStructure;
  creditProfile: CreditProfile;
  vehicle: Vehicle;
  lenderOptions: LoanTerms[];
  bestOption?: LoanTerms;
  createdAt: Date;
}

// Approval Recommendation
export interface ApprovalRecommendation {
  lender: LenderConfig;
  terms: LoanTerms;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string[];
  warnings: string[];
  suggestedAdjustments?: DealAdjustment[];
}

export interface DealAdjustment {
  type: 'increase-down' | 'reduce-price' | 'shorten-term' | 'add-trade' | 'remove-products';
  description: string;
  impact: string;
  newValue?: number;
}

// Payment Calculation
export interface PaymentCalculation {
  principal: number;
  apr: number;
  termMonths: number;
  monthlyPayment: number;
  totalInterest: number;
  totalOfPayments: number;
  amortizationSchedule?: AmortizationEntry[];
}

export interface AmortizationEntry {
  paymentNumber: number;
  paymentAmount: number;
  principalPortion: number;
  interestPortion: number;
  remainingBalance: number;
}
