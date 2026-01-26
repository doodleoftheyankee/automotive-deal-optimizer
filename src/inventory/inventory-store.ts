// ============================================================================
// INVENTORY STORE - Manages dealership vehicle inventory
// ============================================================================

export interface InventoryVehicle {
  stockNumber: string;
  vin?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  msrp: number;
  sellingPrice?: number;
  invoice?: number;
  mileage: number;
  exteriorColor?: string;
  interiorColor?: string;
  condition: 'new' | 'used' | 'certified';
  daysInStock?: number;
  location?: string;
  notes?: string;
}

// In-memory inventory store (persists during server runtime)
let inventoryStore: InventoryVehicle[] = [];

/**
 * Parse CSV data into inventory vehicles
 */
export function parseInventoryCSV(csvData: string): InventoryVehicle[] {
  const lines = csvData.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header row
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

  // Map common Reynolds and Reynolds field names
  const fieldMap: Record<string, string> = {
    'stock': 'stockNumber',
    'stock #': 'stockNumber',
    'stock number': 'stockNumber',
    'stocknumber': 'stockNumber',
    'stk': 'stockNumber',
    'stk#': 'stockNumber',
    'vin': 'vin',
    'vehicle vin': 'vin',
    'year': 'year',
    'yr': 'year',
    'model year': 'year',
    'make': 'make',
    'mfg': 'make',
    'manufacturer': 'make',
    'model': 'model',
    'trim': 'trim',
    'trim level': 'trim',
    'series': 'trim',
    'msrp': 'msrp',
    'retail': 'msrp',
    'list price': 'msrp',
    'listprice': 'msrp',
    'price': 'sellingPrice',
    'selling price': 'sellingPrice',
    'sellingprice': 'sellingPrice',
    'asking price': 'sellingPrice',
    'internet price': 'sellingPrice',
    'invoice': 'invoice',
    'dealer invoice': 'invoice',
    'mileage': 'mileage',
    'miles': 'mileage',
    'odometer': 'mileage',
    'exterior color': 'exteriorColor',
    'ext color': 'exteriorColor',
    'color': 'exteriorColor',
    'interior color': 'interiorColor',
    'int color': 'interiorColor',
    'condition': 'condition',
    'type': 'condition',
    'new/used': 'condition',
    'status': 'condition',
    'days in stock': 'daysInStock',
    'age': 'daysInStock',
    'days': 'daysInStock',
    'location': 'location',
    'lot': 'location',
    'notes': 'notes',
    'comments': 'notes',
  };

  // Create header index map
  const headerIndex: Record<string, number> = {};
  headers.forEach((header, index) => {
    const mappedField = fieldMap[header];
    if (mappedField) {
      headerIndex[mappedField] = index;
    }
  });

  // Parse data rows
  const vehicles: InventoryVehicle[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 3) continue; // Skip empty/invalid rows

    const getValue = (field: string): string => {
      const index = headerIndex[field];
      return index !== undefined ? (values[index] || '').trim() : '';
    };

    const stockNumber = getValue('stockNumber');
    const year = parseInt(getValue('year')) || 0;
    const make = getValue('make');
    const model = getValue('model');

    // Skip if missing required fields
    if (!stockNumber || !year || !make || !model) continue;

    // Determine condition
    let condition: 'new' | 'used' | 'certified' = 'used';
    const conditionValue = getValue('condition').toLowerCase();
    if (conditionValue.includes('new')) condition = 'new';
    else if (conditionValue.includes('cert') || conditionValue.includes('cpo')) condition = 'certified';

    const vehicle: InventoryVehicle = {
      stockNumber,
      vin: getValue('vin') || undefined,
      year,
      make: make.toUpperCase(),
      model: model.toUpperCase(),
      trim: getValue('trim') || undefined,
      msrp: parseFloat(getValue('msrp').replace(/[$,]/g, '')) || 0,
      sellingPrice: parseFloat(getValue('sellingPrice').replace(/[$,]/g, '')) || undefined,
      invoice: parseFloat(getValue('invoice').replace(/[$,]/g, '')) || undefined,
      mileage: parseInt(getValue('mileage').replace(/,/g, '')) || 0,
      exteriorColor: getValue('exteriorColor') || undefined,
      interiorColor: getValue('interiorColor') || undefined,
      condition,
      daysInStock: parseInt(getValue('daysInStock')) || undefined,
      location: getValue('location') || undefined,
      notes: getValue('notes') || undefined,
    };

    vehicles.push(vehicle);
  }

  return vehicles;
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

/**
 * Import vehicles into the store
 */
export function importInventory(vehicles: InventoryVehicle[]): { imported: number; updated: number } {
  let imported = 0;
  let updated = 0;

  vehicles.forEach(vehicle => {
    const existingIndex = inventoryStore.findIndex(v => v.stockNumber === vehicle.stockNumber);
    if (existingIndex >= 0) {
      inventoryStore[existingIndex] = vehicle;
      updated++;
    } else {
      inventoryStore.push(vehicle);
      imported++;
    }
  });

  return { imported, updated };
}

/**
 * Get all inventory
 */
export function getInventory(): InventoryVehicle[] {
  return [...inventoryStore];
}

/**
 * Get vehicle by stock number
 */
export function getVehicleByStock(stockNumber: string): InventoryVehicle | undefined {
  return inventoryStore.find(v => v.stockNumber.toLowerCase() === stockNumber.toLowerCase());
}

/**
 * Search inventory
 */
export function searchInventory(query: string): InventoryVehicle[] {
  const q = query.toLowerCase();
  return inventoryStore.filter(v =>
    v.stockNumber.toLowerCase().includes(q) ||
    v.make.toLowerCase().includes(q) ||
    v.model.toLowerCase().includes(q) ||
    (v.vin && v.vin.toLowerCase().includes(q))
  );
}

/**
 * Clear all inventory
 */
export function clearInventory(): void {
  inventoryStore = [];
}

/**
 * Get inventory stats
 */
export function getInventoryStats(): {
  total: number;
  new: number;
  used: number;
  certified: number;
  byMake: Record<string, number>;
} {
  const byMake: Record<string, number> = {};
  let newCount = 0;
  let usedCount = 0;
  let certifiedCount = 0;

  inventoryStore.forEach(v => {
    byMake[v.make] = (byMake[v.make] || 0) + 1;
    if (v.condition === 'new') newCount++;
    else if (v.condition === 'certified') certifiedCount++;
    else usedCount++;
  });

  return {
    total: inventoryStore.length,
    new: newCount,
    used: usedCount,
    certified: certifiedCount,
    byMake,
  };
}
