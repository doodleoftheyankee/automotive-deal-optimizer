// ============================================================================
// INVENTORY MANAGER
// CSV parsing with auto-delimiter detection, R&R DMS field mapping (80+ aliases),
// sheet-based storage, search, stats
// ============================================================================

var INVENTORY_SHEET_NAME = 'Inventory';

var RR_FIELD_MAP = {
  'stock': 'stockNumber', 'stock #': 'stockNumber', 'stock#': 'stockNumber',
  'stock number': 'stockNumber', 'stocknumber': 'stockNumber', 'stockno': 'stockNumber',
  'stock no': 'stockNumber', 'stk': 'stockNumber', 'stk#': 'stockNumber',
  'stk #': 'stockNumber', 'stk no': 'stockNumber', 'stkno': 'stockNumber',
  'unit': 'stockNumber', 'unit #': 'stockNumber', 'unit#': 'stockNumber',
  'vin': 'vin', 'vehicle vin': 'vin', 'vin number': 'vin', 'vin#': 'vin',
  'vin #': 'vin', 'serialno': 'vin', 'serial': 'vin',
  'year': 'year', 'yr': 'year', 'model year': 'year', 'modelyear': 'year',
  'my': 'year', 'vehicle year': 'year',
  'make': 'make', 'mfg': 'make', 'manufacturer': 'make', 'brand': 'make', 'vehicle make': 'make',
  'model': 'model', 'vehicle model': 'model', 'mdl': 'model',
  'trim': 'trim', 'trim level': 'trim', 'trimlevel': 'trim', 'series': 'trim',
  'body': 'trim', 'body style': 'trim', 'bodystyle': 'trim', 'style': 'trim',
  'description': 'trim', 'desc': 'trim',
  'msrp': 'msrp', 'retail': 'msrp', 'retail price': 'msrp', 'retailprice': 'msrp',
  'list': 'msrp', 'list price': 'msrp', 'listprice': 'msrp',
  'sticker': 'msrp', 'sticker price': 'msrp',
  'price': 'sellingPrice', 'selling price': 'sellingPrice', 'sellingprice': 'sellingPrice',
  'asking price': 'sellingPrice', 'askingprice': 'sellingPrice',
  'internet price': 'sellingPrice', 'internetprice': 'sellingPrice',
  'sale price': 'sellingPrice', 'saleprice': 'sellingPrice', 'amount': 'sellingPrice',
  'cost': 'invoice', 'invoice': 'invoice', 'inv': 'invoice',
  'dealer invoice': 'invoice', 'dealerinvoice': 'invoice',
  'dealer cost': 'invoice', 'dealercost': 'invoice',
  'mileage': 'mileage', 'miles': 'mileage', 'odometer': 'mileage',
  'odo': 'mileage', 'odom': 'mileage', 'km': 'mileage', 'kilometers': 'mileage',
  'exterior color': 'exteriorColor', 'exteriorcolor': 'exteriorColor',
  'ext color': 'exteriorColor', 'extcolor': 'exteriorColor', 'color': 'exteriorColor',
  'ext': 'exteriorColor', 'exterior': 'exteriorColor',
  'interior color': 'interiorColor', 'interiorcolor': 'interiorColor',
  'int color': 'interiorColor', 'intcolor': 'interiorColor',
  'int': 'interiorColor', 'interior': 'interiorColor',
  'condition': 'condition', 'type': 'condition', 'new/used': 'condition',
  'newused': 'condition', 'new / used': 'condition', 'status': 'condition',
  'vehicle type': 'condition', 'vehicletype': 'condition',
  'certified': 'condition', 'cpo': 'condition',
  'days in stock': 'daysInStock', 'daysinstock': 'daysInStock', 'age': 'daysInStock',
  'days': 'daysInStock', 'dis': 'daysInStock', 'stock days': 'daysInStock', 'stockdays': 'daysInStock',
  'location': 'location', 'loc': 'location', 'lot': 'location',
  'lot location': 'location', 'lotlocation': 'location',
  'notes': 'notes', 'comments': 'notes', 'comment': 'notes',
  'remarks': 'notes', 'remark': 'notes'
};

function parseCSVLine_(line, delimiter) {
  var result = [];
  var current = '';
  var inQuotes = false;
  var quoteChar = '';
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if ((ch === '"' || ch === "'") && !inQuotes) { inQuotes = true; quoteChar = ch; }
    else if (ch === quoteChar && inQuotes) {
      if (i + 1 < line.length && line[i + 1] === quoteChar) { current += ch; i++; }
      else { inQuotes = false; quoteChar = ''; }
    } else if (ch === delimiter && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

function detectDelimiter_(line) {
  if (line.indexOf('\t') >= 0 && line.indexOf(',') < 0) return '\t';
  if (line.indexOf('|') >= 0 && line.indexOf(',') < 0) return '|';
  if (line.indexOf(';') >= 0 && line.indexOf(',') < 0) return ';';
  return ',';
}

function parseInventoryCSV(csvData) {
  var normalized = csvData.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  var lines = normalized.trim().split('\n');
  if (lines.length < 2) return [];

  var delimiter = detectDelimiter_(lines[0]);
  var headers = parseCSVLine_(lines[0], delimiter).map(function(h) {
    return h.toLowerCase().trim().replace(/['"]/g, '');
  });

  var headerIndex = {};
  headers.forEach(function(header, index) {
    var mapped = RR_FIELD_MAP[header];
    if (mapped) headerIndex[mapped] = index;
  });

  var vehicles = [];
  for (var i = 1; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var values = parseCSVLine_(line, delimiter);
    if (values.length < 3) continue;

    var getValue = function(field) {
      var idx = headerIndex[field];
      return idx !== undefined && idx < values.length ? (values[idx] || '').trim().replace(/^["']|["']$/g, '') : '';
    };

    var stockNumber = getValue('stockNumber');
    var yearVal = parseInt(getValue('year')) || 0;
    var make = getValue('make');
    var model = getValue('model');

    if (!stockNumber && values.length > 0) stockNumber = values[0].trim().replace(/^["']|["']$/g, '');
    if (!yearVal) {
      for (var j = 0; j < Math.min(5, values.length); j++) {
        var p = parseInt(values[j].trim().replace(/^["']|["']$/g, ''));
        if (p >= 1990 && p <= 2030) { yearVal = p; break; }
      }
    }
    if (!stockNumber || !yearVal) continue;
    if (!make) make = 'UNKNOWN';
    if (!model) model = 'UNKNOWN';

    var condition = 'used';
    var condVal = getValue('condition').toLowerCase();
    if (condVal.indexOf('new') >= 0 && condVal.indexOf('renew') < 0) condition = 'new';
    else if (condVal.indexOf('cert') >= 0 || condVal.indexOf('cpo') >= 0) condition = 'certified';

    var mileage = parseInt(getValue('mileage').replace(/,/g, '')) || 0;
    if (mileage < 100 && condition === 'used') condition = 'new';

    var msrp = parseFloat(getValue('msrp').replace(/[$,]/g, '')) || 0;
    var sellingPrice = parseFloat(getValue('sellingPrice').replace(/[$,]/g, '')) || 0;
    if (!msrp && sellingPrice) msrp = sellingPrice;

    vehicles.push({
      stockNumber: stockNumber, vin: getValue('vin') || '', year: yearVal,
      make: make.toUpperCase(), model: model.toUpperCase(), trim: getValue('trim') || '',
      msrp: msrp, sellingPrice: sellingPrice, invoice: parseFloat(getValue('invoice').replace(/[$,]/g, '')) || 0,
      mileage: mileage, exteriorColor: getValue('exteriorColor') || '', interiorColor: getValue('interiorColor') || '',
      condition: condition, daysInStock: parseInt(getValue('daysInStock')) || 0,
      location: getValue('location') || '', notes: getValue('notes') || ''
    });
  }
  return vehicles;
}

function saveInventoryToSheet(vehicles) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(INVENTORY_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(INVENTORY_SHEET_NAME);
  }
  sheet.clear();

  var headers = ['Stock #', 'VIN', 'Year', 'Make', 'Model', 'Trim', 'MSRP', 'Selling Price',
    'Invoice', 'Mileage', 'Ext Color', 'Int Color', 'Condition', 'Days In Stock', 'Location', 'Notes'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#4472C4').setFontColor('white');

  if (vehicles.length > 0) {
    var data = vehicles.map(function(v) {
      return [v.stockNumber, v.vin, v.year, v.make, v.model, v.trim,
        v.msrp, v.sellingPrice, v.invoice, v.mileage,
        v.exteriorColor, v.interiorColor, v.condition, v.daysInStock, v.location, v.notes];
    });
    sheet.getRange(2, 1, data.length, headers.length).setValues(data);
    sheet.getRange(2, 7, data.length, 3).setNumberFormat('$#,##0');
    sheet.getRange(2, 10, data.length, 1).setNumberFormat('#,##0');
  }
  sheet.autoResizeColumns(1, headers.length);
  return vehicles.length;
}

function getInventoryFromSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(INVENTORY_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 16).getValues();
  return data.filter(function(r) { return r[0]; }).map(function(r) {
    return {
      stockNumber: String(r[0]), vin: String(r[1]), year: Number(r[2]),
      make: String(r[3]), model: String(r[4]), trim: String(r[5]),
      msrp: Number(r[6]), sellingPrice: Number(r[7]), invoice: Number(r[8]),
      mileage: Number(r[9]), exteriorColor: String(r[10]), interiorColor: String(r[11]),
      condition: String(r[12]), daysInStock: Number(r[13]),
      location: String(r[14]), notes: String(r[15])
    };
  });
}

function searchInventorySheet(query) {
  var vehicles = getInventoryFromSheet();
  var q = query.toLowerCase();
  return vehicles.filter(function(v) {
    return v.stockNumber.toLowerCase().indexOf(q) >= 0 ||
      v.make.toLowerCase().indexOf(q) >= 0 ||
      v.model.toLowerCase().indexOf(q) >= 0 ||
      (v.vin && v.vin.toLowerCase().indexOf(q) >= 0);
  });
}

function getInventoryStats() {
  var vehicles = getInventoryFromSheet();
  var byMake = {};
  var newCount = 0, usedCount = 0, certCount = 0;
  var totalValue = 0;
  for (var i = 0; i < vehicles.length; i++) {
    var v = vehicles[i];
    byMake[v.make] = (byMake[v.make] || 0) + 1;
    if (v.condition === 'new') newCount++;
    else if (v.condition === 'certified') certCount++;
    else usedCount++;
    totalValue += v.msrp || v.sellingPrice || 0;
  }
  return {
    total: vehicles.length, newCount: newCount, usedCount: usedCount,
    certifiedCount: certCount, byMake: byMake, totalValue: totalValue,
    averagePrice: vehicles.length > 0 ? Math.round(totalValue / vehicles.length) : 0
  };
}

function clearInventorySheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(INVENTORY_SHEET_NAME);
  if (sheet) ss.deleteSheet(sheet);
}
