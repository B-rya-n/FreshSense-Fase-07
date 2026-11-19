import { useCallback, useMemo } from "react";
import {
  advanceDestination,
  completeDestination,
  getCommittedQuantity,
  getNextDestinationStatus,
} from "../paginas/destinacao/modelo/destinationModel";
import { applyRescueScenario } from "../paginas/resgate-carga/modelo/rescueModel";
import {
  buildOperationalEvent,
  canDeleteLot,
  getLotRelations,
} from "../servicos/operationalService";
import {
  closeRecall,
  createRecall,
  isOpenRecall,
  isPersistedRecall,
  toggleRecallTask,
  validateRecall,
  validateRecallClosure,
} from "../paginas/recolhimento/modelo/recallModel";
import { usePersistedState } from "../hooks/usePersistedState";
import { storageKeys } from "../utilitarios/browserStorage";
import { useDestinations } from "./useDestinations";
import { useLots } from "./useLots";
import { OperationsContext } from "./useOperations";
import { useRescueOperations } from "./useRescueOperations";

function isOperationalEvent(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    ["id", "type", "title", "detail", "createdAt"].every(
      (field) => typeof value[field] === "string" && value[field],
    ),
  );
}

export function OperationsProvider({ children }) {
  const { lots, addLot, updateLot, deleteLot } = useLots();
  const { destinations, addDestination, updateDestination } = useDestinations();
  const { decisions, recordDecision } = useRescueOperations();
  const [events, setEvents] = usePersistedState(
    storageKeys.operationalEvents,
    [],
    (value) => Array.isArray(value) && value.every(isOperationalEvent),
  );
  const [recalls, setRecalls] = usePersistedState(
    storageKeys.recalls,
    [],
    (value) => Array.isArray(value) && value.every(isPersistedRecall),
  );

  const appendEvent = useCallback(
    (event) => setEvents((current) => [event, ...current].slice(0, 120)),
    [setEvents],
  );

  const registerLot = useCallback(
    (lot) => {
      if (lots.some((item) => item.id === lot.id)) {
        return { ok: false, reason: "Já existe um lote com este código." };
      }
      addLot(lot);
      appendEvent(
        buildOperationalEvent({
          type: "lote-cadastrado",
          lotId: lot.id,
          entityId: lot.id,
          title: "Lote registrado",
          detail: `${lot.product} · ${lot.weight.toLocaleString("pt-BR")} kg disponibilizados para a operação.`,
        }),
      );
      return { ok: true };
    },
    [addLot, appendEvent, lots],
  );

  const reviseLot = useCallback(
    (id, lot) => {
      if (!lots.some((item) => item.id === id)) {
        return { ok: false, reason: "O lote não está mais disponível." };
      }
      const committed = getCommittedQuantity(destinations, id);
      if (Number(lot.weight) < committed) {
        return {
          ok: false,
          reason: `O peso não pode ser menor que ${committed.toLocaleString("pt-BR")} kg já comprometidos em destinações.`,
        };
      }
      updateLot(id, lot);
      appendEvent(
        buildOperationalEvent({
          type: "lote-atualizado",
          lotId: id,
          entityId: id,
          title: "Condição do lote atualizada",
          detail: `${lot.id} passou a operar com risco ${lot.risk}.`,
        }),
      );
      return { ok: true };
    },
    [appendEvent, destinations, lots, updateLot],
  );

  const removeLot = useCallback(
    (id) => {
      const check = canDeleteLot(id, destinations, decisions);
      if (!check.allowed || recalls.some((recall) => recall.lotId === id)) {
        return { ok: false, reason: "O lote possui histórico operacional." };
      }
      const lot = lots.find((item) => item.id === id);
      deleteLot(id);
      appendEvent(
        buildOperationalEvent({
          type: "lote-excluido",
          lotId: id,
          entityId: id,
          title: "Lote removido",
          detail: `${lot?.product ?? id} foi removido antes de iniciar operações dependentes.`,
        }),
      );
      return { ok: true };
    },
    [appendEvent, decisions, deleteLot, destinations, lots, recalls],
  );

  const planDestination = useCallback(
    (destination) => {
      const lot = lots.find((item) => item.id === destination.lotId);
      if (!lot) {
        return {
          ok: false,
          reason: "O saldo disponível do lote foi alterado.",
        };
      }
      if (
        recalls.some(
          (recall) => recall.lotId === lot.id && isOpenRecall(recall),
        )
      ) {
        return {
          ok: false,
          reason: "Este lote está bloqueado por um recolhimento em andamento.",
        };
      }
      const reservation = addDestination(destination, Number(lot.weight));
      if (!reservation.ok) return reservation;
      appendEvent(
        buildOperationalEvent({
          type: "destinacao-planejada",
          lotId: destination.lotId,
          entityId: destination.id,
          title: "Destinação planejada",
          detail: `${Number(destination.quantity).toLocaleString("pt-BR")} ${destination.unit} reservados para ${destination.recipient}.`,
          status: "pendente",
        }),
      );
      return { ok: true };
    },
    [addDestination, appendEvent, lots, recalls],
  );

  const openRecall = useCallback(
    (values) => {
      const lot = lots.find((item) => item.id === values.lotId);
      const errors = validateRecall(values, lot, recalls);
      if (Object.keys(errors).length) return { ok: false, errors };

      const recall = createRecall(values, lot, destinations);
      setRecalls((current) => [recall, ...current]);
      appendEvent(
        buildOperationalEvent({
          type: "recolhimento-aberto",
          lotId: lot.id,
          entityId: recall.id,
          title: "Recolhimento aberto: lote bloqueado",
          detail: `${recall.reason} · ${recall.affectedDestinationIds.length} operação(ões) de destinação afetada(s).`,
          status: "em-tratamento",
        }),
      );
      return { ok: true, recall };
    },
    [appendEvent, destinations, lots, recalls, setRecalls],
  );

  const completeRecallTask = useCallback(
    (recallId, taskId) => {
      const current = recalls.find((recall) => recall.id === recallId);
      if (!current || !isOpenRecall(current)) return { ok: false };
      const updated = toggleRecallTask(current, taskId);
      setRecalls((items) =>
        items.map((recall) => (recall.id === recallId ? updated : recall)),
      );
      const task = updated.tasks.find((item) => item.id === taskId);
      appendEvent(
        buildOperationalEvent({
          type: "tarefa-recolhimento-atualizada",
          lotId: current.lotId,
          entityId: current.id,
          title: task?.completed
            ? "Tarefa de recolhimento concluída"
            : "Tarefa de recolhimento reaberta",
          detail: task?.title ?? "Tarefa de contenção atualizada.",
          status: task?.completed ? "em-tratamento" : "pendente",
        }),
      );
      return { ok: true, recall: updated };
    },
    [appendEvent, recalls, setRecalls],
  );

  const finishRecall = useCallback(
    (recallId, resolution) => {
      const current = recalls.find((recall) => recall.id === recallId);
      if (!current || !isOpenRecall(current)) return { ok: false };
      const errors = validateRecallClosure(current, resolution);
      if (Object.keys(errors).length) return { ok: false, errors };
      const updated = closeRecall(current, resolution);
      setRecalls((items) =>
        items.map((recall) => (recall.id === recallId ? updated : recall)),
      );
      appendEvent(
        buildOperationalEvent({
          type: "recolhimento-encerrado",
          lotId: current.lotId,
          entityId: current.id,
          title: "Recolhimento encerrado",
          detail: "A contenção foi concluída e o encerramento foi registrado.",
          status: "concluida",
        }),
      );
      return { ok: true, recall: updated };
    },
    [appendEvent, recalls, setRecalls],
  );

  const progressDestination = useCallback(
    (id) => {
      const current = destinations.find((item) => item.id === id);
      if (
        current &&
        recalls.some(
          (recall) => recall.lotId === current.lotId && isOpenRecall(recall),
        )
      ) {
        return {
          ok: false,
          reason:
            "A movimentação está bloqueada enquanto houver recolhimento em andamento.",
        };
      }
      const nextStatus = getNextDestinationStatus(current?.status);
      if (!current || !nextStatus) return { ok: false };
      if (nextStatus === "concluida")
        return { ok: false, requiresConfirmation: true };
      const updated = advanceDestination(current, nextStatus);
      updateDestination(updated);
      appendEvent(
        buildOperationalEvent({
          type: "destinacao-atualizada",
          lotId: current.lotId,
          entityId: current.id,
          title: "Destinação avançou de etapa",
          detail: `${current.id} está ${nextStatus === "aprovada" ? "aprovada" : "em transporte"}.`,
          status: nextStatus,
        }),
      );
      return { ok: true, destination: updated };
    },
    [appendEvent, destinations, recalls, updateDestination],
  );

  const confirmDestination = useCallback(
    (id, values) => {
      const current = destinations.find((item) => item.id === id);
      if (!current) return { ok: false };
      if (
        recalls.some(
          (recall) => recall.lotId === current.lotId && isOpenRecall(recall),
        )
      ) {
        return {
          ok: false,
          reason:
            "A confirmação está bloqueada enquanto houver recolhimento em andamento.",
        };
      }
      const { destination, errors } = completeDestination(current, values);
      if (Object.keys(errors).length) return { ok: false, errors };
      updateDestination(destination);
      appendEvent(
        buildOperationalEvent({
          type: "destinacao-concluida",
          lotId: current.lotId,
          entityId: current.id,
          title: "Entrega confirmada",
          detail: `${destination.completedQuantity.toLocaleString("pt-BR")} ${destination.unit} confirmados por ${destination.confirmedBy}.`,
          status: "concluida",
        }),
      );
      return { ok: true, destination };
    },
    [appendEvent, destinations, recalls, updateDestination],
  );

  const cancelDestination = useCallback(
    (id) => {
      const current = destinations.find((item) => item.id === id);
      if (!current || ["concluida", "cancelada"].includes(current.status)) {
        return { ok: false };
      }
      const updated = advanceDestination(current, "cancelada");
      updateDestination(updated);
      appendEvent(
        buildOperationalEvent({
          type: "destinacao-cancelada",
          lotId: current.lotId,
          entityId: current.id,
          title: "Destinação cancelada",
          detail: `${Number(current.quantity).toLocaleString("pt-BR")} ${current.unit} voltaram ao saldo disponível do lote.`,
          status: "cancelada",
        }),
      );
      return { ok: true, destination: updated };
    },
    [appendEvent, destinations, updateDestination],
  );

  const executeRescue = useCallback(
    (lot, scenario) => {
      if (!lot || !scenario) return { ok: false };
      const now = new Date();
      const updatedLot = applyRescueScenario(lot, scenario, now);
      const decision = {
        id: `DEC-${lot.id}-${now.getTime()}`,
        lotId: lot.id,
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        createdAt: now.toISOString(),
        operator: "Equipe FreshSense",
        lossPercent: scenario.lossPercent,
        riskBefore: lot.risk,
        riskAfter: scenario.riskAfter,
        targetTemperature: scenario.targetTemperature,
        location: scenario.locationAfter,
        lotSnapshot: { ...lot },
      };
      updateLot(lot.id, updatedLot);
      recordDecision(decision);
      appendEvent(
        buildOperationalEvent({
          type: "resgate-executado",
          lotId: lot.id,
          entityId: decision.id,
          title: "Plano de resgate executado",
          detail: `${scenario.title}: risco ${lot.risk} → ${scenario.riskAfter}.`,
          status: "concluida",
          now,
        }),
      );
      return { ok: true, updatedLot, decision };
    },
    [appendEvent, recordDecision, updateLot],
  );

  const value = useMemo(
    () => ({
      events,
      recalls,
      getLotRelations: (lotId) =>
        getLotRelations(lotId, destinations, decisions),
      registerLot,
      reviseLot,
      removeLot,
      planDestination,
      progressDestination,
      confirmDestination,
      cancelDestination,
      executeRescue,
      openRecall,
      completeRecallTask,
      finishRecall,
    }),
    [
      cancelDestination,
      confirmDestination,
      decisions,
      destinations,
      events,
      executeRescue,
      finishRecall,
      completeRecallTask,
      planDestination,
      openRecall,
      recalls,
      progressDestination,
      registerLot,
      removeLot,
      reviseLot,
    ],
  );

  return (
    <OperationsContext.Provider value={value}>
      {children}
    </OperationsContext.Provider>
  );
}
