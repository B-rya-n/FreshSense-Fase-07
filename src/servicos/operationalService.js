import { getCommittedQuantity } from "../paginas/destinacao/modelo/destinationModel.js";

export function getLotRelations(lotId, destinations = [], decisions = []) {
  return {
    destinations: destinations.filter((item) => item.lotId === lotId),
    decisions: decisions.filter((item) => item.lotId === lotId),
  };
}

export function canDeleteLot(lotId, destinations = [], decisions = []) {
  const relations = getLotRelations(lotId, destinations, decisions);
  return {
    allowed: !relations.destinations.length && !relations.decisions.length,
    ...relations,
  };
}

export function getOperationalAvailability(lot, destinations = []) {
  const committed = getCommittedQuantity(destinations, lot?.id);
  const total = Number(lot?.weight || 0);
  return {
    total,
    committed,
    available: Math.max(0, total - committed),
  };
}

export function buildOperationalEvent({
  type,
  lotId,
  title,
  detail,
  entityId,
  status = "registrado",
  now = new Date(),
}) {
  return {
    id: `OP-${now.getTime().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    type,
    lotId,
    title,
    detail,
    entityId,
    status,
    createdAt: now.toISOString(),
  };
}
