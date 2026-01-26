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
  'DE': 0,        // Delaware - no sales tax
  'PA': 0.06,     // Pennsylvania - 6%
  'MD': 0.06,     // Maryland - 6%
  'NJ': 0.06625   // New Jersey - 6.625%
};

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
  }, 100);
});
