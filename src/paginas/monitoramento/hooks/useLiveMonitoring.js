import { useCallback, useEffect, useMemo, useReducer } from "react";
import { useLots } from "../../../contextos/useLots";
import { useDestinations } from "../../../contextos/useDestinations";
import { useOperations } from "../../../contextos/useOperations";
import { useRescueOperations } from "../../../contextos/useRescueOperations";
import {
  readStoredValue,
  storageKeys,
  writeStoredValue,
} from "../../../utilitarios/browserStorage";
import {
  createMonitoringEvent,
  createOperationsSnapshot,
  DEFAULT_LIVE_UPDATE_INTERVAL,
  LIVE_UPDATE_INTERVALS,
} from "../modelo/monitoringModel";
import { monitoringReducer } from "../modelo/monitoringReducer";

function readRefreshRate() {
  const savedRate = Number(
    readStoredValue(
      storageKeys.monitoringRefreshRate,
      DEFAULT_LIVE_UPDATE_INTERVAL,
    ),
  );

  return LIVE_UPDATE_INTERVALS.includes(savedRate)
    ? savedRate
    : DEFAULT_LIVE_UPDATE_INTERVAL;
}

function createInitialClock() {
  const updatedAt = new Date();

  return {
    tick: 0,
    updatedAt,
    events: Array.from({ length: 6 }, (_, index) =>
      createMonitoringEvent(
        index,
        new Date(updatedAt.getTime() - index * 90000),
      ),
    ),
    isPaused: false,
    refreshRate: readRefreshRate(),
  };
}

export function useLiveMonitoring() {
  const { lots } = useLots();
  const { destinations } = useDestinations();
  const { decisions } = useRescueOperations();
  const { events: operationalEvents, recalls } = useOperations();
  const [clock, dispatch] = useReducer(
    monitoringReducer,
    undefined,
    createInitialClock,
  );
  const refreshNow = useCallback(() => {
    dispatch({ type: "advance", updatedAt: new Date() });
  }, []);

  useEffect(() => {
    if (clock.isPaused) return undefined;

    const interval = window.setInterval(refreshNow, clock.refreshRate);

    return () => window.clearInterval(interval);
  }, [clock.isPaused, clock.refreshRate, refreshNow]);

  useEffect(() => {
    writeStoredValue(
      storageKeys.monitoringRefreshRate,
      String(clock.refreshRate),
    );
  }, [clock.refreshRate]);

  const snapshot = useMemo(
    () => createOperationsSnapshot(clock.tick, lots, destinations, decisions),
    [clock.tick, decisions, destinations, lots],
  );
  const connectedEvents = useMemo(
    () =>
      operationalEvents.slice(0, 8).map((event) => ({
        id: `connected-${event.id}`,
        incidentId: event.entityId ?? event.id,
        tone: ["resgate-executado", "recolhimento-aberto"].includes(event.type)
          ? "warning"
          : "info",
        severity:
          event.type === "recolhimento-aberto"
            ? "crítica"
            : event.type === "resgate-executado"
              ? "alta"
              : "informativo",
        category: "operação",
        title: event.title,
        text: event.detail,
        source: "Fluxo operacional FreshSense",
        location: event.lotId ?? "Operação consolidada",
        recommendation:
          "Consulte o lote e seus registros vinculados para acompanhar os próximos passos.",
        status: event.status === "concluida" ? "resolvido" : "em-tratamento",
        acknowledged: event.status === "concluida",
        owner: "Fluxo operacional",
        time: new Date(event.createdAt).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      })),
    [operationalEvents],
  );
  const activeRecallEvents = useMemo(
    () =>
      recalls
        .filter((recall) => recall.status !== "encerrado")
        .map((recall) => ({
          id: `recall-${recall.id}`,
          incidentId: recall.id,
          tone: "warning",
          severity: recall.severity === "critica" ? "crítica" : "alta",
          category: "recolhimento",
          title: `Recolhimento ativo · ${recall.lotId}`,
          text: `${recall.reason}. O lote está bloqueado para novas movimentações.`,
          source: "Central de Recolhimento",
          location: recall.lotSnapshot.location,
          recommendation:
            "Conclua as tarefas de contenção e registre a resolução antes de liberar o lote.",
          status: "em-tratamento",
          acknowledged: false,
          owner: recall.responsible,
          time: new Date(recall.updatedAt).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        })),
    [recalls],
  );
  const pendingAlertCount = useMemo(
    () =>
      [...clock.events, ...connectedEvents, ...activeRecallEvents].filter(
        (event) =>
          event.tone === "warning" &&
          !event.acknowledged &&
          event.status !== "resolvido",
      ).length,
    [activeRecallEvents, clock.events, connectedEvents],
  );
  const togglePaused = useCallback(
    () => dispatch({ type: "toggle-pause" }),
    [],
  );
  const setRefreshRate = useCallback(
    (refreshRate) => dispatch({ type: "set-refresh-rate", refreshRate }),
    [],
  );
  const acknowledgeEvent = useCallback(
    (id) => dispatch({ type: "acknowledge-event", id }),
    [],
  );
  const assignEvent = useCallback(
    (id) =>
      dispatch({
        type: "assign-event",
        id,
        owner: "Equipe de Qualidade",
      }),
    [],
  );
  const resolveEvent = useCallback(
    (id) => dispatch({ type: "resolve-event", id, resolvedAt: new Date() }),
    [],
  );

  return {
    ...snapshot,
    updatedAt: clock.updatedAt,
    events: [...activeRecallEvents, ...connectedEvents, ...clock.events],
    destinations,
    isPaused: clock.isPaused,
    refreshRate: clock.refreshRate,
    pendingAlertCount,
    refreshNow,
    togglePaused,
    setRefreshRate,
    acknowledgeEvent,
    assignEvent,
    resolveEvent,
  };
}
