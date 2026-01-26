// ============================================================================
// DEAL OPTIMIZER - FRONTEND APPLICATION
// ERA IGNITE STYLE INTERFACE
// ============================================================================

// Tab Navigation
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    // Update active tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Show corresponding content
    const tabId = tab.dataset.tab;
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');

    // Load lenders if switching to that tab
    if (tabId === 'lenders') {
      loadLenders();
    }
  });
});

// ============================================================================
// ERA IGNITE STYLE WORKSHEET - REAL-TIME CALCULATIONS
// ============================================================================

// State tax rates
const STATE_TAX_RATES = {
  'DE': 0.0525,   // Delaware - 5.25%
  'PA': 0.06,     // Pennsylvania - 6%
  'MD': 0.065,    // Maryland - 6.5%
  'NJ': 0.06625   // New Jersey - 6.625%
};

// ============================================================================
// DEAL TYPE TOGGLE (Retail / Lease / Cash)
// ============================================================================

document.getElementById('deal-type')?.addEventListener('change', (e) => {
  const dealType = e.target.value;
  const retailWorksheet = document.getElementById('retail-worksheet');
  const leaseWorksheet = document.getElementById('lease-worksheet');
  const worksheetTitle = document.getElementById('worksheet-title');
  const analyzeBtn = document.getElementById('btn-analyze');

  if (dealType === 'lease') {
    retailWorksheet.style.display = 'none';
    leaseWorksheet.style.display = 'grid';
    worksheetTitle.textContent = 'Lease Worksheet';
    analyzeBtn.style.display = 'none';

    // Sync MSRP from retail to lease
    const msrp = document.getElementById('msrp')?.value || 0;
    document.getElementById('lease-msrp').value = msrp;

    // Calculate lease
    calculateLeaseWorksheet();
  } else {
    retailWorksheet.style.display = 'grid';
    leaseWorksheet.style.display = 'none';
    worksheetTitle.textContent = dealType === 'cash' ? 'Cash Worksheet' : 'Retail Worksheet';
    analyzeBtn.style.display = '';

    // Calculate retail
    calculateWorksheet();
  }
});

// ============================================================================
// LEASE WORKSHEET CALCULATIONS
// ============================================================================

const leaseInputs = [
  'lease-msrp', 'lease-discount', 'lease-acq-fee', 'lease-dealer-adds', 'lease-prior-bal',
  'lease-doc-fee', 'lease-title-fees', 'lease-cash-down', 'lease-trade-allow', 'lease-trade-payoff',
  'lease-rebates', 'lease-term', 'lease-miles', 'lease-residual-pct', 'lease-money-factor',
  'customer-state'
];

// Add event listeners for lease calculation
leaseInputs.forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', calculateLeaseWorksheet);
    el.addEventListener('change', calculateLeaseWorksheet);
  }
});

function calculateLeaseWorksheet() {
  // Get lease input values
  const msrp = parseFloat(document.getElementById('lease-msrp')?.value) || 0;
  const discount = parseFloat(document.getElementById('lease-discount')?.value) || 0;
  const acqFee = parseFloat(document.getElementById('lease-acq-fee')?.value) || 0;
  const dealerAdds = parseFloat(document.getElementById('lease-dealer-adds')?.value) || 0;
  const priorBal = parseFloat(document.getElementById('lease-prior-bal')?.value) || 0;
  const docFee = parseFloat(document.getElementById('lease-doc-fee')?.value) || 0;
  const titleFees = parseFloat(document.getElementById('lease-title-fees')?.value) || 0;

  const cashDown = parseFloat(document.getElementById('lease-cash-down')?.value) || 0;
  const tradeAllow = parseFloat(document.getElementById('lease-trade-allow')?.value) || 0;
  const tradePayoff = parseFloat(document.getElementById('lease-trade-payoff')?.value) || 0;
  const rebates = parseFloat(document.getElementById('lease-rebates')?.value) || 0;

  const term = parseInt(document.getElementById('lease-term')?.value) || 36;
  const residualPct = parseFloat(document.getElementById('lease-residual-pct')?.value) || 55;
  const moneyFactor = parseFloat(document.getElementById('lease-money-factor')?.value) || 0.00125;

  const state = document.getElementById('customer-state')?.value || 'DE';
  const taxRate = STATE_TAX_RATES[state] || 0.0525;

  // Calculate selling price
  const sellingPrice = msrp - discount;
  document.getElementById('lease-selling-price').value = sellingPrice.toFixed(2);

  // Calculate Gross Cap Cost
  const grossCapCost = sellingPrice + acqFee + dealerAdds + priorBal + docFee + titleFees;
  document.getElementById('lease-gross-cap').value = grossCapCost.toFixed(2);

  // Calculate Net Trade
  const netTrade = tradeAllow - tradePayoff;
  document.getElementById('lease-net-trade').value = netTrade.toFixed(2);

  // Calculate Total Cap Reduction
  const totalCapReduction = cashDown + Math.max(0, netTrade) + rebates;
  document.getElementById('lease-total-cap-red').value = totalCapReduction.toFixed(2);

  // Calculate Adjusted Cap Cost
  let adjustedCapCost = grossCapCost - totalCapReduction;
  // Add negative equity if trade is upside down
  if (netTrade < 0) {
    adjustedCapCost += Math.abs(netTrade);
  }
  document.getElementById('lease-adj-cap').value = adjustedCapCost.toFixed(2);

  // Calculate Residual Value
  const residualValue = msrp * (residualPct / 100);
  document.getElementById('lease-residual-value').value = residualValue.toFixed(2);

  // Calculate Depreciation (monthly)
  const totalDepreciation = adjustedCapCost - residualValue;
  const monthlyDepreciation = totalDepreciation / term;
  document.getElementById('lease-depreciation').value = monthlyDepreciation.toFixed(2);

  // Calculate Rent Charge (finance charge portion)
  const monthlyRentCharge = (adjustedCapCost + residualValue) * moneyFactor;
  document.getElementById('lease-rent-charge').value = monthlyRentCharge.toFixed(2);

  // Base payment before tax
  const basePayment = monthlyDepreciation + monthlyRentCharge;
  document.getElementById('lease-base-payment').value = basePayment.toFixed(2);

  // Calculate monthly tax (on base payment for most states)
  const monthlyTax = basePayment * taxRate;
  document.getElementById('lease-monthly-tax').value = monthlyTax.toFixed(2);

  // Total monthly payment
  const totalPayment = basePayment + monthlyTax;
  document.getElementById('lease-payment-display').value = totalPayment.toFixed(2);

  // Due at signing (first payment + cap reduction + first month tax)
  const dueAtSigning = totalPayment + cashDown + (acqFee > 0 ? acqFee : 0);
  document.getElementById('lease-due-signing').value = dueAtSigning.toFixed(2);

  // Update metrics
  const pctOfMsrp = msrp > 0 ? (adjustedCapCost / msrp * 100) : 0;
  const mfAsApr = moneyFactor * 2400;

  document.getElementById('lease-pct-msrp').textContent = pctOfMsrp.toFixed(1) + '%';
  document.getElementById('lease-mf-apr').textContent = mfAsApr.toFixed(2) + '%';
  document.getElementById('lease-res-pct').textContent = residualPct.toFixed(0) + '%';

  // Color code metrics
  const pctEl = document.getElementById('lease-pct-msrp');
  pctEl.classList.remove('pass', 'warn', 'fail');
  if (pctOfMsrp <= 100) pctEl.classList.add('pass');
  else if (pctOfMsrp <= 110) pctEl.classList.add('warn');
  else pctEl.classList.add('fail');

  return {
    adjustedCapCost,
    residualValue,
    monthlyPayment: totalPayment,
    term,
    moneyFactor,
    residualPct
  };
}

// Set today's date
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  const dealDateEl = document.getElementById('deal-date');
  if (dealDateEl) dealDateEl.value = today;

  // Set first payment date (45 days from now)
  const firstPaymentEl = document.getElementById('first-payment-date');
  if (firstPaymentEl) {
    const firstPayment = new Date();
    firstPayment.setDate(firstPayment.getDate() + 45);
    firstPaymentEl.value = firstPayment.toISOString().split('T')[0];
  }
});

// All worksheet input fields that trigger recalculation
const worksheetInputs = [
  'msrp', 'discount', 'aftermarkets', 'admin-fee', 'vsi-premium', 'esc-premium',
  'maintenance', 'gap-premium', 'lah-iui', 'prior-lease-bal', 'license-fee', 'dealer-fees',
  'cash-down', 'deposit', 'total-rebates', 'total-trade-all', 'total-trade-payoff', 'total-def-down',
  'term', 'sell-rate', 'days-to-first', 'prepaid-fin-charge',
  'customer-state', 'credit-score', 'monthly-income', 'monthly-debt'
];

// Add event listeners for real-time calculation
worksheetInputs.forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', calculateWorksheet);
    el.addEventListener('change', calculateWorksheet);
  }
});

// Calculate button
document.getElementById('btn-calculate')?.addEventListener('click', calculateWorksheet);

// Main calculation function
function calculateWorksheet() {
  // Get all input values
  const msrp = parseFloat(document.getElementById('msrp')?.value) || 0;
  const discount = parseFloat(document.getElementById('discount')?.value) || 0;
  const aftermarkets = parseFloat(document.getElementById('aftermarkets')?.value) || 0;
  const adminFee = parseFloat(document.getElementById('admin-fee')?.value) || 0;
  const vsiPremium = parseFloat(document.getElementById('vsi-premium')?.value) || 0;
  const escPremium = parseFloat(document.getElementById('esc-premium')?.value) || 0;
  const maintenance = parseFloat(document.getElementById('maintenance')?.value) || 0;
  const gapPremium = parseFloat(document.getElementById('gap-premium')?.value) || 0;
  const lahIui = parseFloat(document.getElementById('lah-iui')?.value) || 0;
  const priorLeaseBal = parseFloat(document.getElementById('prior-lease-bal')?.value) || 0;
  const licenseFee = parseFloat(document.getElementById('license-fee')?.value) || 0;
  const dealerFees = parseFloat(document.getElementById('dealer-fees')?.value) || 0;

  const cashDown = parseFloat(document.getElementById('cash-down')?.value) || 0;
  const deposit = parseFloat(document.getElementById('deposit')?.value) || 0;
  const totalRebates = parseFloat(document.getElementById('total-rebates')?.value) || 0;
  const totalTradeAll = parseFloat(document.getElementById('total-trade-all')?.value) || 0;
  const totalTradePayoff = parseFloat(document.getElementById('total-trade-payoff')?.value) || 0;
  const totalDefDown = parseFloat(document.getElementById('total-def-down')?.value) || 0;

  const term = parseInt(document.getElementById('term')?.value) || 72;
  const sellRate = parseFloat(document.getElementById('sell-rate')?.value) || 0;
  const daysToFirst = parseInt(document.getElementById('days-to-first')?.value) || 45;
  const prepaidFinCharge = parseFloat(document.getElementById('prepaid-fin-charge')?.value) || 0;

  const state = document.getElementById('customer-state')?.value || 'DE';
  const creditScore = parseInt(document.getElementById('credit-score')?.value) || 680;
  const monthlyIncome = parseFloat(document.getElementById('monthly-income')?.value) || 5000;
  const monthlyDebt = parseFloat(document.getElementById('monthly-debt')?.value) || 0;

  // Calculate selling price
  const sellingPrice = msrp - discount;
  document.getElementById('selling-price').value = sellingPrice.toFixed(2);

  // Calculate total fees
  const totalFees = adminFee + licenseFee + dealerFees;
  document.getElementById('total-fees').value = totalFees.toFixed(2);

  // Calculate F&I products total
  const fiProducts = vsiPremium + escPremium + maintenance + gapPremium + lahIui;

  // Calculate taxable amount (selling price + aftermarkets + some fees depending on state)
  const taxableAmount = sellingPrice + aftermarkets;
  const taxRate = STATE_TAX_RATES[state] || 0;
  const totalTaxes = taxableAmount * taxRate;
  document.getElementById('total-taxes').value = totalTaxes.toFixed(2);

  // Calculate total price
  const totalPrice = sellingPrice + aftermarkets + fiProducts + priorLeaseBal + totalFees + totalTaxes;
  document.getElementById('total-price').value = totalPrice.toFixed(2);

  // Calculate net trade
  const totalNetTrade = totalTradeAll - totalTradePayoff;
  document.getElementById('total-net-trade').value = totalNetTrade.toFixed(2);

  // Calculate total down payment
  const totalDownPayment = cashDown + deposit + totalRebates + Math.max(0, totalNetTrade) + totalDefDown;
  document.getElementById('total-down-payment').value = totalDownPayment.toFixed(2);

  // Calculate trade difference (what customer owes after trade)
  const tradeDifference = totalPrice - totalDownPayment;
  document.getElementById('trade-difference').value = tradeDifference.toFixed(2);

  // Calculate amount financed
  let amountFinanced = totalPrice - totalDownPayment;
  // Add negative equity if trade payoff exceeds trade value
  if (totalNetTrade < 0) {
    amountFinanced += Math.abs(totalNetTrade);
  }
  amountFinanced = Math.max(0, amountFinanced);
  document.getElementById('amount-financed').value = amountFinanced.toFixed(2);

  // Calculate payment
  let monthlyPayment = 0;
  let financeCharge = 0;
  let totalOfPayments = 0;

  if (amountFinanced > 0 && term > 0) {
    if (sellRate > 0) {
      const monthlyRate = sellRate / 100 / 12;
      monthlyPayment = (amountFinanced * monthlyRate * Math.pow(1 + monthlyRate, term)) /
                       (Math.pow(1 + monthlyRate, term) - 1);
      totalOfPayments = monthlyPayment * term;
      financeCharge = totalOfPayments - amountFinanced + prepaidFinCharge;
    } else {
      // 0% APR
      monthlyPayment = amountFinanced / term;
      totalOfPayments = amountFinanced;
      financeCharge = prepaidFinCharge;
    }
  }

  // Update payment fields
  document.getElementById('apr-display').value = sellRate.toFixed(4);
  document.getElementById('finance-charge').value = financeCharge.toFixed(2);
  document.getElementById('total-of-payments').value = totalOfPayments.toFixed(2);
  document.getElementById('total-sales-price').value = (totalDownPayment + totalOfPayments).toFixed(2);
  document.getElementById('payment-display').value = monthlyPayment.toFixed(2);

  // Calculate AOR (dealer reserve) - simplified calculation
  // Typically 2% of amount financed spread over the term, varies by lender
  const aor = amountFinanced > 0 ? (amountFinanced * 0.02 * (term / 12)) : 0;
  document.getElementById('aor').value = aor.toFixed(2);

  // Calculate metrics
  const vehicleValue = sellingPrice > 0 ? sellingPrice : msrp;
  const ltv = vehicleValue > 0 ? (amountFinanced / vehicleValue) * 100 : 0;
  const pti = monthlyIncome > 0 ? (monthlyPayment / monthlyIncome) * 100 : 0;
  const dti = monthlyIncome > 0 ? ((monthlyDebt + monthlyPayment) / monthlyIncome) * 100 : 0;

  // Update metrics display
  updateMetricDisplay('ltv-display', ltv.toFixed(1) + '%', ltv);
  updateMetricDisplay('pti-display', pti.toFixed(1) + '%', pti);
  updateMetricDisplay('dti-display', dti.toFixed(1) + '%', dti);
  updateMetricDisplay('tier-display', getCreditTier(creditScore), creditScore);

  // Update first payment date based on days to first
  const dealDate = document.getElementById('deal-date')?.value;
  if (dealDate && daysToFirst) {
    const firstPaymentDate = new Date(dealDate);
    firstPaymentDate.setDate(firstPaymentDate.getDate() + daysToFirst);
    document.getElementById('first-payment-date').value = firstPaymentDate.toISOString().split('T')[0];
  }

  return {
    sellingPrice,
    totalPrice,
    amountFinanced,
    monthlyPayment,
    totalDownPayment,
    ltv,
    pti,
    dti,
    creditScore,
    term,
    sellRate
  };
}

function updateMetricDisplay(id, text, value) {
  const el = document.getElementById(id);
  if (!el) return;

  el.textContent = text;
  el.classList.remove('pass', 'warn', 'fail');

  // Color coding based on metric type and value
  if (id === 'ltv-display') {
    if (value <= 100) el.classList.add('pass');
    else if (value <= 120) el.classList.add('warn');
    else el.classList.add('fail');
  } else if (id === 'pti-display') {
    if (value <= 12) el.classList.add('pass');
    else if (value <= 15) el.classList.add('warn');
    else el.classList.add('fail');
  } else if (id === 'dti-display') {
    if (value <= 40) el.classList.add('pass');
    else if (value <= 50) el.classList.add('warn');
    else el.classList.add('fail');
  } else if (id === 'tier-display') {
    if (value >= 700) el.classList.add('pass');
    else if (value >= 620) el.classList.add('warn');
    else el.classList.add('fail');
  }
}

function getCreditTier(score) {
  if (score >= 750) return 'Super-Prime';
  if (score >= 700) return 'Prime';
  if (score >= 650) return 'Near-Prime';
  if (score >= 550) return 'Subprime';
  return 'Deep Subprime';
}

// ============================================================================
// LENDER ANALYSIS
// ============================================================================

document.getElementById('btn-analyze')?.addEventListener('click', async () => {
  // Get current worksheet values
  const worksheetData = calculateWorksheet();

  const vehicleYear = parseInt(document.getElementById('vehicle-year')?.value) || 2024;
  const vehicleMake = document.getElementById('vehicle-make')?.value || 'GMC';
  const vehicleModel = document.getElementById('vehicle-model')?.value || 'Terrain';
  const isCertified = document.getElementById('is-cert')?.checked || false;
  const isUsed = document.getElementById('is-used')?.checked || false;

  const params = {
    vehicleYear,
    vehicleMake,
    vehicleModel,
    vehicleMileage: isUsed ? 35000 : 0,
    vehicleCondition: 'good',
    certified: isCertified,
    sellingPrice: worksheetData.sellingPrice,
    tradeValue: parseFloat(document.getElementById('total-trade-all')?.value) || 0,
    tradePayoff: parseFloat(document.getElementById('total-trade-payoff')?.value) || 0,
    cashDown: parseFloat(document.getElementById('cash-down')?.value) || 0,
    rebates: parseFloat(document.getElementById('total-rebates')?.value) || 0,
    creditScore: worksheetData.creditScore,
    monthlyIncome: parseFloat(document.getElementById('monthly-income')?.value) || 5000,
    monthlyDebt: parseFloat(document.getElementById('monthly-debt')?.value) || 0,
    customerState: document.getElementById('customer-state')?.value || 'DE',
    requestedTerm: worksheetData.term,
  };

  try {
    const response = await fetch('/api/analyze-deal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const result = await response.json();

    if (result.success) {
      displayLenderAnalysis(result.data, worksheetData);
    } else {
      alert('Error: ' + result.error);
    }
  } catch (error) {
    console.error('Error analyzing deal:', error);
    alert('Error analyzing deal. Please try again.');
  }
});

function displayLenderAnalysis(data, worksheetData) {
  // Show results sections
  document.getElementById('lender-analysis').style.display = 'block';
  document.getElementById('payment-grid-section').style.display = 'block';

  // Calculate reserve for each lender
  const lenderTable = document.querySelector('#lender-table tbody');
  lenderTable.innerHTML = data.lenderRecommendations.map(rec => {
    // Calculate dealer reserve (spread between buy and sell rate)
    const buyRate = rec.apr;
    const maxMarkup = 2.5; // Typical max markup
    const sellRate = Math.min(buyRate + maxMarkup, buyRate * 1.3);

    // Calculate payment at sell rate
    const amountFinanced = data.deal.amountFinanced;
    const term = worksheetData.term;
    const monthlyRate = sellRate / 100 / 12;
    const sellPayment = (amountFinanced * monthlyRate * Math.pow(1 + monthlyRate, term)) /
                        (Math.pow(1 + monthlyRate, term) - 1);

    // Estimate reserve
    const reserve = (sellPayment - rec.monthlyPayment) * term * 0.7; // ~70% of spread goes to dealer

    return `
      <tr>
        <td><strong>${rec.lender}</strong><br><small>${rec.lenderType}</small></td>
        <td>${buyRate.toFixed(2)}%</td>
        <td>${sellRate.toFixed(2)}%</td>
        <td>$${sellPayment.toFixed(2)}</td>
        <td>$${reserve.toFixed(0)}</td>
        <td><span class="badge badge-${getConfidenceBadge(rec.confidence)}">${rec.confidence}</span></td>
        <td><button class="btn-select-lender" data-lender="${rec.lender}" data-buy-rate="${buyRate}" data-sell-rate="${sellRate}">Select</button></td>
      </tr>
    `;
  }).join('');

  // Add click handlers for select buttons
  document.querySelectorAll('.btn-select-lender').forEach(btn => {
    btn.addEventListener('click', () => {
      const lenderName = btn.dataset.lender;
      const sellRate = parseFloat(btn.dataset.sellRate);

      // Update the selected lender dropdown
      const lenderOptions = Array.from(document.getElementById('selected-lender').options);
      const matchingOption = lenderOptions.find(opt =>
        opt.textContent.toLowerCase().includes(lenderName.toLowerCase().split(' ')[0])
      );
      if (matchingOption) {
        document.getElementById('selected-lender').value = matchingOption.value;
      }

      // Update sell rate
      document.getElementById('sell-rate').value = sellRate.toFixed(2);

      // Recalculate
      calculateWorksheet();

      // Scroll to top of worksheet
      document.querySelector('.worksheet-header').scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Update payment grid
  const paymentGrid = document.querySelector('#payment-grid tbody');
  paymentGrid.innerHTML = data.paymentGrid.map(row => `
    <tr>
      <td><strong>${row.rate.toFixed(2)}%</strong></td>
      ${row.payments.map(p => `
        <td class="${getPTIClass(p.pti)}">
          <strong>$${p.payment.toFixed(0)}</strong><br>
          <small>${p.pti.toFixed(1)}% PTI</small>
        </td>
      `).join('')}
    </tr>
  `).join('');

  // Scroll to results
  document.getElementById('lender-analysis').scrollIntoView({ behavior: 'smooth' });
}

function getConfidenceBadge(confidence) {
  switch (confidence) {
    case 'high': return 'success';
    case 'medium': return 'warning';
    default: return 'danger';
  }
}

function getStatusBadge(status) {
  switch (status) {
    case 'auto-approved': return 'success';
    case 'conditional': return 'warning';
    case 'review-needed': return 'info';
    default: return 'danger';
  }
}

function formatStatus(status) {
  return status.replace(/-/g, ' ').toUpperCase();
}

function getPTIClass(pti) {
  if (pti <= 12) return 'pti-low';
  if (pti <= 15) return 'pti-medium';
  return 'pti-high';
}

// ============================================================================
// AUTO-APPROVAL OPTIMIZER
// ============================================================================

document.getElementById('run-optimizer')?.addEventListener('click', async () => {
  const params = {
    vehicleYear: parseInt(document.getElementById('ao-year').value),
    vehicleMake: document.getElementById('ao-make').value,
    vehicleModel: document.getElementById('ao-model').value,
    vehicleMileage: parseInt(document.getElementById('ao-mileage').value),
    vehicleCondition: 'good',
    certified: document.getElementById('ao-certified').checked,
    sellingPrice: parseFloat(document.getElementById('ao-selling-price').value),
    tradeValue: parseFloat(document.getElementById('ao-trade-value').value) || 0,
    tradePayoff: parseFloat(document.getElementById('ao-trade-payoff').value) || 0,
    cashDown: parseFloat(document.getElementById('ao-cash-down').value) || 0,
    fiProducts: parseFloat(document.getElementById('ao-fi-products').value) || 0,
    creditScore: parseInt(document.getElementById('ao-credit-score').value),
    monthlyIncome: parseFloat(document.getElementById('ao-monthly-income').value),
    monthlyDebt: parseFloat(document.getElementById('ao-monthly-debt').value) || 0,
    timeOnJob: parseInt(document.getElementById('ao-time-on-job').value) || 24,
    timeAtResidence: parseInt(document.getElementById('ao-time-at-residence').value) || 24,
    bankruptcyHistory: document.getElementById('ao-bankruptcy').checked,
    repoHistory: document.getElementById('ao-repo').checked,
    requestedTerm: parseInt(document.getElementById('ao-term').value),
  };

  try {
    const response = await fetch('/api/optimize-approval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const result = await response.json();

    if (result.success) {
      displayOptimizerResults(result.data);
    } else {
      alert('Error: ' + result.error);
    }
  } catch (error) {
    console.error('Error running optimizer:', error);
    alert('Error running optimizer. Please try again.');
  }
});

function displayOptimizerResults(data) {
  // Show results
  document.getElementById('optimizer-results').style.display = 'block';

  // FICO Auto Score
  document.getElementById('fico-base').textContent = data.ficoAutoScore.baseScore;
  document.getElementById('fico-auto').textContent = data.ficoAutoScore.autoScore;
  document.getElementById('risk-tier').textContent = data.ficoAutoScore.riskTier;

  // FICO Factors
  const factorsHtml = data.ficoAutoScore.factors.map(f => `
    <div class="fico-factor ${f.impact}">
      <span>${f.impact === 'positive' ? '✓' : f.impact === 'negative' ? '✗' : '○'}</span>
      <span>${f.factor}: ${f.description}</span>
    </div>
  `).join('');
  document.getElementById('fico-factors').innerHTML = factorsHtml;

  // Current Metrics
  const metrics = data.currentMetrics;
  updateOptimizerMetricCard('metric-ltv', metrics.currentLTV.toFixed(1) + '%', getLTVStatus(metrics.currentLTV));
  updateOptimizerMetricCard('metric-pti', metrics.currentPTI.toFixed(1) + '%', getPTIOptimizerStatus(metrics.currentPTI));
  updateOptimizerMetricCard('metric-dti', metrics.currentDTI.toFixed(1) + '%', getDTIStatus(metrics.currentDTI));
  updateOptimizerMetricCard('metric-payment', '$' + metrics.currentPayment.toFixed(0), '');

  // ADE Results
  const adeTable = document.querySelector('#ade-table tbody');
  adeTable.innerHTML = data.adeResults.map(r => `
    <tr>
      <td><strong>${r.lender}</strong></td>
      <td><span class="badge badge-${getDecisionBadge(r.decision)}">${formatDecision(r.decision)}</span></td>
      <td>${r.decisionTime}</td>
      <td>${r.rate ? r.rate.toFixed(2) + '%' : '-'}</td>
      <td>${r.score}</td>
    </tr>
  `).join('');

  // Auto-Approval Thresholds
  const thresholdsTable = document.querySelector('#thresholds-table tbody');
  thresholdsTable.innerHTML = data.autoApprovalThresholds.map(t => `
    <tr>
      <td><strong>${t.lenderName}</strong></td>
      <td>≤${t.thresholds.maxLTV}%</td>
      <td>≤${t.thresholds.maxPTI}%</td>
      <td>≤${t.thresholds.maxDTI}%</td>
      <td>${t.thresholds.minDownPercent > 0 ? t.thresholds.minDownPercent + '%+' : 'None'}</td>
    </tr>
  `).join('');

  // Recommendations
  const recsHtml = data.recommendations.map(r => `
    <div class="recommendation-item ${r.priority}">
      <div class="recommendation-title">
        <span class="priority">${r.priority}</span>
        ${r.title}
      </div>
      <p class="recommendation-description">${r.description}</p>
      <div class="recommendation-values">
        <span>Current: <strong>${r.currentValue}</strong></span>
        <span>Target: <strong>${r.targetValue}</strong></span>
      </div>
      <p style="margin-top: 0.5rem; color: var(--primary-color); font-weight: 500;">
        Action: ${r.impact}
      </p>
    </div>
  `).join('');
  document.getElementById('recommendations-list').innerHTML = recsHtml || '<p>Deal is already optimized!</p>';

  // Sweet Spot
  if (data.sweetSpot.achievable && data.sweetSpot.structure) {
    const ss = data.sweetSpot;
    document.getElementById('sweet-spot-content').innerHTML = `
      <p style="margin-bottom: 1rem;"><strong>Target Lender:</strong> ${ss.targetLender} | <strong>Probability:</strong> ${ss.approvalProbability}%</p>
      <div class="sweet-spot-content">
        <div class="sweet-spot-item">
          <span class="sweet-spot-label">Down Payment</span>
          <span class="sweet-spot-value">$${ss.structure.downPayment.toLocaleString()}</span>
          ${ss.comparison.downPaymentDiff > 0 ? `<span class="sweet-spot-diff">+$${ss.comparison.downPaymentDiff.toLocaleString()}</span>` : ''}
        </div>
        <div class="sweet-spot-item">
          <span class="sweet-spot-label">Term</span>
          <span class="sweet-spot-value">${ss.structure.term} months</span>
          ${ss.comparison.termDiff !== 0 ? `<span class="sweet-spot-diff">${ss.comparison.termDiff > 0 ? '+' : ''}${ss.comparison.termDiff}mo</span>` : ''}
        </div>
        <div class="sweet-spot-item">
          <span class="sweet-spot-label">Monthly Payment</span>
          <span class="sweet-spot-value">$${ss.structure.monthlyPayment.toFixed(2)}</span>
        </div>
        <div class="sweet-spot-item">
          <span class="sweet-spot-label">APR</span>
          <span class="sweet-spot-value">${ss.structure.apr.toFixed(2)}%</span>
        </div>
      </div>
      <p style="margin-top: 1rem; color: var(--gray-600);">
        LTV: ${ss.metrics.ltv}% (target: ≤${ss.metrics.targetLTV}%) |
        PTI: ${ss.metrics.pti}% (target: ≤${ss.metrics.targetPTI}%)
      </p>
    `;
  } else {
    document.getElementById('sweet-spot-content').innerHTML = '<p>Unable to find achievable structure with current parameters.</p>';
  }

  // Approval Probability
  const prob = data.approvalProbability;
  document.getElementById('prob-current').style.width = prob.currentAsStructured + '%';
  document.getElementById('prob-current-value').textContent = prob.currentAsStructured + '%';
  document.getElementById('prob-optimized').style.width = prob.ifOptimized + '%';
  document.getElementById('prob-optimized-value').textContent = prob.ifOptimized + '%';
  document.getElementById('prob-recommendation').textContent = prob.recommendation;

  // Scroll to results
  document.getElementById('optimizer-results').scrollIntoView({ behavior: 'smooth' });
}

function updateOptimizerMetricCard(id, value, status) {
  const card = document.getElementById(id);
  card.querySelector('.metric-value').textContent = value;
  card.querySelector('.metric-status').textContent = status;

  card.classList.remove('pass', 'warn', 'fail');
  if (status.includes('EXCELLENT') || status.includes('GOOD')) {
    card.classList.add('pass');
  } else if (status.includes('MARGINAL') || status.includes('WARNING')) {
    card.classList.add('warn');
  } else if (status.includes('HIGH') || status.includes('FAIL')) {
    card.classList.add('fail');
  }
}

function getLTVStatus(ltv) {
  if (ltv <= 100) return 'EXCELLENT';
  if (ltv <= 115) return 'GOOD';
  if (ltv <= 125) return 'MARGINAL';
  return 'HIGH RISK';
}

function getPTIOptimizerStatus(pti) {
  if (pti <= 12) return 'EXCELLENT';
  if (pti <= 15) return 'GOOD';
  if (pti <= 18) return 'MARGINAL';
  return 'HIGH';
}

function getDTIStatus(dti) {
  if (dti <= 35) return 'EXCELLENT';
  if (dti <= 45) return 'GOOD';
  if (dti <= 50) return 'MARGINAL';
  return 'HIGH';
}

function getDecisionBadge(decision) {
  switch (decision) {
    case 'AUTO_APPROVED': return 'success';
    case 'CONDITIONAL': return 'warning';
    case 'PENDING_REVIEW': return 'info';
    default: return 'danger';
  }
}

function formatDecision(decision) {
  return decision.replace(/_/g, ' ');
}

// ============================================================================
// LENDERS
// ============================================================================

async function loadLenders(tier = '') {
  try {
    const url = tier ? `/api/lenders?tier=${tier}` : '/api/lenders';
    const response = await fetch(url);
    const result = await response.json();

    if (result.success) {
      displayLenders(result.data);
    }
  } catch (error) {
    console.error('Error loading lenders:', error);
  }
}

function displayLenders(lenders) {
  const container = document.getElementById('lenders-list');
  container.innerHTML = lenders.map(lender => `
    <div class="lender-card">
      <div class="lender-header">
        <span class="lender-name">${lender.name}</span>
        <span class="lender-type">${lender.type}</span>
      </div>
      <div class="lender-tiers">
        ${lender.creditTiers.map(t => `
          <div class="tier-badge">
            <span class="tier-name">${t.tier.toUpperCase()}</span>
            <span class="tier-details">
              Score: ${t.minScore}${t.maxScore ? '-' + t.maxScore : '+'} |
              Rate: ${t.baseRate}% |
              Max LTV: ${t.maxLTV}% |
              Max Term: ${t.maxTerm}mo
            </span>
          </div>
        `).join('')}
      </div>
      <p style="margin-top: 1rem; font-size: 0.875rem; color: var(--gray-600);">
        Vehicle Limits: Max Age ${lender.vehicleRestrictions.maxAge}yr | Max Miles ${lender.vehicleRestrictions.maxMileage.toLocaleString()}
      </p>
    </div>
  `).join('');
}

document.getElementById('tier-filter')?.addEventListener('change', (e) => {
  loadLenders(e.target.value);
});

// ============================================================================
// QUICK CALCULATOR
// ============================================================================

document.getElementById('calculate-payment')?.addEventListener('click', async () => {
  const amount = parseFloat(document.getElementById('calc-amount').value);
  const rate = parseFloat(document.getElementById('calc-rate').value);
  const term = parseInt(document.getElementById('calc-term').value);

  try {
    const response = await fetch('/api/calculate-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, rate, term }),
    });

    const result = await response.json();

    if (result.success) {
      document.getElementById('calc-monthly').textContent = '$' + result.data.monthlyPayment.toFixed(2);
      document.getElementById('calc-interest').textContent = '$' + result.data.totalInterest.toFixed(2);
      document.getElementById('calc-total').textContent = '$' + result.data.totalOfPayments.toFixed(2);
      document.getElementById('calc-result').style.display = 'block';
    }
  } catch (error) {
    console.error('Error calculating payment:', error);
  }
});

// Initialize lenders on first load if on that tab
if (document.querySelector('.tab[data-tab="lenders"]')?.classList.contains('active')) {
  loadLenders();
}

// Run initial calculation on page load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    calculateWorksheet();
    loadInventoryForSelector(); // Load inventory into vehicle selector
    initPaymentTools(); // Initialize payment tools
  }, 100);
});

// ============================================================================
// PAYMENT TOOLS - Target Calculator, Comparison, Customer Menu
// ============================================================================

function initPaymentTools() {
  // Tool panel toggle
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active button
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Show corresponding panel
      const toolId = btn.dataset.tool;
      document.querySelectorAll('.tool-panel').forEach(panel => panel.classList.remove('active'));
      document.getElementById(toolId)?.classList.add('active');
    });
  });

  // Add scenario card click handler
  document.getElementById('add-scenario-card')?.addEventListener('click', addNewScenario);
}

// ============================================================================
// TARGET PAYMENT CALCULATOR
// ============================================================================

document.getElementById('btn-calc-target')?.addEventListener('click', calculateTargetPayment);

// Also calculate on input changes
['target-payment', 'target-apr', 'target-term', 'target-down'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', calculateTargetPayment);
});

function calculateTargetPayment() {
  const targetPayment = parseFloat(document.getElementById('target-payment')?.value) || 0;
  const apr = parseFloat(document.getElementById('target-apr')?.value) || 0;
  const term = parseInt(document.getElementById('target-term')?.value) || 72;
  const downPayment = parseFloat(document.getElementById('target-down')?.value) || 0;

  if (targetPayment <= 0) return;

  // Calculate maximum amount financed from target payment
  // Payment = P * (r * (1+r)^n) / ((1+r)^n - 1)
  // Solve for P: P = Payment * ((1+r)^n - 1) / (r * (1+r)^n)

  let maxAmountFinanced;
  if (apr > 0) {
    const monthlyRate = apr / 100 / 12;
    const factor = Math.pow(1 + monthlyRate, term);
    maxAmountFinanced = targetPayment * (factor - 1) / (monthlyRate * factor);
  } else {
    // 0% APR
    maxAmountFinanced = targetPayment * term;
  }

  // Calculate max selling price (amount financed + down - fees - tax estimate)
  const state = document.getElementById('customer-state')?.value || 'DE';
  const taxRate = STATE_TAX_RATES[state] || 0.0525;
  const estimatedFees = 600; // Standard doc + fees estimate

  // Reverse calculate: sellingPrice * (1 + taxRate) + fees - down = amountFinanced
  // sellingPrice = (amountFinanced + down - fees) / (1 + taxRate)
  const maxSellingPrice = (maxAmountFinanced + downPayment - estimatedFees) / (1 + taxRate);

  const totalOfPayments = targetPayment * term;
  const totalInterest = totalOfPayments - maxAmountFinanced;

  // Update display
  document.getElementById('target-max-price').textContent = '$' + Math.max(0, maxSellingPrice).toLocaleString(undefined, {maximumFractionDigits: 0});
  document.getElementById('target-amount-financed').textContent = '$' + maxAmountFinanced.toLocaleString(undefined, {maximumFractionDigits: 0});
  document.getElementById('target-total-payments').textContent = '$' + totalOfPayments.toLocaleString(undefined, {maximumFractionDigits: 0});
  document.getElementById('target-total-interest').textContent = '$' + Math.max(0, totalInterest).toLocaleString(undefined, {maximumFractionDigits: 0});
  document.getElementById('alt-payment').textContent = targetPayment;

  // Generate alternatives
  const alternativesEl = document.getElementById('target-alternatives');
  if (alternativesEl) {
    const alternatives = [];

    // Alternative 1: Extend term
    if (term < 84) {
      const newTerm = term === 48 ? 60 : term === 60 ? 72 : 84;
      let newAmount;
      if (apr > 0) {
        const monthlyRate = apr / 100 / 12;
        const factor = Math.pow(1 + monthlyRate, newTerm);
        newAmount = targetPayment * (factor - 1) / (monthlyRate * factor);
      } else {
        newAmount = targetPayment * newTerm;
      }
      const newPrice = (newAmount + downPayment - estimatedFees) / (1 + taxRate);
      alternatives.push({
        action: `Extend to ${newTerm} months`,
        value: `Max $${Math.max(0, newPrice).toLocaleString(undefined, {maximumFractionDigits: 0})}`
      });
    }

    // Alternative 2: Lower rate
    if (apr > 3) {
      const lowerRate = Math.max(apr - 2, 0);
      let newAmount;
      if (lowerRate > 0) {
        const monthlyRate = lowerRate / 100 / 12;
        const factor = Math.pow(1 + monthlyRate, term);
        newAmount = targetPayment * (factor - 1) / (monthlyRate * factor);
      } else {
        newAmount = targetPayment * term;
      }
      const newPrice = (newAmount + downPayment - estimatedFees) / (1 + taxRate);
      alternatives.push({
        action: `Get ${lowerRate.toFixed(2)}% APR`,
        value: `Max $${Math.max(0, newPrice).toLocaleString(undefined, {maximumFractionDigits: 0})}`
      });
    }

    // Alternative 3: More down payment
    const extraDown = 2000;
    const newPrice = (maxAmountFinanced + downPayment + extraDown - estimatedFees) / (1 + taxRate);
    alternatives.push({
      action: `Add $${extraDown.toLocaleString()} down`,
      value: `Max $${Math.max(0, newPrice).toLocaleString(undefined, {maximumFractionDigits: 0})}`
    });

    alternativesEl.innerHTML = alternatives.map(alt => `
      <div class="alt-option">
        <span class="alt-action">${alt.action}</span>
        <span class="alt-value">${alt.value}</span>
      </div>
    `).join('');
  }
}

// ============================================================================
// MULTI-PAYMENT COMPARISON
// ============================================================================

let comparisonScenarios = [];
let scenarioIdCounter = 0;

document.getElementById('btn-add-scenario')?.addEventListener('click', addNewScenario);
document.getElementById('btn-use-current')?.addEventListener('click', addCurrentDealAsScenario);
document.getElementById('btn-clear-scenarios')?.addEventListener('click', clearAllScenarios);

function addNewScenario() {
  if (comparisonScenarios.length >= 4) {
    alert('Maximum 4 scenarios allowed');
    return;
  }

  const id = ++scenarioIdCounter;
  const scenario = {
    id,
    name: `Scenario ${comparisonScenarios.length + 1}`,
    price: 35000,
    down: 2000,
    rate: 7.99,
    term: 72
  };

  comparisonScenarios.push(scenario);
  renderScenarios();
}

function addCurrentDealAsScenario() {
  if (comparisonScenarios.length >= 4) {
    alert('Maximum 4 scenarios allowed');
    return;
  }

  const worksheetData = calculateWorksheet();
  const id = ++scenarioIdCounter;

  const scenario = {
    id,
    name: 'Current Deal',
    price: worksheetData.sellingPrice || 0,
    down: worksheetData.totalDownPayment || 0,
    rate: worksheetData.sellRate || 0,
    term: worksheetData.term || 72
  };

  comparisonScenarios.push(scenario);
  renderScenarios();
}

function clearAllScenarios() {
  comparisonScenarios = [];
  renderScenarios();
}

function removeScenario(id) {
  comparisonScenarios = comparisonScenarios.filter(s => s.id !== id);
  renderScenarios();
}

function updateScenario(id, field, value) {
  const scenario = comparisonScenarios.find(s => s.id === id);
  if (scenario) {
    scenario[field] = parseFloat(value) || 0;
    renderScenarios();
  }
}

function renderScenarios() {
  const grid = document.getElementById('comparison-grid');
  if (!grid) return;

  // Calculate payments for all scenarios
  const state = document.getElementById('customer-state')?.value || 'DE';
  const taxRate = STATE_TAX_RATES[state] || 0.0525;
  const fees = 600;

  comparisonScenarios.forEach(scenario => {
    const taxableAmount = scenario.price;
    const tax = taxableAmount * taxRate;
    const amountFinanced = scenario.price + tax + fees - scenario.down;

    if (scenario.rate > 0) {
      const monthlyRate = scenario.rate / 100 / 12;
      scenario.payment = (amountFinanced * monthlyRate * Math.pow(1 + monthlyRate, scenario.term)) /
                         (Math.pow(1 + monthlyRate, scenario.term) - 1);
    } else {
      scenario.payment = amountFinanced / scenario.term;
    }

    scenario.amountFinanced = amountFinanced;
    scenario.totalOfPayments = scenario.payment * scenario.term;
    scenario.totalInterest = scenario.totalOfPayments - amountFinanced;
  });

  // Find best (lowest payment)
  let bestId = null;
  let lowestPayment = Infinity;
  comparisonScenarios.forEach(s => {
    if (s.payment < lowestPayment) {
      lowestPayment = s.payment;
      bestId = s.id;
    }
  });

  // Render cards
  let html = comparisonScenarios.map(scenario => `
    <div class="scenario-card" data-id="${scenario.id}">
      <button class="btn-remove-scenario" onclick="removeScenario(${scenario.id})">×</button>
      <div class="scenario-header">
        <input type="text" class="scenario-name" value="${scenario.name}"
               onchange="updateScenarioName(${scenario.id}, this.value)">
        ${scenario.id === bestId ? '<span class="scenario-badge best">BEST</span>' : ''}
      </div>
      <div class="scenario-fields">
        <div class="scenario-field">
          <label>Selling Price</label>
          <input type="number" value="${scenario.price}"
                 onchange="updateScenario(${scenario.id}, 'price', this.value)">
        </div>
        <div class="scenario-field">
          <label>Down Payment</label>
          <input type="number" value="${scenario.down}"
                 onchange="updateScenario(${scenario.id}, 'down', this.value)">
        </div>
        <div class="scenario-field">
          <label>APR (%)</label>
          <input type="number" value="${scenario.rate}" step="0.25"
                 onchange="updateScenario(${scenario.id}, 'rate', this.value)">
        </div>
        <div class="scenario-field">
          <label>Term (months)</label>
          <select onchange="updateScenario(${scenario.id}, 'term', this.value)">
            <option value="48" ${scenario.term === 48 ? 'selected' : ''}>48</option>
            <option value="60" ${scenario.term === 60 ? 'selected' : ''}>60</option>
            <option value="72" ${scenario.term === 72 ? 'selected' : ''}>72</option>
            <option value="84" ${scenario.term === 84 ? 'selected' : ''}>84</option>
          </select>
        </div>
      </div>
      <div class="scenario-result">
        <div class="scenario-payment">$${scenario.payment.toFixed(0)}<small>/mo</small></div>
        <div class="scenario-details">
          <div class="scenario-detail">
            <span>Financed:</span>
            <span>$${scenario.amountFinanced.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
          </div>
          <div class="scenario-detail">
            <span>Interest:</span>
            <span>$${scenario.totalInterest.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  // Add the "add card" at the end if less than 4 scenarios
  if (comparisonScenarios.length < 4) {
    html += `
      <div class="scenario-card add-card" id="add-scenario-card" onclick="addNewScenario()">
        <div class="add-icon">+</div>
        <span>Add Scenario</span>
      </div>
    `;
  }

  grid.innerHTML = html;

  // Update comparison summary
  updateComparisonSummary();
}

function updateScenarioName(id, name) {
  const scenario = comparisonScenarios.find(s => s.id === id);
  if (scenario) {
    scenario.name = name;
  }
}

function updateComparisonSummary() {
  const summary = document.getElementById('comparison-summary');
  const tbody = document.getElementById('comparison-tbody');

  if (comparisonScenarios.length < 2) {
    summary.style.display = 'none';
    return;
  }

  summary.style.display = 'block';

  // Update headers
  for (let i = 1; i <= 4; i++) {
    const header = document.getElementById(`comp-header-${i}`);
    if (header) {
      if (comparisonScenarios[i-1]) {
        header.textContent = comparisonScenarios[i-1].name;
        header.style.display = '';
      } else {
        header.style.display = 'none';
      }
    }
  }

  // Find best values
  const metrics = ['payment', 'amountFinanced', 'totalInterest', 'totalOfPayments'];
  const bestValues = {};
  metrics.forEach(m => {
    bestValues[m] = Math.min(...comparisonScenarios.map(s => s[m]));
  });

  // Generate rows
  const rows = [
    { label: 'Monthly Payment', key: 'payment', format: v => '$' + v.toFixed(0) },
    { label: 'Amount Financed', key: 'amountFinanced', format: v => '$' + v.toLocaleString(undefined, {maximumFractionDigits: 0}) },
    { label: 'Total Interest', key: 'totalInterest', format: v => '$' + v.toLocaleString(undefined, {maximumFractionDigits: 0}) },
    { label: 'Total of Payments', key: 'totalOfPayments', format: v => '$' + v.toLocaleString(undefined, {maximumFractionDigits: 0}) }
  ];

  tbody.innerHTML = rows.map(row => {
    let html = `<tr><td><strong>${row.label}</strong></td>`;
    for (let i = 0; i < 4; i++) {
      if (comparisonScenarios[i]) {
        const value = comparisonScenarios[i][row.key];
        const isBest = value === bestValues[row.key];
        html += `<td class="${isBest ? 'highlight' : ''}">${row.format(value)}</td>`;
      } else {
        html += '<td style="display:none;"></td>';
      }
    }
    html += '</tr>';
    return html;
  }).join('');
}

// ============================================================================
// CUSTOMER PAYMENT MENU
// ============================================================================

document.getElementById('btn-generate-menu')?.addEventListener('click', generatePaymentMenu);
document.getElementById('btn-print-menu')?.addEventListener('click', printPaymentMenu);
document.getElementById('btn-fullscreen-menu')?.addEventListener('click', toggleFullscreenMenu);

function generatePaymentMenu() {
  const worksheetData = calculateWorksheet();
  const amountFinanced = worksheetData.amountFinanced || 0;
  const sellingPrice = worksheetData.sellingPrice || 0;
  const rate = worksheetData.sellRate || 7.99;

  // Get vehicle info
  const year = document.getElementById('vehicle-year')?.value || '';
  const make = document.getElementById('vehicle-make')?.value || '';
  const model = document.getElementById('vehicle-model')?.value || '';
  const vehicleDesc = `${year} ${make} ${model}`.trim() || 'Vehicle';

  // Update header
  document.getElementById('menu-vehicle').textContent = vehicleDesc;
  document.getElementById('menu-selling-price').textContent = '$' + sellingPrice.toLocaleString(undefined, {maximumFractionDigits: 0});

  // Generate payment options for different terms
  const terms = [48, 60, 72, 84];
  const options = terms.map(term => {
    let payment;
    if (rate > 0) {
      const monthlyRate = rate / 100 / 12;
      payment = (amountFinanced * monthlyRate * Math.pow(1 + monthlyRate, term)) /
                (Math.pow(1 + monthlyRate, term) - 1);
    } else {
      payment = amountFinanced / term;
    }

    const totalOfPayments = payment * term;

    return {
      term,
      payment,
      rate,
      totalOfPayments,
      isRecommended: term === 72 // 72 months is usually the sweet spot
    };
  });

  // Render options
  const optionsEl = document.getElementById('menu-options');
  if (optionsEl) {
    optionsEl.innerHTML = options.map(opt => `
      <div class="menu-option-card ${opt.isRecommended ? 'recommended' : ''}">
        <div class="menu-term">${opt.term} Months</div>
        <div class="menu-payment">$${opt.payment.toFixed(0)}</div>
        <div class="menu-payment-label">per month</div>
        <div class="menu-apr">${opt.rate.toFixed(2)}% APR</div>
        <div class="menu-total">Total: $${opt.totalOfPayments.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
      </div>
    `).join('');
  }
}

function printPaymentMenu() {
  const menuDisplay = document.getElementById('payment-menu-display');
  if (!menuDisplay) return;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Payment Options</title>
        <style>
          body {
            font-family: 'Inter', Arial, sans-serif;
            background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
            color: white;
            padding: 2rem;
            min-height: 100vh;
          }
          .menu-header { text-align: center; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.2); }
          .menu-header h2 { font-size: 1.5rem; font-weight: 300; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 0.5rem; }
          .menu-vehicle { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
          .menu-price { font-size: 1rem; opacity: 0.8; }
          .menu-options { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; margin-bottom: 2rem; }
          .menu-option-card { background: rgba(255,255,255,0.1); border-radius: 8px; padding: 1.5rem; text-align: center; border: 2px solid transparent; }
          .menu-option-card.recommended { border-color: #22c55e; background: rgba(34, 197, 94, 0.2); }
          .menu-option-card.recommended::before { content: 'RECOMMENDED'; display: block; font-size: 0.625rem; letter-spacing: 1px; color: #22c55e; margin-bottom: 0.5rem; }
          .menu-term { font-size: 0.875rem; opacity: 0.8; margin-bottom: 0.5rem; }
          .menu-payment { font-size: 2.5rem; font-weight: 700; margin-bottom: 0.25rem; }
          .menu-payment-label { font-size: 0.75rem; opacity: 0.7; }
          .menu-apr { font-size: 0.875rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.2); }
          .menu-total { font-size: 0.75rem; opacity: 0.7; margin-top: 0.5rem; }
          .menu-footer { text-align: center; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.2); font-size: 0.75rem; opacity: 0.7; }
          .menu-dealer { margin-top: 1rem; font-size: 0.875rem; font-weight: 600; letter-spacing: 1px; opacity: 1; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        ${menuDisplay.innerHTML}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

function toggleFullscreenMenu() {
  const existingFullscreen = document.querySelector('.payment-menu-fullscreen');

  if (existingFullscreen) {
    existingFullscreen.remove();
    return;
  }

  // Generate menu first if not already
  generatePaymentMenu();

  const menuDisplay = document.getElementById('payment-menu-display');
  if (!menuDisplay) return;

  // Create fullscreen overlay
  const fullscreen = document.createElement('div');
  fullscreen.className = 'payment-menu-fullscreen';
  fullscreen.innerHTML = `
    <button class="btn-close-fullscreen" onclick="toggleFullscreenMenu()">×</button>
    ${menuDisplay.innerHTML}
  `;

  document.body.appendChild(fullscreen);

  // Close on escape key
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      fullscreen.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// ============================================================================
// INVENTORY MANAGEMENT (Client-Side with localStorage)
// ============================================================================

let currentInventory = [];
const INVENTORY_STORAGE_KEY = 'dealOptimizer_inventory';

// Load inventory from localStorage on init
function initInventory() {
  try {
    const stored = localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (stored) {
      currentInventory = JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error loading inventory from localStorage:', e);
    currentInventory = [];
  }
}

// Save inventory to localStorage
function saveInventory() {
  try {
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(currentInventory));
  } catch (e) {
    console.error('Error saving inventory to localStorage:', e);
  }
}

// Parse CSV data in the browser
function parseCSV(csvData) {
  const lines = csvData.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row');
  }

  // Detect delimiter
  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes('\t') && !firstLine.includes(',')) delimiter = '\t';
  else if (firstLine.includes('|') && !firstLine.includes(',')) delimiter = '|';
  else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';

  // Parse header
  const headers = parseCSVLine(firstLine, delimiter).map(h => h.toLowerCase().trim());

  // Map column names to our field names
  const fieldMap = {
    'stock #': 'stockNumber', 'stock#': 'stockNumber', 'stock': 'stockNumber', 'stk': 'stockNumber', 'stk#': 'stockNumber', 'stk #': 'stockNumber', 'stocknumber': 'stockNumber', 'stock_number': 'stockNumber', 'stock number': 'stockNumber',
    'year': 'year', 'yr': 'year', 'model year': 'year', 'modelyear': 'year', 'model_year': 'year',
    'make': 'make', 'mfg': 'make', 'manufacturer': 'make', 'brand': 'make',
    'model': 'model', 'mdl': 'model',
    'trim': 'trim', 'trimlevel': 'trim', 'trim_level': 'trim', 'trim level': 'trim', 'series': 'trim', 'style': 'trim',
    'vin': 'vin', 'vin#': 'vin', 'vin #': 'vin', 'vehicle vin': 'vin',
    'msrp': 'msrp', 'sticker': 'msrp', 'sticker price': 'msrp', 'list price': 'msrp', 'list': 'msrp',
    'price': 'sellingPrice', 'selling price': 'sellingPrice', 'sellingprice': 'sellingPrice', 'selling_price': 'sellingPrice', 'sale price': 'sellingPrice', 'internet price': 'sellingPrice', 'asking': 'sellingPrice', 'asking price': 'sellingPrice',
    'mileage': 'mileage', 'miles': 'mileage', 'odometer': 'mileage', 'odo': 'mileage',
    'color': 'exteriorColor', 'ext color': 'exteriorColor', 'exterior': 'exteriorColor', 'exterior color': 'exteriorColor', 'extcolor': 'exteriorColor',
    'interior': 'interiorColor', 'int color': 'interiorColor', 'interior color': 'interiorColor', 'intcolor': 'interiorColor',
    'condition': 'condition', 'status': 'condition', 'type': 'condition', 'new/used': 'condition', 'new / used': 'condition',
    'certified': 'certified', 'cpo': 'certified', 'cert': 'certified',
    'days': 'daysInStock', 'days in stock': 'daysInStock', 'daysinstock': 'daysInStock', 'days_in_stock': 'daysInStock', 'age': 'daysInStock', 'lot days': 'daysInStock',
  };

  // Find column indices
  const columnMap = {};
  headers.forEach((header, idx) => {
    const normalizedHeader = header.replace(/[^a-z0-9\s#\/]/gi, '').trim();
    if (fieldMap[normalizedHeader]) {
      columnMap[fieldMap[normalizedHeader]] = idx;
    } else if (fieldMap[header]) {
      columnMap[fieldMap[header]] = idx;
    }
  });

  // Parse data rows
  const vehicles = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line, delimiter);
    if (values.length === 0) continue;

    // Get values from mapped columns
    const getValue = (field) => {
      const idx = columnMap[field];
      if (idx !== undefined && idx < values.length) {
        return values[idx]?.trim() || '';
      }
      return '';
    };

    const stockNumber = getValue('stockNumber') || values[0]?.trim() || '';
    if (!stockNumber) continue;

    // Parse year - look in mapped column or find 4-digit year in first 5 columns
    let year = parseInt(getValue('year')) || 0;
    if (!year || year < 1990 || year > 2030) {
      for (let j = 0; j < Math.min(5, values.length); j++) {
        const val = values[j]?.trim();
        if (/^(19|20)\d{2}$/.test(val)) {
          year = parseInt(val);
          break;
        }
      }
    }

    const make = getValue('make') || '';
    const model = getValue('model') || '';

    // Parse numeric values
    const parseNumber = (val) => {
      if (!val) return 0;
      const num = parseFloat(val.toString().replace(/[$,\s]/g, ''));
      return isNaN(num) ? 0 : num;
    };

    const msrp = parseNumber(getValue('msrp'));
    const sellingPrice = parseNumber(getValue('sellingPrice')) || msrp;
    const mileage = parseInt(getValue('mileage')?.replace(/,/g, '')) || 0;

    // Determine condition
    let condition = getValue('condition').toLowerCase();
    const isCertified = getValue('certified').toLowerCase();

    if (condition.includes('new') || mileage === 0 || mileage < 100) {
      condition = 'new';
    } else if (condition.includes('cert') || isCertified === 'yes' || isCertified === 'true' || isCertified === '1' || isCertified === 'y') {
      condition = 'certified';
    } else {
      condition = 'used';
    }

    // For new vehicles with very low miles, still mark as new
    if (mileage > 0 && mileage < 500 && year >= new Date().getFullYear()) {
      condition = 'new';
    }

    vehicles.push({
      stockNumber,
      year,
      make,
      model,
      trim: getValue('trim'),
      vin: getValue('vin'),
      msrp: msrp || sellingPrice,
      sellingPrice: sellingPrice || msrp,
      mileage,
      condition,
      exteriorColor: getValue('exteriorColor'),
      interiorColor: getValue('interiorColor'),
      daysInStock: parseInt(getValue('daysInStock')) || 0,
    });
  }

  return vehicles;
}

// Parse a single CSV line, handling quoted values
function parseCSVLine(line, delimiter = ',') {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);

  return values;
}

// Initialize inventory on load
initInventory();

// File upload button
document.getElementById('btn-choose-file')?.addEventListener('click', () => {
  document.getElementById('csv-file')?.click();
});

// Handle file selection
document.getElementById('csv-file')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      document.getElementById('csv-input').value = event.target.result;
    };
    reader.readAsText(file);
  }
});

// Upload inventory (client-side processing)
document.getElementById('btn-upload-inventory')?.addEventListener('click', () => {
  const csvData = document.getElementById('csv-input')?.value;
  const clearExisting = document.getElementById('clear-existing')?.checked;

  if (!csvData || csvData.trim().length === 0) {
    showUploadResult('Please paste CSV data or upload a file first.', 'error');
    return;
  }

  try {
    // Parse CSV in browser
    const vehicles = parseCSV(csvData);

    if (vehicles.length === 0) {
      showUploadResult('No valid vehicles found in the CSV data.', 'error');
      return;
    }

    // Clear existing if requested
    if (clearExisting) {
      currentInventory = [];
    }

    // Import vehicles (update existing or add new)
    let imported = 0;
    let updated = 0;

    vehicles.forEach(vehicle => {
      const existingIdx = currentInventory.findIndex(v => v.stockNumber === vehicle.stockNumber);
      if (existingIdx >= 0) {
        currentInventory[existingIdx] = vehicle;
        updated++;
      } else {
        currentInventory.push(vehicle);
        imported++;
      }
    });

    // Save to localStorage
    saveInventory();

    // Calculate stats
    const stats = getInventoryStats();

    showUploadResult(
      `Successfully imported ${imported} vehicles, updated ${updated}. ` +
      `Total inventory: ${stats.total} (${stats.new} new, ${stats.used} used, ${stats.certified} certified)`,
      'success'
    );

    displayInventory(currentInventory);
    updateInventoryStats(stats);
    loadInventoryForSelector();

  } catch (error) {
    console.error('Error parsing CSV:', error);
    showUploadResult('Error parsing CSV: ' + error.message, 'error');
  }
});

// Get inventory statistics
function getInventoryStats() {
  return {
    total: currentInventory.length,
    new: currentInventory.filter(v => v.condition === 'new').length,
    used: currentInventory.filter(v => v.condition === 'used').length,
    certified: currentInventory.filter(v => v.condition === 'certified').length,
  };
}

function showUploadResult(message, type) {
  const resultEl = document.getElementById('upload-result');
  if (resultEl) {
    resultEl.textContent = message;
    resultEl.className = 'upload-result ' + type;
    resultEl.style.display = 'block';
  }
}

// Load and display inventory (from localStorage)
function loadInventory() {
  initInventory(); // Reload from localStorage
  displayInventory(currentInventory);
  updateInventoryStats(getInventoryStats());
}

function displayInventory(vehicles) {
  const tbody = document.querySelector('#inventory-table tbody');
  if (!tbody) return;

  if (vehicles.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2rem; color: var(--gray-500);">
          No inventory loaded. Upload a CSV file to get started.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = vehicles.map(v => `
    <tr>
      <td><strong>${v.stockNumber}</strong></td>
      <td>${v.year}</td>
      <td>${v.make}</td>
      <td>${v.model}</td>
      <td>${v.trim || '-'}</td>
      <td>$${(v.msrp || v.sellingPrice || 0).toLocaleString()}</td>
      <td>${v.mileage?.toLocaleString() || 0}</td>
      <td><span class="badge badge-${getConditionBadge(v.condition)}">${v.condition}</span></td>
      <td><button class="btn-use-vehicle" data-stock="${v.stockNumber}">Use</button></td>
    </tr>
  `).join('');

  // Add click handlers for "Use" buttons
  document.querySelectorAll('.btn-use-vehicle').forEach(btn => {
    btn.addEventListener('click', () => {
      const stockNumber = btn.dataset.stock;
      selectVehicleFromInventory(stockNumber);
    });
  });
}

function getConditionBadge(condition) {
  switch (condition) {
    case 'new': return 'success';
    case 'certified': return 'info';
    default: return 'gray';
  }
}

function updateInventoryStats(stats) {
  const statsEl = document.getElementById('inventory-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <span class="stat">Total: <strong>${stats.total}</strong></span>
      <span class="stat">New: <strong>${stats.new}</strong></span>
      <span class="stat">Used: <strong>${stats.used}</strong></span>
      <span class="stat">Certified: <strong>${stats.certified}</strong></span>
    `;
  }
}

// Search inventory
document.getElementById('inventory-search')?.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  const filter = document.getElementById('inventory-filter')?.value;

  let filtered = currentInventory;

  if (query) {
    filtered = filtered.filter(v =>
      v.stockNumber.toLowerCase().includes(query) ||
      v.make.toLowerCase().includes(query) ||
      v.model.toLowerCase().includes(query) ||
      (v.vin && v.vin.toLowerCase().includes(query))
    );
  }

  if (filter) {
    filtered = filtered.filter(v => v.condition === filter);
  }

  displayInventory(filtered);
});

// Filter inventory
document.getElementById('inventory-filter')?.addEventListener('change', () => {
  const query = document.getElementById('inventory-search')?.value.toLowerCase() || '';
  const filter = document.getElementById('inventory-filter')?.value;

  let filtered = currentInventory;

  if (query) {
    filtered = filtered.filter(v =>
      v.stockNumber.toLowerCase().includes(query) ||
      v.make.toLowerCase().includes(query) ||
      v.model.toLowerCase().includes(query)
    );
  }

  if (filter) {
    filtered = filtered.filter(v => v.condition === filter);
  }

  displayInventory(filtered);
});

// Refresh inventory
document.getElementById('btn-refresh-inventory')?.addEventListener('click', loadInventory);

// Clear inventory (localStorage)
document.getElementById('btn-clear-inventory')?.addEventListener('click', () => {
  if (!confirm('Are you sure you want to clear all inventory? This cannot be undone.')) {
    return;
  }

  currentInventory = [];
  saveInventory();
  displayInventory([]);
  updateInventoryStats({ total: 0, new: 0, used: 0, certified: 0 });
  loadInventoryForSelector();
});

// Load inventory for vehicle selector dropdown (from localStorage)
function loadInventoryForSelector() {
  initInventory(); // Reload from localStorage

  const selector = document.getElementById('vehicle-selector');
  if (!selector) return;

  // Keep the first option
  selector.innerHTML = '<option value="">-- Select from Inventory --</option>';

  if (currentInventory.length === 0) return;

  // Group by condition
  const newVehicles = currentInventory.filter(v => v.condition === 'new');
  const certifiedVehicles = currentInventory.filter(v => v.condition === 'certified');
  const usedVehicles = currentInventory.filter(v => v.condition === 'used');

  if (newVehicles.length > 0) {
    const group = document.createElement('optgroup');
    group.label = 'New Vehicles';
    newVehicles.forEach(v => {
      const option = document.createElement('option');
      option.value = v.stockNumber;
      option.textContent = `${v.stockNumber} - ${v.year} ${v.make} ${v.model} ${v.trim || ''} - $${(v.msrp || v.sellingPrice || 0).toLocaleString()}`;
      group.appendChild(option);
    });
    selector.appendChild(group);
  }

  if (certifiedVehicles.length > 0) {
    const group = document.createElement('optgroup');
    group.label = 'Certified Pre-Owned';
    certifiedVehicles.forEach(v => {
      const option = document.createElement('option');
      option.value = v.stockNumber;
      option.textContent = `${v.stockNumber} - ${v.year} ${v.make} ${v.model} ${v.trim || ''} - $${(v.msrp || v.sellingPrice || 0).toLocaleString()}`;
      group.appendChild(option);
    });
    selector.appendChild(group);
  }

  if (usedVehicles.length > 0) {
    const group = document.createElement('optgroup');
    group.label = 'Used Vehicles';
    usedVehicles.forEach(v => {
      const option = document.createElement('option');
      option.value = v.stockNumber;
      option.textContent = `${v.stockNumber} - ${v.year} ${v.make} ${v.model} ${v.trim || ''} - $${(v.msrp || v.sellingPrice || 0).toLocaleString()}`;
      group.appendChild(option);
    });
    selector.appendChild(group);
  }
}

// Vehicle selector change handler
document.getElementById('vehicle-selector')?.addEventListener('change', (e) => {
  const stockNumber = e.target.value;
  if (stockNumber) {
    selectVehicleFromInventory(stockNumber);
  }
});

// Select vehicle from inventory and populate worksheet (from localStorage)
function selectVehicleFromInventory(stockNumber) {
  const vehicle = currentInventory.find(v => v.stockNumber === stockNumber);

  if (!vehicle) {
    console.error('Vehicle not found:', stockNumber);
    return;
  }

  // Populate sidebar fields
  document.getElementById('stock-number').value = vehicle.stockNumber;
  document.getElementById('vehicle-year').value = vehicle.year;
  document.getElementById('vehicle-make').value = vehicle.make;
  document.getElementById('vehicle-model').value = vehicle.model;
  document.getElementById('vehicle-trim').value = vehicle.trim || '';

  // Set condition checkboxes
  document.getElementById('is-used').checked = vehicle.condition === 'used';
  document.getElementById('is-cert').checked = vehicle.condition === 'certified';
  document.getElementById('is-demo').checked = false;

  // Populate pricing
  const msrp = vehicle.msrp || vehicle.sellingPrice || 0;
  document.getElementById('msrp').value = msrp.toFixed(2);

  // If selling price is different from MSRP, calculate discount
  if (vehicle.sellingPrice && vehicle.msrp && vehicle.sellingPrice < vehicle.msrp) {
    document.getElementById('discount').value = (vehicle.msrp - vehicle.sellingPrice).toFixed(2);
  } else {
    document.getElementById('discount').value = '0';
  }

  // Update vehicle selector dropdown
  document.getElementById('vehicle-selector').value = stockNumber;

  // Recalculate worksheet
  calculateWorksheet();

  // Switch to Deal Desk tab if on inventory tab
  const dealDeskTab = document.querySelector('.tab[data-tab="deal-desk"]');
  if (dealDeskTab && !dealDeskTab.classList.contains('active')) {
    dealDeskTab.click();
  }

  // Scroll to top
  document.querySelector('.worksheet-header')?.scrollIntoView({ behavior: 'smooth' });
}

// Load inventory when switching to inventory tab
document.querySelector('.tab[data-tab="inventory"]')?.addEventListener('click', () => {
  loadInventory();
});
