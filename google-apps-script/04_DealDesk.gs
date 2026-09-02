// ============================================================================
// DEAL DESK - ERA Ignite Style F&I Desking
// Fluent API for deal structuring, tax/fee calc, payment grid generation
// ============================================================================

function createDealDesk(vehicle, credit, customerState) {
  customerState = customerState || 'DE';
  var fees = getFeesForState(customerState);
  var deal = {
    sellingPrice: (vehicle.bookValue && vehicle.bookValue.retail) || 0,
    tradeValue: 0, tradePayoff: 0, cashDown: 0, rebates: 0,
    fiProducts: [], fees: fees
  };

  return {
    setSellingPrice: function(price) { deal.sellingPrice = price; return this; },
    setTrade: function(value, payoff) { deal.tradeValue = value; deal.tradePayoff = payoff || 0; return this; },
    setCashDown: function(amount) { deal.cashDown = amount; return this; },
    setRebates: function(amount) { deal.rebates = amount; return this; },
    addFIProduct: function(product) { deal.fiProducts.push(product); return this; },
    removeFIProduct: function(name) {
      deal.fiProducts = deal.fiProducts.filter(function(p) { return p.name !== name; });
      return this;
    },
    clearFIProducts: function() { deal.fiProducts = []; return this; },
    updateFees: function(newFees) {
      var keys = Object.keys(newFees);
      for (var i = 0; i < keys.length; i++) deal.fees[keys[i]] = newFees[keys[i]];
      return this;
    },

    getNetTrade: function() { return (deal.tradeValue || 0) - (deal.tradePayoff || 0); },

    getTaxableAmount: function() {
      return Math.max(0, deal.sellingPrice - this.getNetTrade() - (deal.rebates || 0));
    },

    getSalesTax: function() {
      var totalRate = deal.fees.stateTaxRate + (deal.fees.localTaxRate || 0);
      return Math.round(this.getTaxableAmount() * (totalRate / 100) * 100) / 100;
    },

    getTotalFees: function() {
      return deal.fees.docFee + deal.fees.titleFee + deal.fees.registrationFee +
        (deal.fees.inspectionFee || 0) + (deal.fees.electronicFilingFee || 0) +
        (deal.fees.dealerConveyanceFee || 0) + (deal.fees.luxuryTax || 0);
    },

    getFinancedProducts: function() {
      var total = 0;
      for (var i = 0; i < deal.fiProducts.length; i++) {
        if (deal.fiProducts[i].financed) total += deal.fiProducts[i].sellPrice;
      }
      return total;
    },

    getTotalCashPrice: function() {
      return deal.sellingPrice + this.getSalesTax() + this.getTotalFees() + this.getFinancedProducts() - this.getNetTrade();
    },

    getAmountFinanced: function() { return this.getTotalCashPrice() - deal.cashDown; },

    getVehicleValue: function() {
      return (vehicle.bookValue && vehicle.bookValue.retail) ||
        (vehicle.bookValue && vehicle.bookValue.nada) ||
        (vehicle.bookValue && vehicle.bookValue.kbb) || deal.sellingPrice;
    },

    getLTV: function() { return calculateLTV(this.getAmountFinanced(), this.getVehicleValue()); },

    getPTI: function(payment) { return calculatePTI(payment, credit.monthlyIncome); },

    getDTI: function(payment) {
      return calculateDTI(payment, credit.monthlyDebt || 0, credit.monthlyIncome);
    },

    calculatePaymentCalc: function(apr, termMonths) {
      return calculatePayment(this.getAmountFinanced(), apr, termMonths, false);
    },

    generatePaymentGrid: function(rates, terms) {
      var amountFinanced = this.getAmountFinanced();
      var grid = [];
      for (var r = 0; r < rates.length; r++) {
        var row = { apr: rates[r], payments: [] };
        for (var t = 0; t < terms.length; t++) {
          var calc = calculatePayment(amountFinanced, rates[r], terms[t], false);
          row.payments.push({ term: terms[t], payment: calc.monthlyPayment, totalInterest: calc.totalInterest });
        }
        grid.push(row);
      }
      return grid;
    },

    getDealSummary: function(apr, termMonths) {
      var calc = this.calculatePaymentCalc(apr, termMonths);
      return {
        vehicle: vehicle.year + ' ' + vehicle.make + ' ' + vehicle.model,
        vehicleValue: this.getVehicleValue(), mileage: vehicle.mileage,
        certified: vehicle.certified || false,
        sellingPrice: deal.sellingPrice, tradeValue: deal.tradeValue || 0,
        tradePayoff: deal.tradePayoff || 0, netTrade: this.getNetTrade(),
        rebates: deal.rebates || 0, salesTax: this.getSalesTax(),
        totalFees: this.getTotalFees(), financedProducts: this.getFinancedProducts(),
        totalCashPrice: this.getTotalCashPrice(), cashDown: deal.cashDown,
        amountFinanced: this.getAmountFinanced(),
        apr: apr, termMonths: termMonths,
        monthlyPayment: calc.monthlyPayment, totalInterest: calc.totalInterest,
        totalOfPayments: calc.totalOfPayments,
        ltv: this.getLTV(), pti: this.getPTI(calc.monthlyPayment),
        dti: this.getDTI(calc.monthlyPayment),
        creditScore: credit.score, creditTier: credit.tier,
        monthlyIncome: credit.monthlyIncome
      };
    },

    exportDeal: function() { return JSON.parse(JSON.stringify(deal)); }
  };
}
