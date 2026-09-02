// ============================================================================
// VEHICLE MANAGER
// MSRP estimation, vehicle class, book value estimation with depreciation
// ============================================================================

function estimateBookValues(year, make, model, mileage, condition) {
  var currentYear = new Date().getFullYear();
  var age = currentYear - year;
  var baseMSRP = getEstimatedMSRP(make, model);
  var depreciation = 0;
  if (age >= 1) depreciation += 0.2;
  if (age >= 2) depreciation += 0.15;
  if (age >= 3) depreciation += 0.15;
  if (age >= 4) depreciation += 0.1 * (age - 3);
  var expectedMileage = age * 12000;
  var mileageDiff = mileage - expectedMileage;
  var mileageAdjustment = (mileageDiff / 10000) * 0.02;
  var conditionFactors = { excellent: 1.05, good: 1.0, fair: 0.92, poor: 0.8 };
  var condFactor = conditionFactors[condition] || 1.0;
  var baseValue = baseMSRP * (1 - depreciation - mileageAdjustment);
  var adjustedValue = baseValue * condFactor;
  return {
    retail: Math.round(adjustedValue * 1.1),
    wholesale: Math.round(adjustedValue * 0.95),
    nada: Math.round(adjustedValue),
    kbb: Math.round(adjustedValue * 0.98),
    blackBook: Math.round(adjustedValue * 0.97)
  };
}

function determineVehicleClass(make, model) {
  var m = model.toLowerCase();
  var trucks = /sierra|silverado|f-150|f150|f-250|tundra|titan|ram|tacoma|colorado|canyon|ranger|frontier|ridgeline|gladiator/;
  if (trucks.test(m)) return 'truck';
  var fullsize = /yukon|tahoe|suburban|expedition|sequoia|armada/;
  if (fullsize.test(m)) return 'fullsize';
  var suvs = /acadia|terrain|enclave|envision|encore|traverse|equinox|blazer|trax|pilot|cr-v|hr-v|passport|highlander|rav4|4runner|explorer|escape|edge|bronco|rogue|pathfinder|murano|santa fe|tucson|palisade|kona|sorento|sportage|telluride|seltos|cherokee|compass|wrangler|durango|outback|forester|crosstrek|ascent|cx-5|cx5|cx-9|cx9|tiguan|atlas/;
  if (suvs.test(m)) return 'suv';
  var vans = /odyssey|sienna|pacifica|savana|express|transit|caravan/;
  if (vans.test(m)) return 'van';
  var sports = /camaro|mustang|charger|challenger|corvette/;
  if (sports.test(m)) return 'sports';
  var midsize = /malibu|accord|camry|altima|sonata|optima|k5|legacy|mazda6|passat|lacrosse|regal/;
  if (midsize.test(m)) return 'midsize';
  var compact = /civic|corolla|sentra|elantra|forte|impreza|mazda3|jetta/;
  if (compact.test(m)) return 'compact';
  return 'midsize';
}
