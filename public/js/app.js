// ============================================================================
// DEAL OPTIMIZER - FRONTEND APPLICATION
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
// BOOK VALUE LOOKUP
// ============================================================================

document.getElementById('lookup-value')?.addEventListener('click', async () => {
  const year = document.getElementById('dd-year').value;
  const make = document.getElementById('dd-make').value;
  const model = document.getElementById('dd-model').value;
  const mileage = document.getElementById('dd-mileage').value;
  const condition = document.getElementById('dd-condition').value;

  try {
    const response = await fetch('/api/estimate-value', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: parseInt(year), make, model, mileage: parseInt(mileage), condition }),
    });

    const result = await response.json();

    if (result.success) {
      document.getElementById('bv-retail').textContent = result.data.retail?.toLocaleString() || '0';
      document.getElementById('bv-nada').textContent = result.data.nada?.toLocaleString() || '0';
      document.getElementById('bv-kbb').textContent = result.data.kbb?.toLocaleString() || '0';
      document.getElementById('book-values').style.display = 'flex';

      // Auto-fill selling price if empty
      const sellingPriceInput = document.getElementById('dd-selling-price');
      if (!sellingPriceInput.value || sellingPriceInput.value === '0') {
        sellingPriceInput.value = result.data.retail || 0;
      }
    }
  } catch (error) {
    console.error('Error fetching book values:', error);
  }
});

// ============================================================================
// DEAL ANALYSIS
// ============================================================================

document.getElementById('analyze-deal')?.addEventListener('click', async () => {
  const params = {
    vehicleYear: parseInt(document.getElementById('dd-year').value),
    vehicleMake: document.getElementById('dd-make').value,
    vehicleModel: document.getElementById('dd-model').value,
    vehicleMileage: parseInt(document.getElementById('dd-mileage').value),
    vehicleCondition: document.getElementById('dd-condition').value,
    certified: document.getElementById('dd-certified').checked,
    sellingPrice: parseFloat(document.getElementById('dd-selling-price').value),
    tradeValue: parseFloat(document.getElementById('dd-trade-value').value) || 0,
    tradePayoff: parseFloat(document.getElementById('dd-trade-payoff').value) || 0,
    cashDown: parseFloat(document.getElementById('dd-cash-down').value) || 0,
    rebates: parseFloat(document.getElementById('dd-rebates').value) || 0,
    creditScore: parseInt(document.getElementById('dd-credit-score').value),
    monthlyIncome: parseFloat(document.getElementById('dd-monthly-income').value),
    monthlyDebt: parseFloat(document.getElementById('dd-monthly-debt').value) || 0,
    customerState: document.getElementById('dd-state').value,
    requestedTerm: parseInt(document.getElementById('dd-term').value),
  };

  try {
    const response = await fetch('/api/analyze-deal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const result = await response.json();

    if (result.success) {
      displayDealResults(result.data);
    } else {
      alert('Error: ' + result.error);
    }
  } catch (error) {
    console.error('Error analyzing deal:', error);
    alert('Error analyzing deal. Please try again.');
  }
});

function displayDealResults(data) {
  // Show results section
  document.getElementById('deal-results').style.display = 'block';

  // Update metrics
  document.getElementById('result-amount-financed').textContent = '$' + data.deal.amountFinanced.toLocaleString();
  document.getElementById('result-ltv').textContent = data.deal.ltv.toFixed(1) + '%';
  document.getElementById('result-credit-tier').textContent = data.customer.creditTier.toUpperCase();
  document.getElementById('result-best-rate').textContent =
    data.lenderRecommendations.length > 0 ? data.lenderRecommendations[0].apr.toFixed(2) + '%' : 'N/A';

  // Update lender table
  const lenderTable = document.querySelector('#lender-table tbody');
  lenderTable.innerHTML = data.lenderRecommendations.map(rec => `
    <tr>
      <td><strong>${rec.lender}</strong><br><small>${rec.lenderType}</small></td>
      <td>${rec.apr.toFixed(2)}%</td>
      <td>$${rec.monthlyPayment.toFixed(2)}</td>
      <td><span class="badge badge-${getConfidenceBadge(rec.confidence)}">${rec.confidence}</span></td>
      <td><span class="badge badge-${getStatusBadge(rec.status)}">${formatStatus(rec.status)}</span></td>
    </tr>
  `).join('');

  // Update payment grid
  const paymentGrid = document.querySelector('#payment-grid tbody');
  paymentGrid.innerHTML = data.paymentGrid.map(row => `
    <tr>
      <td><strong>${row.rate.toFixed(2)}%</strong></td>
      ${row.payments.map(p => `
        <td class="${getPTIClass(p.pti)}">$${p.payment.toFixed(0)}<br><small>${p.pti.toFixed(1)}% PTI</small></td>
      `).join('')}
    </tr>
  `).join('');

  // Scroll to results
  document.getElementById('deal-results').scrollIntoView({ behavior: 'smooth' });
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
  updateMetricCard('metric-ltv', metrics.currentLTV.toFixed(1) + '%', getLTVStatus(metrics.currentLTV));
  updateMetricCard('metric-pti', metrics.currentPTI.toFixed(1) + '%', getPTIStatus(metrics.currentPTI));
  updateMetricCard('metric-dti', metrics.currentDTI.toFixed(1) + '%', getDTIStatus(metrics.currentDTI));
  updateMetricCard('metric-payment', '$' + metrics.currentPayment.toFixed(0), '');

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

function updateMetricCard(id, value, status) {
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

function getPTIStatus(pti) {
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
