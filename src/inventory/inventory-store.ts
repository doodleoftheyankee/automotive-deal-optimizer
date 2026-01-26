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
  // Normalize line endings
  const normalizedData = csvData.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedData.trim().split('\n');

  if (lines.length < 2) {
    console.log('CSV has less than 2 lines');
    return [];
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim().replace(/['"]/g, ''));
  console.log('Parsed headers:', headers);

  // Map common Reynolds and Reynolds field names (expanded list)
  const fieldMap: Record<string, string> = {
    // Stock Number variations
    'stock': 'stockNumber',
    'stock #': 'stockNumber',
    'stock#': 'stockNumber',
    'stock number': 'stockNumber',
    'stocknumber': 'stockNumber',
    'stockno': 'stockNumber',
    'stock no': 'stockNumber',
    'stk': 'stockNumber',
    'stk#': 'stockNumber',
    'stk #': 'stockNumber',
    'stk no': 'stockNumber',
    'stkno': 'stockNumber',
    'unit': 'stockNumber',
    'unit #': 'stockNumber',
    'unit#': 'stockNumber',

    // VIN variations
    'vin': 'vin',
    'vehicle vin': 'vin',
    'vin number': 'vin',
    'vin#': 'vin',
    'vin #': 'vin',
    'serialno': 'vin',
    'serial': 'vin',

    // Year variations
    'year': 'year',
    'yr': 'year',
    'model year': 'year',
    'modelyear': 'year',
    'my': 'year',
    'vehicle year': 'year',

    // Make variations
    'make': 'make',
    'mfg': 'make',
    'manufacturer': 'make',
    'brand': 'make',
    'vehicle make': 'make',

    // Model variations
    'model': 'model',
    'vehicle model': 'model',
    'mdl': 'model',

    // Trim variations
    'trim': 'trim',
    'trim level': 'trim',
    'trimlevel': 'trim',
    'series': 'trim',
    'body': 'trim',
    'body style': 'trim',
    'bodystyle': 'trim',
    'style': 'trim',
    'description': 'trim',
    'desc': 'trim',

    // MSRP/Price variations
    'msrp': 'msrp',
    'retail': 'msrp',
    'retail price': 'msrp',
    'retailprice': 'msrp',
    'list': 'msrp',
    'list price': 'msrp',
    'listprice': 'msrp',
    'sticker': 'msrp',
    'sticker price': 'msrp',
    'price': 'sellingPrice',
    'selling price': 'sellingPrice',
    'sellingprice': 'sellingPrice',
    'asking price': 'sellingPrice',
    'askingprice': 'sellingPrice',
    'internet price': 'sellingPrice',
    'internetprice': 'sellingPrice',
    'sale price': 'sellingPrice',
    'saleprice': 'sellingPrice',
    'amount': 'sellingPrice',
    'cost': 'invoice',

    // Invoice variations
    'invoice': 'invoice',
    'inv': 'invoice',
    'dealer invoice': 'invoice',
    'dealerinvoice': 'invoice',
    'dealer cost': 'invoice',
    'dealercost': 'invoice',

    // Mileage variations
    'mileage': 'mileage',
    'miles': 'mileage',
    'odometer': 'mileage',
    'odo': 'mileage',
    'odom': 'mileage',
    'km': 'mileage',
    'kilometers': 'mileage',

    // Color variations
    'exterior color': 'exteriorColor',
    'exteriorcolor': 'exteriorColor',
    'ext color': 'exteriorColor',
    'extcolor': 'exteriorColor',
    'color': 'exteriorColor',
    'ext': 'exteriorColor',
    'exterior': 'exteriorColor',
    'interior color': 'interiorColor',
    'interiorcolor': 'interiorColor',
    'int color': 'interiorColor',
    'intcolor': 'interiorColor',
    'int': 'interiorColor',
    'interior': 'interiorColor',

    // Condition/Type variations
    'condition': 'condition',
    'type': 'condition',
    'new/used': 'condition',
    'newused': 'condition',
    'new / used': 'condition',
    'status': 'condition',
    'vehicle type': 'condition',
    'vehicletype': 'condition',
    'certified': 'condition',
    'cpo': 'condition',

    // Days in stock variations
    'days in stock': 'daysInStock',
    'daysinstock': 'daysInStock',
    'age': 'daysInStock',
    'days': 'daysInStock',
    'dis': 'daysInStock',
    'stock days': 'daysInStock',
    'stockdays': 'daysInStock',

    // Location variations
    'location': 'location',
    'loc': 'location',
    'lot': 'location',
    'lot location': 'location',
    'lotlocation': 'location',

    // Notes variations
    'notes': 'notes',
    'comments': 'notes',
    'comment': 'notes',
    'remarks': 'notes',
    'remark': 'notes',
  };

  // Create header index map
  const headerIndex: Record<string, number> = {};
  headers.forEach((header, index) => {
    const mappedField = fieldMap[header];
    if (mappedField) {
      headerIndex[mappedField] = index;
      console.log(`Mapped "${header}" -> ${mappedField} at index ${index}`);
    }
  });

  console.log('Header index map:', headerIndex);

  // Check if we have required fields
  const hasStock = 'stockNumber' in headerIndex;
  const hasYear = 'year' in headerIndex;
  const hasMake = 'make' in headerIndex;
  const hasModel = 'model' in headerIndex;

  console.log(`Required fields - Stock: ${hasStock}, Year: ${hasYear}, Make: ${hasMake}, Model: ${hasModel}`);

  // Parse data rows
  const vehicles: InventoryVehicle[] = [];
  const skippedRows: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const values = parseCSVLine(line);
    if (values.length < 3) {
      skippedRows.push(`Row ${i + 1}: Too few values (${values.length})`);
      continue;
    }

    const getValue = (field: string): string => {
      const index = headerIndex[field];
      return index !== undefined && index < values.length ? (values[index] || '').trim().replace(/^["']|["']$/g, '') : '';
    };

    let stockNumber = getValue('stockNumber');
    const year = parseInt(getValue('year')) || 0;
    let make = getValue('make');
    let model = getValue('model');

    // If no mapped stock number, try using the first column
    if (!stockNumber && values.length > 0) {
      stockNumber = values[0].trim().replace(/^["']|["']$/g, '');
    }

    // If no mapped year, try finding a 4-digit number in the first few columns
    let yearValue = year;
    if (!yearValue) {
      for (let j = 0; j < Math.min(5, values.length); j++) {
        const val = values[j].trim().replace(/^["']|["']$/g, '');
        const parsed = parseInt(val);
        if (parsed >= 1990 && parsed <= 2030) {
          yearValue = parsed;
          break;
        }
      }
    }

    // Skip if missing required fields
    if (!stockNumber || !yearValue) {
      skippedRows.push(`Row ${i + 1}: Missing stock (${stockNumber}) or year (${yearValue})`);
      continue;
    }

    // If missing make/model, use placeholders
    if (!make) make = 'UNKNOWN';
    if (!model) model = 'UNKNOWN';

    // Determine condition
    let condition: 'new' | 'used' | 'certified' = 'used';
    const conditionValue = getValue('condition').toLowerCase();
    if (conditionValue.includes('new') && !conditionValue.includes('renew')) {
      condition = 'new';
    } else if (conditionValue.includes('cert') || conditionValue.includes('cpo')) {
      condition = 'certified';
    }

    // Also check mileage - if 0 or very low, probably new
    const mileage = parseInt(getValue('mileage').replace(/,/g, '')) || 0;
    if (mileage < 100 && condition === 'used') {
      condition = 'new';
    }

    // Parse price - try MSRP first, then selling price
    let msrp = parseFloat(getValue('msrp').replace(/[$,]/g, '')) || 0;
    const sellingPrice = parseFloat(getValue('sellingPrice').replace(/[$,]/g, '')) || undefined;

    // If no MSRP but have selling price, use that
    if (!msrp && sellingPrice) {
      msrp = sellingPrice;
    }

    const vehicle: InventoryVehicle = {
      stockNumber,
      vin: getValue('vin') || undefined,
      year: yearValue,
      make: make.toUpperCase(),
      model: model.toUpperCase(),
      trim: getValue('trim') || undefined,
      msrp,
      sellingPrice,
      invoice: parseFloat(getValue('invoice').replace(/[$,]/g, '')) || undefined,
      mileage,
      exteriorColor: getValue('exteriorColor') || undefined,
      interiorColor: getValue('interiorColor') || undefined,
      condition,
      daysInStock: parseInt(getValue('daysInStock')) || undefined,
      location: getValue('location') || undefined,
      notes: getValue('notes') || undefined,
    };

    vehicles.push(vehicle);
  }

  console.log(`Parsed ${vehicles.length} vehicles, skipped ${skippedRows.length} rows`);
  if (skippedRows.length > 0 && skippedRows.length <= 10) {
    console.log('Skipped rows:', skippedRows);
  }

  return vehicles;
}

/**
 * Parse a single CSV line, handling quoted values and various delimiters
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  // Try to detect delimiter (comma, tab, pipe, semicolon)
  let delimiter = ',';
  if (line.includes('\t') && !line.includes(',')) {
    delimiter = '\t';
  } else if (line.includes('|') && !line.includes(',')) {
    delimiter = '|';
  } else if (line.includes(';') && !line.includes(',')) {
    delimiter = ';';
  }

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      // Check for escaped quote (double quote)
      if (i + 1 < line.length && line[i + 1] === quoteChar) {
        current += char;
        i++; // Skip the next quote
      } else {
        inQuotes = false;
        quoteChar = '';
      }
    } else if (char === delimiter && !inQuotes) {
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
