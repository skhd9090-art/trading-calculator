/**
 * Deterministic Trade Calculation Core
 * Excludes fees, funding, slippage, and exchange-specific liquidation rules.
 */

export function expandRange(a, b, count = null) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
    throw new Error('Range endpoints must be finite positive prices.');
  }
  if (count == null) return [a, b];
  if (!Number.isInteger(count) || count < 2) {
    throw new Error('Entry count must be an integer >= 2.');
  }
  return Array.from({ length: count }, (_, i) => a + (i * (b - a)) / (count - 1));
}

export function equalAllocations(count) {
  if (!Number.isInteger(count) || count < 1) throw new Error('Entry count must be >= 1.');
  return Array.from({ length: count }, () => 100 / count);
}

export function validateAllocations(percentages, tolerance = 1e-6) {
  if (!Array.isArray(percentages) || percentages.length === 0) return false;
  if (percentages.some(p => !Number.isFinite(p) || p < 0 || p > 100)) return false;
  return Math.abs(percentages.reduce((a, b) => a + b, 0) - 100) <= tolerance;
}

export function validateTrade({
  direction,
  entries,
  stopLoss,
  leverage,
  riskBudget,
  fixedSize,
  allocationBasis = 'notional',
  sizingMethod = 'risk'
}) {
  const errors = [];
  if (!['long', 'short'].includes(direction)) errors.push('Direction must be Long or Short.');
  if (!Array.isArray(entries) || entries.length === 0) errors.push('At least one entry is required.');
  if (entries.some(e => !Number.isFinite(e.price) || e.price <= 0)) errors.push('Every entry must have a positive price.');
  if (!Number.isFinite(stopLoss) || stopLoss <= 0) errors.push('Stop loss must be a positive price.');
  if (!Number.isFinite(leverage) || leverage <= 0) errors.push('Leverage must be greater than zero.');
  if (!['notional', 'quantity'].includes(allocationBasis)) errors.push('Choose a valid allocation basis (notional or quantity).');
  if (!['risk', 'fixed'].includes(sizingMethod)) errors.push('Choose a valid sizing method (risk or fixed).');
  if (sizingMethod === 'risk' && (!Number.isFinite(riskBudget) || riskBudget <= 0)) errors.push('Risk budget must be greater than zero.');
  if (sizingMethod === 'fixed' && (!Number.isFinite(fixedSize) || fixedSize <= 0)) errors.push('Fixed position size must be greater than zero.');
  
  if (entries.some(e => !Number.isFinite(e.allocationPercent) || e.allocationPercent < 0 || e.allocationPercent > 100)) {
    errors.push('Allocations must be between 0% and 100%.');
  }
  const allocationSum = entries.reduce((sum, e) => sum + (Number.isFinite(e.allocationPercent) ? e.allocationPercent : 0), 0);
  if (Math.abs(allocationSum - 100) > 1e-4) {
    errors.push(`Entry allocations total ${allocationSum.toFixed(2)}%; they must total 100%.`);
  }

  if (Number.isFinite(stopLoss) && entries.every(e => Number.isFinite(e.price) && e.price > 0)) {
    const wrongSide = entries.some(e => (direction === 'long' ? stopLoss >= e.price : stopLoss <= e.price));
    if (wrongSide) {
      errors.push(
        direction === 'long'
          ? 'Stop loss must be strictly below every entry for a Long position.'
          : 'Stop loss must be strictly above every entry for a Short position.'
      );
    }
  }

  return { valid: errors.length === 0, errors, allocationSum };
}

export function calculatePosition({
  direction,
  entries,
  stopLoss,
  leverage,
  riskBudget,
  fixedSize,
  allocationBasis = 'notional',
  sizingMethod = 'risk'
}) {
  const check = validateTrade({
    direction,
    entries,
    stopLoss,
    leverage,
    riskBudget,
    fixedSize,
    allocationBasis,
    sizingMethod
  });
  if (!check.valid) throw new Error(check.errors.join(' '));

  const baseEntries = entries.map(e => ({
    ...e,
    weight: e.allocationPercent / 100,
    distance: direction === 'long' ? e.price - stopLoss : stopLoss - e.price
  }));

  let totalNotional;
  let totalQuantity;

  if (sizingMethod === 'risk') {
    if (allocationBasis === 'notional') {
      const riskPerUnitNotional = baseEntries.reduce((sum, e) => sum + (e.weight * e.distance) / e.price, 0);
      if (!(riskPerUnitNotional > 0)) throw new Error('Unable to size position from this risk budget.');
      totalNotional = riskBudget / riskPerUnitNotional;
      totalQuantity = baseEntries.reduce((sum, e) => sum + (totalNotional * e.weight) / e.price, 0);
    } else {
      const riskPerTotalQuantity = baseEntries.reduce((sum, e) => sum + e.weight * e.distance, 0);
      if (!(riskPerTotalQuantity > 0)) throw new Error('Unable to size position from this risk budget.');
      totalQuantity = riskBudget / riskPerTotalQuantity;
      totalNotional = baseEntries.reduce((sum, e) => sum + totalQuantity * e.weight * e.price, 0);
    }
  } else {
    if (allocationBasis === 'notional') {
      totalNotional = fixedSize;
      totalQuantity = baseEntries.reduce((sum, e) => sum + (totalNotional * e.weight) / e.price, 0);
    } else {
      totalQuantity = fixedSize;
      totalNotional = baseEntries.reduce((sum, e) => sum + totalQuantity * e.weight * e.price, 0);
    }
  }

  const planned = baseEntries.map(e => {
    let notional, quantity;
    if (allocationBasis === 'notional') {
      notional = totalNotional * e.weight;
      quantity = notional / e.price;
    } else {
      quantity = totalQuantity * e.weight;
      notional = quantity * e.price;
    }
    const stopLossRisk = quantity * e.distance;
    return {
      ...e,
      notional,
      quantity,
      stopLossRisk
    };
  });

  const plannedTotalNotional = planned.reduce((s, e) => s + e.notional, 0);
  const plannedTotalQuantity = planned.reduce((s, e) => s + e.quantity, 0);
  const averageEntry = plannedTotalQuantity > 0 ? plannedTotalNotional / plannedTotalQuantity : null;

  return {
    entries: planned,
    totalNotional: plannedTotalNotional,
    totalQuantity: plannedTotalQuantity,
    averageEntry,
    estimatedMargin: plannedTotalNotional / leverage,
    totalStopLossRisk: planned.reduce((s, e) => s + e.stopLossRisk, 0),
    assumptions: ['Gross estimates; excludes fees, funding, slippage, and exchange liquidation rules.']
  };
}

export function calculateScenario({ plannedEntries, scenario = 'filled', leverage = 1 }) {
  if (!Array.isArray(plannedEntries) || plannedEntries.length === 0) {
    return {
      entries: [],
      scenarioQty: 0,
      scenarioNotional: 0,
      scenarioRisk: 0,
      averageEntry: null,
      estimatedMargin: 0
    };
  }

  const activeEntries = plannedEntries.filter(e => scenario === 'all' || e.filled);
  const scenarioQty = activeEntries.reduce((s, e) => s + e.quantity, 0);
  const scenarioNotional = activeEntries.reduce((s, e) => s + e.notional, 0);
  const scenarioRisk = activeEntries.reduce((s, e) => s + e.stopLossRisk, 0);
  const averageEntry = scenarioQty > 0 ? activeEntries.reduce((s, e) => s + e.quantity * e.price, 0) / scenarioQty : null;
  const estimatedMargin = Number.isFinite(leverage) && leverage > 0 ? scenarioNotional / leverage : 0;

  return {
    entries: activeEntries,
    scenarioQty,
    scenarioNotional,
    scenarioRisk,
    averageEntry,
    estimatedMargin
  };
}

export function calculateTargetPnl({ direction, entries, targetPrice }) {
  if (!['long', 'short'].includes(direction)) throw new Error('Direction must be long or short.');
  if (!Array.isArray(entries) || entries.length === 0) return 0;
  if (!Number.isFinite(targetPrice) || targetPrice <= 0) throw new Error('Target price must be positive.');
  return entries.reduce(
    (sum, e) => sum + e.quantity * (direction === 'long' ? targetPrice - e.price : e.price - targetPrice),
    0
  );
}

export function calculatePartialExitPnl({ targetRows }) {
  if (!Array.isArray(targetRows) || targetRows.length === 0) return null;
  const exitsValid =
    targetRows.every(t => t.exitPercent != null && Number.isFinite(t.exitPercent) && t.exitPercent >= 0) &&
    Math.abs(targetRows.reduce((s, t) => s + t.exitPercent, 0) - 100) < 1e-4;
  if (!exitsValid) return null;
  return targetRows.reduce((s, t) => s + (t.pnl ?? 0) * (t.exitPercent / 100), 0);
}

export function distributeEqualExits(targets) {
  if (!Array.isArray(targets) || targets.length === 0) return [];
  const count = targets.length;
  const base = Math.floor((100 / count) * 100) / 100;
  const remainder = Number((100 - base * count).toFixed(2));
  return targets.map((t, idx) => {
    const alloc = idx === count - 1 ? Number((base + remainder).toFixed(2)) : base;
    return {
      ...t,
      exit: alloc.toString()
    };
  });
}

/**
 * Generates layered limit orders for an entry across a price range with Equal Risk Budget.
 */
export function createLayeredAllocations({
  startPrice,
  endPrice,
  count,
  parentAllocation,
  stopLoss,
  direction,
  allocationBasis = 'notional'
}) {
  if (!Number.isFinite(startPrice) || startPrice <= 0 || !Number.isFinite(endPrice) || endPrice <= 0) {
    throw new Error('Layer start and end prices must be positive numbers.');
  }
  if (startPrice === endPrice) {
    throw new Error('Layer start and end prices must be different.');
  }
  if (!Number.isInteger(count) || count < 2 || count > 10) {
    throw new Error('Layer count must be between 2 and 10.');
  }
  if (!Number.isFinite(parentAllocation) || parentAllocation <= 0) {
    throw new Error('Parent allocation must be positive.');
  }

  const rawPrices = expandRange(Math.min(startPrice, endPrice), Math.max(startPrice, endPrice), count);
  
  // Sort descending for Long (highest entry / front-run first down to deepest limit)
  // Sort ascending for Short (lowest entry / front-run first up to deepest limit)
  const sortedPrices = direction === 'long'
    ? [...rawPrices].sort((a, b) => b - a)
    : [...rawPrices].sort((a, b) => a - b);

  const hasValidStopLoss = Number.isFinite(stopLoss) && stopLoss > 0 &&
    (direction === 'long' ? sortedPrices.every(p => p > stopLoss) : sortedPrices.every(p => p < stopLoss));

  if (!hasValidStopLoss) {
    const equalShare = parentAllocation / count;
    return sortedPrices.map((price) => ({
      price: price.toString(),
      allocation: equalShare.toFixed(2),
      filled: false
    }));
  }

  // Equal Risk Budget Math
  const distances = sortedPrices.map(p => direction === 'long' ? p - stopLoss : stopLoss - p);
  
  let weights;
  if (allocationBasis === 'notional') {
    const notionalFactors = sortedPrices.map((p, i) => p / distances[i]);
    const sumFactors = notionalFactors.reduce((a, b) => a + b, 0);
    weights = notionalFactors.map(f => f / sumFactors);
  } else {
    const qtyFactors = distances.map(d => 1 / d);
    const sumFactors = qtyFactors.reduce((a, b) => a + b, 0);
    weights = qtyFactors.map(f => f / sumFactors);
  }

  const allocations = weights.map(w => w * parentAllocation);
  let rounded = allocations.map(a => Number(a.toFixed(2)));
  const diff = Number((parentAllocation - rounded.reduce((a, b) => a + b, 0)).toFixed(2));
  rounded[rounded.length - 1] = Number((rounded[rounded.length - 1] + diff).toFixed(2));

  return sortedPrices.map((price, i) => ({
    price: price.toString(),
    allocation: rounded[i].toFixed(2),
    filled: false
  }));
}

