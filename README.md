# Union Park Deal Optimizer

**Unified Automotive Deal Optimizer & F&I Desking Tool**

A comprehensive deal structuring tool designed to replicate ERA Ignite F&I Desking functionality with intelligent lender matching and approval optimization.

## Features

- **Interactive Deal Desking** - Full F&I workflow with payment calculations
- **13 Pre-Configured Lenders** - Credit tier requirements, rates, and approval criteria
- **Smart Lender Matching** - Automatically matches deals to best lenders based on credit profile
- **Approval Optimization** - Suggests deal adjustments to improve approval odds
- **Payment Grid** - ERA Ignite-style payment matrix across rates and terms
- **Scenario Comparison** - Compare multiple deal structures side-by-side
- **What-If Analysis** - Explore how changes affect deal approval

## Configured Lenders

| Lender | Type | Credit Range | Best For |
|--------|------|--------------|----------|
| Ally Financial | Full Spectrum | 500-850 | All credit tiers, quick approvals |
| GM Financial | Captive | 550-850 | GMC/Buick vehicles, CPO programs |
| Chase Auto | National Bank | 660-850 | Prime/Super-prime customers |
| Wells Fargo | National Bank | 660-850 | Prime customers, competitive rates |
| M&T Bank | Regional Bank | 650-850 | Local relationships, flexible |
| Bank of America | National Bank | 660-850 | Preferred Rewards members |
| PNC Bank | Regional Bank | 650-850 | Regional customers |
| Westlake Financial | Subprime | 450-699 | Credit rebuilding, challenged credit |
| PSECU | Credit Union | 580-850 | Best rates for members |
| Dexsta FCU | Credit Union | 580-850 | Delaware local members |
| Citadel Credit Union | Credit Union | 580-850 | PA/DE region members |
| MECU | Credit Union | 580-850 | Maryland educators |
| First Help Financial | Deep Subprime | 400-649 | Fresh start, ITIN programs |

## Installation

```bash
npm install
npm run build
```

## Usage

### Interactive Deal Desk

Start a full interactive deal desking session:

```bash
npm run dev desk
# or after building:
npm start desk
```

This walks you through:
1. Vehicle Information (year, make, model, mileage, condition)
2. Customer Credit Profile (score, income, debt)
3. Deal Structure (price, trade, down payment)
4. F&I Products selection
5. Lender Analysis with recommendations

### Quick Payment Calculator

```bash
npm run dev calc
# Or with options:
npm run dev calc -a 25000 -r 7.99 -t 72
```

### View Configured Lenders

```bash
npm run dev lenders
# Filter by credit tier:
npm run dev lenders -t subprime
```

### Credit Tier Guide

```bash
npm run dev tiers
```

## Programmatic Usage

```typescript
import { analyzeDeal, compareDealScenarios, findOptimalDeal } from './src';

// Quick deal analysis
const analysis = analyzeDeal({
  vehicleYear: 2022,
  vehicleMake: 'GMC',
  vehicleModel: 'Sierra 1500',
  vehicleMileage: 35000,
  certified: true,
  sellingPrice: 42000,
  cashDown: 3000,
  creditScore: 680,
  monthlyIncome: 5500,
  requestedTerm: 72,
});

console.log(analysis.bestLender);
// { name: 'Ally Financial', apr: 10.99, payment: 654.23, confidence: 'medium' }

// Compare scenarios
const comparison = compareDealScenarios(
  { /* base params */ },
  [
    { name: 'More Down', changes: { cashDown: 5000 } },
    { name: 'Longer Term', changes: { requestedTerm: 84 } },
  ]
);

// Find optimal deal for target payment
const optimal = findOptimalDeal({
  vehicleYear: 2022,
  vehicleMake: 'GMC',
  vehicleModel: 'Terrain',
  vehicleMileage: 28000,
  sellingPrice: 32000,
  creditScore: 620,
  monthlyIncome: 4500,
  targetPayment: 500,
});

console.log(optimal.optimal);
// { cashDown: 3000, term: 72, payment: 498.50, lender: 'Westlake' }
```

## Credit Tiers

| Tier | Score Range | Typical Rates | Notes |
|------|-------------|---------------|-------|
| Super-Prime | 750+ | 5.24% - 6.99% | Best rates, max LTV, any term |
| Prime | 700-749 | 6.49% - 8.99% | Great rates, high approval |
| Near-Prime | 650-699 | 8.99% - 12.99% | Good options, some conditions |
| Subprime | 550-649 | 14.99% - 19.99% | Requires documentation |
| Deep Subprime | Below 550 | 19.99% - 24.99% | Specialist lenders, high down |

## Key Metrics

The system calculates and evaluates:

- **LTV (Loan to Value)** - Amount financed / Vehicle value
- **PTI (Payment to Income)** - Monthly payment / Monthly income
- **DTI (Debt to Income)** - Total monthly debt / Monthly income

Each lender has maximum thresholds for these ratios.

## State Tax Configuration

| State | Sales Tax | Notes |
|-------|-----------|-------|
| DE | 0% | No sales tax on vehicles |
| PA | 6% | Standard rate |
| MD | 6% | Standard rate |
| NJ | 6.625% | Standard rate |

## F&I Products Available

- Vehicle Service Contracts (Platinum/Gold/Silver)
- GAP Insurance
- Prepaid Maintenance
- Tire & Wheel Protection
- Key Replacement
- Paint & Fabric Protection
- Theft Deterrent System

## Project Structure

```
src/
├── types/              # TypeScript type definitions
├── config/
│   └── lenders.ts      # All 13 lender configurations
├── calculators/
│   └── payment.ts      # Financial calculations
├── desking/
│   └── deal-desk.ts    # Deal desking module
├── optimizer/
│   └── lender-matcher.ts   # Lender matching engine
├── inventory/
│   └── vehicle-manager.ts  # Vehicle/book value management
├── scenarios/
│   └── deal-comparison.ts  # Scenario comparison tools
├── cli.ts              # Command-line interface
└── index.ts            # Main exports
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript |
| `npm run dev` | Run CLI with ts-node |
| `npm start` | Run compiled CLI |
| `npm test` | Run tests |

## Vehicle Support

- All standard makes (GMC, Buick, Chevrolet, Honda, Toyota, Ford, etc.)
- GM Certified Pre-Owned (rate reductions)
- Honda Certified Pre-Owned
- Dealer Certified vehicles

**Excluded from financing:**
- Audi, BMW, Mercedes-Benz, Lexus, Porsche (luxury exclusions for most lenders)

## License

MIT
