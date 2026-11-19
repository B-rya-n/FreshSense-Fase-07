export const recallSeverity = Object.freeze({
  critica: "Crítica",
  alta: "Alta",
  moderada: "Moderada",
});

export const recallStatus = Object.freeze({
  aberto: "Aberto",
  "em-contencao": "Em contenção",
  encerrado: "Encerrado",
});

const defaultTasks = Object.freeze([
  {
    code: "bloqueio",
    title: "Confirmar bloqueio de novas destinações",
    owner: "Operação",
  },
  {
    code: "notificacao",
    title: "Notificar responsáveis pelas operações afetadas",
    owner: "Qualidade",
  },
  {
    code: "segregacao",
    title: "Confirmar segregação física ou logística do lote",
    owner: "Logística",
  },
  {
    code: "avaliacao",
    title: "Registrar avaliação técnica e decisão de encerramento",
    owner: "Qualidade",
  },
]);

function createId(prefix, now = new Date()) {
  const random = globalThis.crypto?.randomUUID?.().slice(0, 6).toUpperCase();
  return `${prefix}-${now.getTime().toString(36).toUpperCase()}-${random ?? Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function toIso(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function isOpenRecall(recall) {
  return recall?.status !== "encerrado";
}

export function getAffectedDestinations(lotId, destinations = []) {
  return destinations.filter(
    (destination) =>
      destination.lotId === lotId && destination.status !== "cancelada",
  );
}

export function validateRecall(values, lot, recalls = []) {
  const errors = {};
  const explanation = String(values?.explanation ?? "").trim();
  const responsible = String(values?.responsible ?? "").trim();

  if (!lot) errors.lotId = "Selecione um lote para recolhimento.";
  if (!values?.reason) errors.reason = "Selecione o motivo do recolhimento.";
  if (!recallSeverity[values?.severity]) {
    errors.severity = "Selecione a severidade do incidente.";
  }
  if (explanation.length < 12) {
    errors.explanation = "Descreva o incidente com pelo menos 12 caracteres.";
  } else if (explanation.length > 360) {
    errors.explanation = "Use no máximo 360 caracteres.";
  }
  if (responsible.split(/\s+/).filter(Boolean).length < 2) {
    errors.responsible = "Informe nome e sobrenome do responsável.";
  }
  if (
    lot &&
    recalls.some((recall) => recall.lotId === lot.id && isOpenRecall(recall))
  ) {
    errors.lotId = "Este lote já possui um recolhimento em andamento.";
  }
  return errors;
}

export function createRecall(values, lot, destinations = [], now = new Date()) {
  const affected = getAffectedDestinations(lot.id, destinations);
  const createdAt = now.toISOString();
  return {
    id: createId("REC", now),
    lotId: lot.id,
    lotSnapshot: {
      product: lot.product,
      origin: lot.origin,
      location: lot.location,
      weight: Number(lot.weight) || 0,
    },
    reason: values.reason,
    severity: values.severity,
    explanation: String(values.explanation).trim(),
    responsible: String(values.responsible).trim(),
    status: "aberto",
    createdAt,
    updatedAt: createdAt,
    affectedDestinationIds: affected.map((destination) => destination.id),
    tasks: defaultTasks.map((task) => ({
      id: `${task.code}-${createId("TASK", now)}`,
      ...task,
      completed: false,
      completedAt: null,
    })),
    resolution: null,
  };
}

export function toggleRecallTask(recall, taskId, now = new Date()) {
  if (!recall || !isOpenRecall(recall)) return recall;
  const tasks = recall.tasks.map((task) =>
    task.id !== taskId
      ? task
      : {
          ...task,
          completed: !task.completed,
          completedAt: task.completed ? null : now.toISOString(),
        },
  );
  const allComplete = tasks.every((task) => task.completed);
  return {
    ...recall,
    tasks,
    status: allComplete ? "em-contencao" : "aberto",
    updatedAt: now.toISOString(),
  };
}

export function validateRecallClosure(recall, resolution) {
  const errors = {};
  const detail = String(resolution ?? "").trim();
  if (!recall?.tasks?.every((task) => task.completed)) {
    errors.tasks = "Conclua todas as tarefas de contenção antes de encerrar.";
  }
  if (detail.length < 12) {
    errors.resolution = "Registre a resolução com pelo menos 12 caracteres.";
  } else if (detail.length > 360) {
    errors.resolution = "Use no máximo 360 caracteres.";
  }
  return errors;
}

export function closeRecall(recall, resolution, now = new Date()) {
  return {
    ...recall,
    status: "encerrado",
    updatedAt: now.toISOString(),
    closedAt: now.toISOString(),
    resolution: String(resolution).trim(),
  };
}

export function isPersistedRecall(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    typeof value.lotId === "string" &&
    typeof value.reason === "string" &&
    recallSeverity[value.severity] &&
    recallStatus[value.status] &&
    toIso(value.createdAt) &&
    Array.isArray(value.tasks) &&
    value.tasks.every(
      (task) =>
        task &&
        typeof task.id === "string" &&
        typeof task.title === "string" &&
        typeof task.completed === "boolean",
    ),
  );
}
