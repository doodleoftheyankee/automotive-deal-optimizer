// ============================================================================
// VEHICLE INVENTORY MANAGER
// Manages vehicle inventory and book values
// ============================================================================

import { Vehicle, VehicleClass } from '../types';

// ============================================================================
// VEHICLE DATABASE (Sample inventory structure)
// ============================================================================

export interface InventoryVehicle extends Vehicle {
  stockNumber: string;
  location?: string;
  daysInStock?: number;
  sellingPrice: number;
  internetPrice?: number;
  cost?: number;
  holdbackAmount?: number;
  photos?: string[];
  description?: string;
}

// ============================================================================
// VEHICLE MANAGER CLASS
// ============================================================================

export class VehicleManager {
  private inventory: Map<string, InventoryVehicle> = new Map();

  /**
   * Add vehicle to inventory
   */
  addVehicle(vehicle: InventoryVehicle): void {
    this.inventory.set(vehicle.stockNumber, vehicle);
  }

  /**
   * Get vehicle by stock number
   */
  getVehicle(stockNumber: string): InventoryVehicle | undefined {
    return this.inventory.get(stockNumber);
  }

  /**
   * Search inventory
   */
  searchInventory(criteria: SearchCriteria): InventoryVehicle[] {
    let results = Array.from(this.inventory.values());

    if (criteria.make) {
      results = results.filter((v) =>
        v.make.toLowerCase().includes(criteria.make!.toLowerCase())
      );
    }

    if (criteria.model) {
      results = results.filter((v) =>
        v.model.toLowerCase().includes(criteria.model!.toLowerCase())
      );
    }

    if (criteria.yearMin) {
      results = results.filter((v) => v.year >= criteria.yearMin!);
    }

    if (criteria.yearMax) {
      results = results.filter((v) => v.year <= criteria.yearMax!);
    }

    if (criteria.priceMin) {
      results = results.filter((v) => v.sellingPrice >= criteria.priceMin!);
    }

    if (criteria.priceMax) {
      results = results.filter((v) => v.sellingPrice <= criteria.priceMax!);
    }

    if (criteria.mileageMax) {
      results = results.filter((v) => v.mileage <= criteria.mileageMax!);
    }

    if (criteria.certified !== undefined) {
      results = results.filter((v) => v.certified === criteria.certified);
    }

    if (criteria.vehicleClass) {
      results = results.filter((v) => v.vehicleClass === criteria.vehicleClass);
    }

    return results;
  }

  /**
   * Get all inventory
   */
  getAllInventory(): InventoryVehicle[] {
    return Array.from(this.inventory.values());
  }

  /**
   * Import inventory from JSON
   */
  importFromJSON(data: InventoryVehicle[]): void {
    for (const vehicle of data) {
      this.addVehicle(vehicle);
    }
  }

  /**
   * Clear inventory
   */
  clearInventory(): void {
    this.inventory.clear();
  }

  /**
   * Get inventory stats
   */
  getInventoryStats(): InventoryStats {
    const vehicles = this.getAllInventory();
    const makes = new Map<string, number>();
    let totalValue = 0;
    let certifiedCount = 0;
    let avgDaysInStock = 0;
    let daysCount = 0;

    for (const v of vehicles) {
      makes.set(v.make, (makes.get(v.make) || 0) + 1);
      totalValue += v.sellingPrice;
      if (v.certified) certifiedCount++;
      if (v.daysInStock) {
        avgDaysInStock += v.daysInStock;
        daysCount++;
      }
    }

    return {
      totalVehicles: vehicles.length,
      totalValue,
      averagePrice: vehicles.length > 0 ? totalValue / vehicles.length : 0,
      certifiedCount,
      makeBreakdown: Object.fromEntries(makes),
      averageDaysInStock: daysCount > 0 ? avgDaysInStock / daysCount : 0,
    };
  }
}

// ============================================================================
// BOOK VALUE LOOKUP
// ============================================================================

/**
 * Estimate book values based on vehicle characteristics
 * In production, this would integrate with NADA, KBB, Black Book APIs
 */
export function estimateBookValues(
  year: number,
  make: string,
  model: string,
  mileage: number,
  condition: Vehicle['condition']
): Vehicle['bookValue'] {
  // Base depreciation calculation
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;

  // Get base MSRP estimate (simplified)
  const baseMSRP = getEstimatedMSRP(make, model, year);

  // Calculate depreciation
  // Year 1: 20%, Year 2-3: 15%/year, Year 4+: 10%/year
  let depreciation = 0;
  if (age >= 1) depreciation += 0.2;
  if (age >= 2) depreciation += 0.15;
  if (age >= 3) depreciation += 0.15;
  if (age >= 4) depreciation += 0.1 * (age - 3);

  // Mileage adjustment (average 12k/year)
  const expectedMileage = age * 12000;
  const mileageDiff = mileage - expectedMileage;
  const mileageAdjustment = (mileageDiff / 10000) * 0.02; // 2% per 10k miles over

  // Condition adjustment
  const conditionFactors: Record<Vehicle['condition'], number> = {
    excellent: 1.05,
    good: 1.0,
    fair: 0.92,
    poor: 0.8,
  };

  const baseValue = baseMSRP * (1 - depreciation - mileageAdjustment);
  const adjustedValue = baseValue * conditionFactors[condition];

  return {
    retail: Math.round(adjustedValue * 1.1), // Retail is typically 10% above wholesale
    wholesale: Math.round(adjustedValue * 0.95),
    nada: Math.round(adjustedValue),
    kbb: Math.round(adjustedValue * 0.98),
    blackBook: Math.round(adjustedValue * 0.97),
  };
}

/**
 * Get estimated MSRP for make/model
 */
function getEstimatedMSRP(make: string, model: string, year: number): number {
  // Simplified MSRP lookup - in production this would use actual data
  const msrpTable: Record<string, Record<string, number>> = {
    GMC: {
      Sierra: 45000,
      'Sierra 1500': 45000,
      'Sierra 2500': 55000,
      Yukon: 58000,
      'Yukon XL': 62000,
      Acadia: 38000,
      Terrain: 32000,
      Canyon: 35000,
      'Savana': 42000,
    },
    Buick: {
      Enclave: 45000,
      Envision: 38000,
      Encore: 28000,
      'Encore GX': 30000,
      LaCrosse: 35000,
      Regal: 32000,
    },
    Chevrolet: {
      Silverado: 42000,
      'Silverado 1500': 42000,
      Tahoe: 55000,
      Suburban: 58000,
      Equinox: 30000,
      Traverse: 38000,
      Malibu: 28000,
      Camaro: 35000,
      Colorado: 32000,
      Trax: 24000,
      Blazer: 38000,
    },
    Honda: {
      Accord: 30000,
      Civic: 25000,
      'CR-V': 32000,
      Pilot: 40000,
      'HR-V': 26000,
      Odyssey: 38000,
      Passport: 38000,
      Ridgeline: 42000,
    },
    Toyota: {
      Camry: 28000,
      Corolla: 24000,
      RAV4: 32000,
      Highlander: 40000,
      Tacoma: 35000,
      Tundra: 45000,
      '4Runner': 42000,
      Sienna: 40000,
    },
    Ford: {
      'F-150': 45000,
      'F-250': 55000,
      Explorer: 40000,
      Escape: 32000,
      Edge: 38000,
      Mustang: 35000,
      Expedition: 55000,
      Bronco: 42000,
      Ranger: 35000,
    },
    Nissan: {
      Altima: 28000,
      Sentra: 22000,
      Rogue: 32000,
      Pathfinder: 38000,
      Murano: 40000,
      Titan: 45000,
      Frontier: 35000,
    },
    Hyundai: {
      Sonata: 28000,
      Elantra: 23000,
      'Santa Fe': 35000,
      Tucson: 30000,
      Palisade: 42000,
      Kona: 26000,
    },
    Kia: {
      Optima: 27000,
      K5: 28000,
      Sorento: 35000,
      Sportage: 30000,
      Telluride: 45000,
      Seltos: 26000,
    },
    Jeep: {
      'Grand Cherokee': 45000,
      Cherokee: 35000,
      Wrangler: 38000,
      Compass: 30000,
      Gladiator: 42000,
    },
    Ram: {
      1500: 45000,
      2500: 55000,
      3500: 60000,
    },
    Dodge: {
      Charger: 35000,
      Challenger: 35000,
      Durango: 42000,
    },
    Subaru: {
      Outback: 32000,
      Forester: 30000,
      Crosstrek: 28000,
      Ascent: 38000,
      Legacy: 28000,
      Impreza: 24000,
    },
    Mazda: {
      CX5: 30000,
      'CX-5': 30000,
      CX9: 38000,
      'CX-9': 38000,
      Mazda3: 25000,
      Mazda6: 28000,
    },
    Volkswagen: {
      Jetta: 24000,
      Passat: 28000,
      Tiguan: 30000,
      Atlas: 38000,
      ID4: 42000,
    },
  };

  const makeTable = msrpTable[make];
  if (!makeTable) return 30000; // Default fallback

  // Try exact model match
  if (makeTable[model]) return makeTable[model];

  // Try partial match
  for (const [key, value] of Object.entries(makeTable)) {
    if (model.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(model.toLowerCase())) {
      return value;
    }
  }

  return 30000; // Default fallback
}

/**
 * Determine vehicle class from make/model
 */
export function determineVehicleClass(
  make: string,
  model: string
): VehicleClass {
  const modelLower = model.toLowerCase();

  // Trucks
  if (
    modelLower.includes('sierra') ||
    modelLower.includes('silverado') ||
    modelLower.includes('f-150') ||
    modelLower.includes('f150') ||
    modelLower.includes('f-250') ||
    modelLower.includes('tundra') ||
    modelLower.includes('titan') ||
    modelLower.includes('ram') ||
    modelLower.includes('tacoma') ||
    modelLower.includes('colorado') ||
    modelLower.includes('canyon') ||
    modelLower.includes('ranger') ||
    modelLower.includes('frontier') ||
    modelLower.includes('ridgeline') ||
    modelLower.includes('gladiator')
  ) {
    return 'truck';
  }

  // Full-size SUVs
  if (
    modelLower.includes('yukon') ||
    modelLower.includes('tahoe') ||
    modelLower.includes('suburban') ||
    modelLower.includes('expedition') ||
    modelLower.includes('sequoia') ||
    modelLower.includes('armada')
  ) {
    return 'fullsize';
  }

  // SUVs
  if (
    modelLower.includes('acadia') ||
    modelLower.includes('terrain') ||
    modelLower.includes('enclave') ||
    modelLower.includes('envision') ||
    modelLower.includes('encore') ||
    modelLower.includes('traverse') ||
    modelLower.includes('equinox') ||
    modelLower.includes('blazer') ||
    modelLower.includes('trax') ||
    modelLower.includes('pilot') ||
    modelLower.includes('cr-v') ||
    modelLower.includes('hr-v') ||
    modelLower.includes('passport') ||
    modelLower.includes('highlander') ||
    modelLower.includes('rav4') ||
    modelLower.includes('4runner') ||
    modelLower.includes('explorer') ||
    modelLower.includes('escape') ||
    modelLower.includes('edge') ||
    modelLower.includes('bronco') ||
    modelLower.includes('rogue') ||
    modelLower.includes('pathfinder') ||
    modelLower.includes('murano') ||
    modelLower.includes('santa fe') ||
    modelLower.includes('tucson') ||
    modelLower.includes('palisade') ||
    modelLower.includes('kona') ||
    modelLower.includes('sorento') ||
    modelLower.includes('sportage') ||
    modelLower.includes('telluride') ||
    modelLower.includes('seltos') ||
    modelLower.includes('cherokee') ||
    modelLower.includes('compass') ||
    modelLower.includes('wrangler') ||
    modelLower.includes('durango') ||
    modelLower.includes('outback') ||
    modelLower.includes('forester') ||
    modelLower.includes('crosstrek') ||
    modelLower.includes('ascent') ||
    modelLower.includes('cx-5') ||
    modelLower.includes('cx5') ||
    modelLower.includes('cx-9') ||
    modelLower.includes('cx9') ||
    modelLower.includes('tiguan') ||
    modelLower.includes('atlas')
  ) {
    return 'suv';
  }

  // Vans
  if (
    modelLower.includes('odyssey') ||
    modelLower.includes('sienna') ||
    modelLower.includes('pacifica') ||
    modelLower.includes('savana') ||
    modelLower.includes('express') ||
    modelLower.includes('transit') ||
    modelLower.includes('caravan')
  ) {
    return 'van';
  }

  // Sports
  if (
    modelLower.includes('camaro') ||
    modelLower.includes('mustang') ||
    modelLower.includes('charger') ||
    modelLower.includes('challenger') ||
    modelLower.includes('corvette')
  ) {
    return 'sports';
  }

  // Midsize sedans
  if (
    modelLower.includes('malibu') ||
    modelLower.includes('accord') ||
    modelLower.includes('camry') ||
    modelLower.includes('altima') ||
    modelLower.includes('sonata') ||
    modelLower.includes('optima') ||
    modelLower.includes('k5') ||
    modelLower.includes('legacy') ||
    modelLower.includes('mazda6') ||
    modelLower.includes('passat') ||
    modelLower.includes('lacrosse') ||
    modelLower.includes('regal')
  ) {
    return 'midsize';
  }

  // Compact
  if (
    modelLower.includes('civic') ||
    modelLower.includes('corolla') ||
    modelLower.includes('sentra') ||
    modelLower.includes('elantra') ||
    modelLower.includes('forte') ||
    modelLower.includes('impreza') ||
    modelLower.includes('mazda3') ||
    modelLower.includes('jetta')
  ) {
    return 'compact';
  }

  // Default to midsize
  return 'midsize';
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface SearchCriteria {
  make?: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  priceMin?: number;
  priceMax?: number;
  mileageMax?: number;
  certified?: boolean;
  vehicleClass?: VehicleClass;
}

export interface InventoryStats {
  totalVehicles: number;
  totalValue: number;
  averagePrice: number;
  certifiedCount: number;
  makeBreakdown: Record<string, number>;
  averageDaysInStock: number;
}

// Export singleton instance
export const vehicleManager = new VehicleManager();
