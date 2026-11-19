import { getAvailableQuantity } from "../../destinacao/modelo/destinationModel.js";

function sumLotWeight(lots, destinations = []) {
  return Math.round(
    lots.reduce(
      (total, lot) => total + getAvailableQuantity(lot, destinations),
      0,
    ),
  );
}

export function createScopedMetrics(
  metrics,
  facility,
  lots,
  destinations = [],
) {
  const stock = sumLotWeight(lots, destinations);
  if (!facility) return { ...metrics, stock, activeLots: lots.length };

  return {
    ...metrics,
    stock,
    production: facility.production,
    availability: Math.max(
      92,
      metrics.availability - facility.alertCount * 1.8,
    ),
    coldChainCompliance: Math.max(
      93,
      metrics.coldChainCompliance - facility.alertCount * 1.4,
    ),
    sensorCoverage: (facility.onlineSensors / facility.totalSensors) * 100,
    quality: Math.max(90, metrics.quality - facility.alertCount * 1.2),
    wasteAvoided: Math.round(metrics.wasteAvoided * facility.productionShare),
    avgResponse: metrics.avgResponse + facility.alertCount * 1.6,
    activeLots: lots.length,
    shipments: Math.max(
      1,
      Math.round(metrics.shipments * facility.productionShare),
    ),
  };
}

export function createQualityDistribution(lots) {
  const attention = lots.filter((lot) => lot.status === "atencao").length;
  const critical = lots.filter((lot) => lot.status === "critico").length;

  return {
    stable: Math.max(0, lots.length - attention - critical),
    attention,
    critical,
  };
}

export function createScopedHistory(
  history,
  facility,
  lots,
  destinations = [],
) {
  if (!facility) return history;

  const stock = sumLotWeight(lots, destinations);

  return history.map((point) => ({
    ...point,
    stock,
    production: Math.round(point.production * facility.productionShare),
    availability: Math.max(92, point.availability - facility.alertCount * 1.8),
    coldChainCompliance: Math.max(
      93,
      point.coldChainCompliance - facility.alertCount * 1.4,
    ),
    sensorCoverage: (facility.onlineSensors / facility.totalSensors) * 100,
    quality: Math.max(90, point.quality - facility.alertCount * 1.2),
    wasteAvoided: Math.round(point.wasteAvoided * facility.productionShare),
    avgResponse: point.avgResponse + facility.alertCount * 1.6,
  }));
}

export function createScopedInventory(
  inventory,
  facility,
  lots,
  destinations = [],
) {
  if (!facility) return inventory;

  const categories = [...new Set(lots.map((lot) => lot.category || "Outros"))];

  return categories.sort().map((category) => {
    const reference = inventory.find((item) => item.category === category);
    const amount = sumLotWeight(
      lots.filter((lot) => (lot.category || "Outros") === category),
      destinations,
    );
    const estimatedCapacity = Math.round(
      (reference?.capacity ?? Math.max(amount, 1)) * facility.productionShare,
    );
    const capacity = Math.max(
      estimatedCapacity,
      Math.ceil((amount * 1.15) / 100) * 100,
      100,
    );

    return {
      ...(reference ?? {
        category,
        freshness: 0,
        turnoverHours: 0,
      }),
      amount,
      capacity,
      occupancy: Math.round((amount / capacity) * 100),
    };
  });
}
