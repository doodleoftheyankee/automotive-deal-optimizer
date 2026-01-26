// ============================================================================
// DEAL DESKING MODULE
// Replicates ERA Ignite F&I Desking Functionality
// ============================================================================

import {
  DealStructure,
  DealFees,
  FIProduct,
  Vehicle,
  CreditProfile,
  LoanTerms,
  DealScenario,
  PaymentCalculation,
} from '../types';
import {
  calculateAmountFinanced,
  calculateMonthlyPayment,
  calculatePayment,
  calculateLTV,
  calculatePTI,
  calculateDTI,
  calculateDealerReserve,
  calculateFIProfit,
  calculatePrincipalFromPayment,
} from '../calculators/payment';

// ============================================================================
// DEFAULT FEE CONFIGURATION (Delaware/PA Region)
// ============================================================================

export const defaultFees: DealFees = {
  docFee: 499,
  titleFee: 55,
  registrationFee: 40,
  inspectionFee: 0,
  electronicFilingFee: 35,
  dealerConveyanceFee: 0,
  stateTaxRate: 4.25, // Delaware has no state sales tax on vehicles for residents
  localTaxRate: 0,
};

// Delaware residents: 4.25% document fee in lieu of sales tax
// PA residents: 6% sales tax (+ local if applicable)
export const stateFeesConfig: Record<string, Partial<DealFees>> = {
  DE: {
    stateTaxRate: 0, // No sales tax
    docFee: 499,
  },
  PA: {
    stateTaxRate: 6,
    localTaxRate: 0,
    docFee: 499,
  },
  MD: {
    stateTaxRate: 6,
    localTaxRate: 0,
    docFee: 499,
  },
  NJ: {
    stateTaxRate: 6.625,
    localTaxRate: 0,
    docFee: 499,
  },
};

// ============================================================================
// STANDARD F&I PRODUCTS
// ============================================================================

export const standardFIProducts: Omit<FIProduct, 'financed'>[] = [
  {
    name: 'Vehicle Service Contract - Platinum',
    type: 'vsc',
    cost: 895,
    sellPrice: 2495,
    term: 60,
    deductible: 100,
  },
  {
    name: 'Vehicle Service Contract - Gold',
    type: 'vsc',
    cost: 695,
    sellPrice: 1995,
    term: 48,
    deductible: 100,
  },
  {
    name: 'Vehicle Service Contract - Silver',
    type: 'vsc',
    cost: 495,
    sellPrice: 1495,
    term: 36,
    deductible: 100,
  },
  {
    name: 'GAP Insurance',
    type: 'gap',
    cost: 295,
    sellPrice: 895,
  },
  {
    name: 'Prepaid Maintenance - 3yr/36k',
    type: 'maintenance',
    cost: 395,
    sellPrice: 995,
    term: 36,
  },
  {
    name: 'Prepaid Maintenance - 5yr/60k',
    type: 'maintenance',
    cost: 595,
    sellPrice: 1495,
    term: 60,
  },
  {
    name: 'Tire & Wheel Protection',
    type: 'tire-wheel',
    cost: 295,
    sellPrice: 795,
    term: 36,
  },
  {
    name: 'Key Replacement',
    type: 'key-replacement',
    cost: 195,
    sellPrice: 495,
    term: 60,
  },
  {
    name: 'Paint & Fabric Protection',
    type: 'paint-fabric',
    cost: 195,
    sellPrice: 595,
  },
  {
    name: 'Theft Deterrent System',
    type: 'theft-protection',
    cost: 295,
    sellPrice: 695,
  },
];

// ============================================================================
// DEAL DESK CLASS
// ============================================================================

export class DealDesk {
  private deal: DealStructure;
  private vehicle: Vehicle;
  private credit: CreditProfile;
  private customerState: string;

  constructor(
    vehicle: Vehicle,
    credit: CreditProfile,
    customerState: string = 'DE'
  ) {
    this.vehicle = vehicle;
    this.credit = credit;
    this.customerState = customerState;

    // Initialize default deal structure
    this.deal = {
      sellingPrice: vehicle.bookValue.retail || 0,
      cashDown: 0,
      fiProducts: [],
      fees: { ...defaultFees, ...stateFeesConfig[customerState] },
    };
  }

  // ==========================================================================
  // DEAL STRUCTURE METHODS
  // ==========================================================================

  setSellingPrice(price: number): this {
    this.deal.sellingPrice = price;
    return this;
  }

  setTrade(value: number, payoff: number = 0): this {
    this.deal.tradeValue = value;
    this.deal.tradePayoff = payoff;
    return this;
  }

  setCashDown(amount: number): this {
    this.deal.cashDown = amount;
    return this;
  }

  setRebates(amount: number): this {
    this.deal.rebates = amount;
    return this;
  }

  addFIProduct(product: FIProduct): this {
    this.deal.fiProducts.push(product);
    return this;
  }

  removeFIProduct(productName: string): this {
    this.deal.fiProducts = this.deal.fiProducts.filter(
      (p) => p.name !== productName
    );
    return this;
  }

  clearFIProducts(): this {
    this.deal.fiProducts = [];
    return this;
  }

  updateFees(fees: Partial<DealFees>): this {
    this.deal.fees = { ...this.deal.fees, ...fees };
    return this;
  }

  // ==========================================================================
  // CALCULATION METHODS
  // ==========================================================================

  getNetTrade(): number {
    return (this.deal.tradeValue || 0) - (this.deal.tradePayoff || 0);
  }

  getTaxableAmount(): number {
    const netTrade = this.getNetTrade();
    return Math.max(
      0,
      this.deal.sellingPrice - netTrade - (this.deal.rebates || 0)
    );
  }

  getSalesTax(): number {
    const taxable = this.getTaxableAmount();
    const totalRate =
      this.deal.fees.stateTaxRate + (this.deal.fees.localTaxRate || 0);
    return Math.round(taxable * (totalRate / 100) * 100) / 100;
  }

  getTotalFees(): number {
    const { fees } = this.deal;
    return (
      fees.docFee +
      fees.titleFee +
      fees.registrationFee +
      (fees.inspectionFee || 0) +
      (fees.electronicFilingFee || 0) +
      (fees.dealerConveyanceFee || 0) +
      (fees.luxuryTax || 0)
    );
  }

  getFinancedProducts(): number {
    return this.deal.fiProducts
      .filter((p) => p.financed)
      .reduce((sum, p) => sum + p.sellPrice, 0);
  }

  getTotalCashPrice(): number {
    return (
      this.deal.sellingPrice +
      this.getSalesTax() +
      this.getTotalFees() +
      this.getFinancedProducts() -
      this.getNetTrade()
    );
  }

  getAmountFinanced(): number {
    return this.getTotalCashPrice() - this.deal.cashDown;
  }

  getVehicleValue(): number {
    // Use retail book value as primary, fallback to others
    return (
      this.vehicle.bookValue.retail ||
      this.vehicle.bookValue.nada ||
      this.vehicle.bookValue.kbb ||
      this.vehicle.bookValue.blackBook ||
      this.deal.sellingPrice
    );
  }

  getLTV(): number {
    return calculateLTV(this.getAmountFinanced(), this.getVehicleValue());
  }

  // ==========================================================================
  // PAYMENT SCENARIOS
  // ==========================================================================

  calculatePayment(apr: number, termMonths: number): PaymentCalculation {
    return calculatePayment(this.getAmountFinanced(), apr, termMonths, false);
  }

  getPTI(monthlyPayment: number): number {
    return calculatePTI(monthlyPayment, this.credit.monthlyIncome);
  }

  getDTI(monthlyPayment: number): number {
    return calculateDTI(
      monthlyPayment,
      this.credit.monthlyDebt || 0,
      this.credit.monthlyIncome
    );
  }

  /**
   * Generate payment grid (ERA Ignite style)
   * Shows payments across multiple terms and rates
   */
  generatePaymentGrid(
    rates: number[],
    terms: number[]
  ): Array<{
    apr: number;
    payments: Array<{ term: number; payment: number; totalInterest: number }>;
  }> {
    const amountFinanced = this.getAmountFinanced();

    return rates.map((apr) => ({
      apr,
      payments: terms.map((term) => {
        const calc = calculatePayment(amountFinanced, apr, term, false);
        return {
          term,
          payment: calc.monthlyPayment,
          totalInterest: calc.totalInterest,
        };
      }),
    }));
  }

  /**
   * Find payment that meets target payment
   */
  findPaymentScenarios(
    targetPayment: number,
    minTerm: number = 36,
    maxTerm: number = 84
  ): Array<{
    apr: number;
    term: number;
    payment: number;
    downNeeded: number;
  }> {
    const scenarios: Array<{
      apr: number;
      term: number;
      payment: number;
      downNeeded: number;
    }> = [];

    const rates = [5.99, 7.99, 9.99, 11.99, 14.99, 17.99];
    const terms = [36, 48, 60, 66, 72, 75, 84].filter(
      (t) => t >= minTerm && t <= maxTerm
    );

    for (const apr of rates) {
      for (const term of terms) {
        const maxPrincipal = calculatePrincipalFromPayment(
          targetPayment,
          apr,
          term
        );
        const currentFinanced = this.getAmountFinanced();

        if (currentFinanced <= maxPrincipal) {
          const payment = calculateMonthlyPayment(currentFinanced, apr, term);
          scenarios.push({
            apr,
            term,
            payment,
            downNeeded: 0,
          });
        } else {
          const additionalDown = currentFinanced - maxPrincipal;
          scenarios.push({
            apr,
            term,
            payment: targetPayment,
            downNeeded: additionalDown,
          });
        }
      }
    }

    return scenarios.sort((a, b) => a.downNeeded - b.downNeeded);
  }

  // ==========================================================================
  // DEAL SUMMARY
  // ==========================================================================

  getDealSummary(apr: number, termMonths: number): DealSummary {
    const calc = this.calculatePayment(apr, termMonths);

    return {
      // Vehicle Info
      vehicle: `${this.vehicle.year} ${this.vehicle.make} ${this.vehicle.model}`,
      vehicleValue: this.getVehicleValue(),
      mileage: this.vehicle.mileage,
      certified: this.vehicle.certified || false,

      // Pricing
      sellingPrice: this.deal.sellingPrice,
      tradeValue: this.deal.tradeValue || 0,
      tradePayoff: this.deal.tradePayoff || 0,
      netTrade: this.getNetTrade(),
      rebates: this.deal.rebates || 0,

      // Taxes & Fees
      salesTax: this.getSalesTax(),
      totalFees: this.getTotalFees(),
      feeBreakdown: {
        docFee: this.deal.fees.docFee,
        titleFee: this.deal.fees.titleFee,
        registrationFee: this.deal.fees.registrationFee,
        otherFees:
          (this.deal.fees.inspectionFee || 0) +
          (this.deal.fees.electronicFilingFee || 0) +
          (this.deal.fees.dealerConveyanceFee || 0),
      },

      // F&I
      fiProducts: this.deal.fiProducts,
      financedProducts: this.getFinancedProducts(),

      // Totals
      totalCashPrice: this.getTotalCashPrice(),
      cashDown: this.deal.cashDown,
      amountFinanced: this.getAmountFinanced(),

      // Loan Terms
      apr,
      termMonths,
      monthlyPayment: calc.monthlyPayment,
      totalInterest: calc.totalInterest,
      totalOfPayments: calc.totalOfPayments,

      // Ratios
      ltv: this.getLTV(),
      pti: this.getPTI(calc.monthlyPayment),
      dti: this.getDTI(calc.monthlyPayment),

      // Credit
      creditScore: this.credit.score,
      creditTier: this.credit.tier,
      monthlyIncome: this.credit.monthlyIncome,
    };
  }

  // ==========================================================================
  // QUICK DESK (Single Screen Calculation)
  // ==========================================================================

  quickDesk(params: QuickDeskParams): QuickDeskResult {
    // Update deal with quick desk params
    this.setSellingPrice(params.sellingPrice);
    if (params.tradeValue !== undefined) {
      this.setTrade(params.tradeValue, params.tradePayoff || 0);
    }
    if (params.cashDown !== undefined) {
      this.setCashDown(params.cashDown);
    }
    if (params.rebates !== undefined) {
      this.setRebates(params.rebates);
    }

    const amountFinanced = this.getAmountFinanced();
    const vehicleValue = this.getVehicleValue();
    const ltv = this.getLTV();

    // Calculate for all requested scenarios
    const scenarios = params.scenarios.map((s) => {
      const payment = calculateMonthlyPayment(amountFinanced, s.apr, s.term);
      const pti = this.getPTI(payment);
      const dti = this.getDTI(payment);

      return {
        apr: s.apr,
        term: s.term,
        payment,
        pti,
        dti,
        totalInterest: payment * s.term - amountFinanced,
        totalOfPayments: payment * s.term,
      };
    });

    return {
      amountFinanced,
      vehicleValue,
      ltv,
      netTrade: this.getNetTrade(),
      salesTax: this.getSalesTax(),
      totalFees: this.getTotalFees(),
      scenarios,
    };
  }

  // ==========================================================================
  // EXPORT DEAL
  // ==========================================================================

  exportDeal(): DealStructure {
    return { ...this.deal };
  }

  exportScenario(apr: number, termMonths: number, lenderId?: string): DealScenario {
    return {
      id: `deal-${Date.now()}`,
      name: `${this.vehicle.year} ${this.vehicle.make} ${this.vehicle.model}`,
      structure: this.exportDeal(),
      creditProfile: this.credit,
      vehicle: this.vehicle,
      lenderOptions: [],
      createdAt: new Date(),
    };
  }
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface DealSummary {
  vehicle: string;
  vehicleValue: number;
  mileage: number;
  certified: boolean;

  sellingPrice: number;
  tradeValue: number;
  tradePayoff: number;
  netTrade: number;
  rebates: number;

  salesTax: number;
  totalFees: number;
  feeBreakdown: {
    docFee: number;
    titleFee: number;
    registrationFee: number;
    otherFees: number;
  };

  fiProducts: FIProduct[];
  financedProducts: number;

  totalCashPrice: number;
  cashDown: number;
  amountFinanced: number;

  apr: number;
  termMonths: number;
  monthlyPayment: number;
  totalInterest: number;
  totalOfPayments: number;

  ltv: number;
  pti: number;
  dti: number;

  creditScore: number;
  creditTier: string;
  monthlyIncome: number;
}

export interface QuickDeskParams {
  sellingPrice: number;
  tradeValue?: number;
  tradePayoff?: number;
  cashDown?: number;
  rebates?: number;
  scenarios: Array<{ apr: number; term: number }>;
}

export interface QuickDeskResult {
  amountFinanced: number;
  vehicleValue: number;
  ltv: number;
  netTrade: number;
  salesTax: number;
  totalFees: number;
  scenarios: Array<{
    apr: number;
    term: number;
    payment: number;
    pti: number;
    dti: number;
    totalInterest: number;
    totalOfPayments: number;
  }>;
}
