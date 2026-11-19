export const destinationTypes = Object.freeze({
  doacao: "Doação",
  venda: "Venda prioritária",
  desconto: "Aplicação de desconto",
  transferencia: "Transferência entre unidades",
});

export const recipientTypesByDestination = Object.freeze({
  doacao: ["Banco de alimentos", "Organização social", "Cozinha comunitária"],
  venda: ["Ponto de venda"],
  desconto: ["Ponto de venda"],
  transferencia: ["Unidade FreshSense"],
});

export const destinationStatus = Object.freeze({
  pendente: "Pendente",
  aprovada: "Aprovada",
  transporte: "Em transporte",
  concluida: "Concluída",
  cancelada: "Cancelada",
});

export const institutions = [
  {
    id: "INS-01",
    name: "Banco de Alimentos de São Paulo",
    city: "São Paulo - SP",
    type: "Banco de alimentos",
  },
  {
    id: "INS-02",
    name: "Rede Solidária do Alto Tietê",
    city: "Suzano - SP",
    type: "Organização social",
  },
  {
    id: "INS-03",
    name: "Cozinha Comunitária Esperança",
    city: "Mogi das Cruzes - SP",
    type: "Cozinha comunitária",
  },
  {
    id: "UNI-01",
    name: "Centro de Distribuição Campinas",
    city: "Campinas - SP",
    type: "Unidade FreshSense",
  },
  {
    id: "VAR-01",
    name: "FreshMarket Pinheiros",
    city: "São Paulo - SP",
    type: "Ponto de venda",
  },
];

export const initialDestinations = [
  {
    id: "DST-2401",
    lotId: "LT-1038",
    product: "Morango",
    type: "doacao",
    quantity: 60,
    unit: "kg",
    recipientId: "INS-02",
    recipientType: "Organização social",
    recipient: "Rede Solidária do Alto Tietê",
    responsible: "Marina Costa",
    pickupDate: "2026-10-08",
    notes: "Retirada refrigerada após liberação da equipe de qualidade.",
    status: "concluida",
    createdAt: "28/09/2026 10:40",
    origin: "Atibaia - SP",
    history: [
      { status: "pendente", date: "28/09/2026 10:40" },
      { status: "aprovada", date: "28/09/2026 11:15" },
      { status: "transporte", date: "30/09/2026 08:30" },
      { status: "concluida", date: "01/10/2026 09:20" },
    ],
    completedAt: "01/10/2026 09:20",
    completedQuantity: 60,
    confirmedBy: "Marina Costa",
    completionNotes: "Recebimento confirmado pela instituição parceira.",
  },
  {
    id: "DST-2402",
    lotId: "LT-1042",
    product: "Tomate",
    type: "venda",
    quantity: 150,
    unit: "kg",
    recipientId: "VAR-01",
    recipientType: "Ponto de venda",
    recipient: "FreshMarket Pinheiros",
    responsible: "Lucas Mendes",
    pickupDate: "2026-10-03",
    notes: "Venda prioritária concluída após conferência da expedição.",
    status: "concluida",
    createdAt: "29/09/2026 14:10",
    origin: "Jundiaí - SP",
    history: [
      { status: "pendente", date: "29/09/2026 14:10" },
      { status: "aprovada", date: "29/09/2026 15:00" },
      { status: "transporte", date: "02/10/2026 07:40" },
      { status: "concluida", date: "03/10/2026 10:05" },
    ],
    completedAt: "03/10/2026 10:05",
    completedQuantity: 150,
    confirmedBy: "Lucas Mendes",
    completionNotes: "Conferência de entrega concluída no ponto de venda.",
  },
  {
    id: "DST-2403",
    lotId: "LT-1031",
    product: "Alface",
    type: "transferencia",
    quantity: 120,
    unit: "kg",
    recipientId: "UNI-01",
    recipientType: "Unidade FreshSense",
    recipient: "Centro de Distribuição Campinas",
    responsible: "Renata Lima",
    pickupDate: "2026-10-05",
    notes: "Transferência concluída para recomposição de estoque da unidade.",
    status: "concluida",
    createdAt: "01/10/2026 09:00",
    origin: "Suzano - SP",
    history: [
      { status: "pendente", date: "01/10/2026 09:00" },
      { status: "aprovada", date: "01/10/2026 09:25" },
      { status: "transporte", date: "04/10/2026 06:50" },
      { status: "concluida", date: "05/10/2026 11:30" },
    ],
    completedAt: "05/10/2026 11:30",
    completedQuantity: 120,
    confirmedBy: "Renata Lima",
    completionNotes: "Saldo confirmado pela unidade de destino.",
  },
];

const allowedTransitions = Object.freeze({
  pendente: ["aprovada", "cancelada"],
  aprovada: ["transporte", "cancelada"],
  transporte: ["concluida", "cancelada"],
  concluida: [],
  cancelada: [],
});

export function getLotQuantity(lot) {
  return Number(lot?.weight ?? lot?.quantity ?? 0);
}

export function getLotUnit(lot) {
  return lot?.unit ?? "kg";
}

export function getEligibleInstitutions(type, list = institutions) {
  const allowed = recipientTypesByDestination[type] ?? [];
  return list.filter((institution) => allowed.includes(institution.type));
}

export function isEligibleRecipient(type, institution) {
  return Boolean(
    institution &&
    recipientTypesByDestination[type]?.includes(institution.type),
  );
}

export function getCommittedQuantity(destinations, lotId) {
  return destinations
    .filter((item) => item.lotId === lotId && item.status !== "cancelada")
    .reduce((total, item) => total + Number(item.quantity || 0), 0);
}

export function getAvailableQuantity(lot, destinations = []) {
  if (!lot) return 0;
  return Math.max(
    0,
    getLotQuantity(lot) - getCommittedQuantity(destinations, lot.id),
  );
}

export function suggestDestination(lot) {
  if (!lot) return null;

  if (lot.risk === "alto") {
    return {
      type: "doacao",
      title: "Priorizar destinação após liberação da qualidade",
      reason:
        "O desvio exige resposta rápida; a doação só deve seguir após inspeção e liberação sanitária.",
    };
  }

  if (lot.risk === "medio") {
    return {
      type: "desconto",
      title: "Antecipar a saída comercial do lote",
      reason:
        "A condição requer atenção e um desconto pode acelerar o giro antes da perda de qualidade.",
    };
  }

  return {
    type: "transferencia",
    title: "Rebalancear o estoque entre unidades",
    reason:
      "O lote está estável e pode atender uma unidade com maior demanda sem comprometer a qualidade.",
  };
}

export function validateDestination(values, lot, availableQuantity, recipient) {
  const errors = {};
  const quantity = Number(values.quantity);
  const available = Number.isFinite(availableQuantity)
    ? availableQuantity
    : getLotQuantity(lot);

  if (!lot) errors.lotId = "Selecione um lote.";
  if (!values.type) errors.type = "Escolha uma forma de destinação.";
  if (!Number.isFinite(quantity) || quantity <= 0) {
    errors.quantity = "Informe uma quantidade maior que zero.";
  } else if (lot && quantity > available) {
    errors.quantity = `A quantidade máxima disponível é ${available.toLocaleString("pt-BR")} ${getLotUnit(lot)}.`;
  }
  if (!values.recipient) {
    errors.recipient = "Selecione o destino do lote.";
  } else if (!recipient || !isEligibleRecipient(values.type, recipient)) {
    errors.recipient =
      "Escolha um destino compatível com a forma de destinação.";
  }
  if (
    String(values.responsible ?? "")
      .trim()
      .split(/\s+/).length < 2
  ) {
    errors.responsible = "Informe o nome e o sobrenome do responsável.";
  }
  if (!values.pickupDate) {
    errors.pickupDate = "Informe a data prevista.";
  } else {
    const selected = new Date(`${values.pickupDate}T12:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(selected.getTime()) || selected < today) {
      errors.pickupDate = "A data não pode estar no passado.";
    }
  }
  if (String(values.notes ?? "").length > 240) {
    errors.notes = "Use no máximo 240 caracteres.";
  }

  return errors;
}

export function createDestination(values, lot, recipient, now = new Date()) {
  const stamp = now.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const uniqueToken =
    globalThis.crypto?.randomUUID?.().slice(0, 8).toUpperCase() ??
    Math.random().toString(36).slice(2, 10).toUpperCase();

  return {
    id: `DST-${now.getTime().toString(36).toUpperCase()}-${uniqueToken}`,
    lotId: lot.id,
    product: lot.product,
    type: values.type,
    quantity: Number(values.quantity),
    unit: getLotUnit(lot),
    recipient: typeof recipient === "string" ? recipient : recipient.name,
    ...(typeof recipient === "string"
      ? {}
      : { recipientId: recipient.id, recipientType: recipient.type }),
    responsible: values.responsible.trim(),
    pickupDate: values.pickupDate,
    notes: values.notes.trim(),
    status: "pendente",
    createdAt: stamp,
    origin: lot.origin,
    history: [{ status: "pendente", date: stamp }],
  };
}

export function advanceDestination(destination, nextStatus, now = new Date()) {
  if (!allowedTransitions[destination.status]?.includes(nextStatus)) {
    return destination;
  }

  const date = now.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return {
    ...destination,
    status: nextStatus,
    history: [...destination.history, { status: nextStatus, date }],
    ...(nextStatus === "concluida" ? { completedAt: date } : {}),
  };
}

export function validateDestinationCompletion(values, destination) {
  const errors = {};
  const quantity = Number(values.completedQuantity);
  const planned = Number(destination?.quantity);

  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > planned) {
    errors.completedQuantity = `Informe uma quantidade entre 0 e ${planned.toLocaleString("pt-BR")} ${destination?.unit || "kg"}.`;
  }
  if (
    String(values.confirmedBy ?? "")
      .trim()
      .split(/\s+/).length < 2
  ) {
    errors.confirmedBy = "Informe o nome e o sobrenome de quem confirmou.";
  }
  const notes = String(values.completionNotes ?? "").trim();
  if (notes.length > 240) {
    errors.completionNotes = "Use no máximo 240 caracteres.";
  } else if (quantity < planned && !notes) {
    errors.completionNotes =
      "Explique a divergência entre a quantidade planejada e a confirmada.";
  }
  return errors;
}

export function completeDestination(destination, values, now = new Date()) {
  const errors = validateDestinationCompletion(values, destination);
  if (Object.keys(errors).length) return { destination, errors };

  const completed = advanceDestination(destination, "concluida", now);
  return {
    destination: {
      ...completed,
      completedQuantity: Number(values.completedQuantity),
      confirmedBy: values.confirmedBy.trim(),
      completionNotes: String(values.completionNotes ?? "").trim(),
    },
    errors: {},
  };
}

export function getCompletedQuantity(destination) {
  const quantity = Number(destination?.completedQuantity);
  return Number.isFinite(quantity) && quantity > 0
    ? quantity
    : Number(destination?.quantity) || 0;
}

export function getDestinationDueState(destination, now = new Date()) {
  if (["concluida", "cancelada"].includes(destination?.status)) {
    return { state: "encerrada", label: "Operação encerrada" };
  }
  const due = new Date(`${destination?.pickupDate}T12:00:00`);
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (!Number.isFinite(days))
    return { state: "sem-prazo", label: "Prazo não informado" };
  if (days < 0) {
    const overdue = Math.abs(days);
    return {
      state: "atrasada",
      label: `Atrasada há ${overdue} ${overdue === 1 ? "dia" : "dias"}`,
    };
  }
  if (days === 0) return { state: "hoje", label: "Vence hoje" };
  if (days <= 2)
    return {
      state: "proxima",
      label: days === 1 ? "Vence amanhã" : `Vence em ${days} dias`,
    };
  return { state: "regular", label: "No prazo" };
}

export function formatDestinationVolume(
  destinations = [],
  locale = "pt-BR",
  { confirmed = false } = {},
) {
  const totals = new Map();

  destinations.forEach((destination) => {
    const quantity = confirmed
      ? getCompletedQuantity(destination)
      : Number(destination.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return;

    const unit = destination.unit || "kg";
    totals.set(unit, (totals.get(unit) ?? 0) + quantity);
  });

  if (!totals.size) return `0 kg`;

  return [...totals.entries()]
    .map(([unit, amount]) => `${amount.toLocaleString(locale)} ${unit}`)
    .join(" + ");
}

export function getNextDestinationStatus(currentStatus) {
  return (
    allowedTransitions[currentStatus]?.find(
      (status) => status !== "cancelada",
    ) ?? null
  );
}

export function formatPickupDate(value, locale = "pt-BR") {
  return new Intl.DateTimeFormat(locale).format(new Date(`${value}T12:00:00`));
}
