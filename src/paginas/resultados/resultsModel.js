import {
  getAvailableQuantity,
  getCompletedQuantity,
  getDestinationDueState,
} from "../destinacao/modelo/destinationModel.js";

// Existing records store creation dates in pt-BR. Compare calendar dates,
// avoiding UTC conversion and keeping both boundary days inclusive.
export function creationDay(value) {
  const text = String(value ?? "");
  const brazilian = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brazilian) return `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}`;
  return text.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
}

export function completionDay(destination) {
  if (destination?.status !== "concluida") return "";

  const completedAt =
    destination.completedAt ??
    destination.history?.find((entry) => entry.status === "concluida")?.date;

  return creationDay(completedAt);
}

export function reportingDay(destination) {
  return completionDay(destination) || creationDay(destination?.createdAt);
}

export function summarizeResults(
  lots,
  destinations,
  filters = {},
  now = new Date(),
) {
  const invalidPeriod = Boolean(
    filters.from && filters.to && filters.from > filters.to,
  );
  const records = invalidPeriod
    ? []
    : destinations.filter((item) => {
        const day = reportingDay(item);
        return (
          (!filters.type || item.type === filters.type) &&
          (!filters.from || (day && day >= filters.from)) &&
          (!filters.to || (day && day <= filters.to))
        );
      });
  const completed = records.filter((item) => item.status === "concluida");
  const pending = records.filter((item) =>
    ["pendente", "aprovada", "transporte"].includes(item.status),
  );
  const cancelled = records.filter((item) => item.status === "cancelada");
  const quantities = {};
  for (const item of completed) {
    const quantity = getCompletedQuantity(item);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const unit = item.unit || "kg";
    quantities[item.type] ??= {};
    quantities[item.type][unit] = (quantities[item.type][unit] || 0) + quantity;
  }
  // Attention is the current inventory, independent of the historic filters.
  const attention = lots
    .filter((lot) => ["alto", "medio"].includes(lot.risk))
    .map((lot) => ({
      ...lot,
      available: getAvailableQuantity(lot, destinations),
    }))
    .filter((lot) => lot.available > 0)
    .sort(
      (a, b) =>
        Number(b.risk === "alto") - Number(a.risk === "alto") ||
        b.available - a.available,
    );
  const active = destinations.filter(
    (item) => !["concluida", "cancelada"].includes(item.status),
  );
  const overdue = active.filter(
    (item) => getDestinationDueState(item, now).state === "atrasada",
  );
  const dueSoon = active.filter((item) => {
    const state = getDestinationDueState(item, now).state;
    return state === "hoje" || state === "proxima";
  });
  return {
    records,
    completed,
    pending,
    cancelled,
    quantities,
    attention,
    overdue,
    dueSoon,
    invalidPeriod,
  };
}

export function formatQuantities(quantities = {}) {
  return (
    Object.entries(quantities)
      .map(
        ([unit, amount]) =>
          `${amount.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unit}`,
      )
      .join(" + ") || "Sem volume concluído"
  );
}

export function buildResultInsights(result) {
  const completedVolume = result.completed.reduce(
    (total, item) => total + getCompletedQuantity(item),
    0,
  );
  const plannedVolume = result.completed.reduce(
    (total, item) => total + Number(item.quantity || 0),
    0,
  );
  const confirmedRate = plannedVolume
    ? Math.round((completedVolume / plannedVolume) * 100)
    : 0;
  const mix = Object.keys(result.quantities).map((type) => {
    const total = Object.values(result.quantities[type]).reduce(
      (sum, quantity) => sum + Number(quantity || 0),
      0,
    );
    return {
      type,
      total,
      percentage: completedVolume
        ? Math.round((total / completedVolume) * 100)
        : 0,
    };
  });

  return {
    completedVolume,
    plannedVolume,
    confirmedRate,
    mix,
    attentionVolume: result.attention.reduce(
      (total, lot) => total + Number(lot.available || 0),
      0,
    ),
  };
}
