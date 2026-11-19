import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { getAvailableQuantity } from "../paginas/destinacao/modelo/destinationModel";
import { storageKeys } from "../utilitarios/browserStorage";
import { DestinationsProvider } from "./DestinationsContext";
import { LotesProvider } from "./LotesContext";
import { OperationsProvider } from "./OperationsContext";
import { RescueOperationsProvider } from "./RescueOperationsContext";
import { useDestinations } from "./useDestinations";
import { useLots } from "./useLots";
import { useOperations } from "./useOperations";

const destination = {
  id: "DST-OPS-A",
  lotId: "LT-1026",
  product: "Uva",
  type: "transferencia",
  quantity: 400,
  unit: "kg",
  recipientId: "UNI-01",
  recipientType: "Unidade FreshSense",
  recipient: "Centro de Distribuição Campinas",
  responsible: "Ana Souza",
  pickupDate: "2099-01-01",
  notes: "Transferência operacional.",
  status: "pendente",
  createdAt: "01/11/2026 10:00",
  origin: "Jundiaí - SP",
  history: [{ status: "pendente", date: "01/11/2026 10:00" }],
};

function OperationsProbe() {
  const { lots } = useLots();
  const { destinations } = useDestinations();
  const {
    planDestination,
    cancelDestination,
    removeLot,
    reviseLot,
    openRecall,
    events,
  } = useOperations();
  const [deleteResult, setDeleteResult] = useState("not-tested");
  const [revisionResult, setRevisionResult] = useState("not-tested");
  const [blockedPlanResult, setBlockedPlanResult] = useState("not-tested");
  const lot = lots.find((item) => item.id === destination.lotId);
  const created = destinations.find((item) => item.id === destination.id);

  return (
    <>
      <output data-testid="availability">
        {getAvailableQuantity(lot, destinations)}
      </output>
      <output data-testid="destination-status">
        {created?.status ?? "none"}
      </output>
      <output data-testid="event-count">{events.length}</output>
      <output data-testid="delete-result">{deleteResult}</output>
      <output data-testid="revision-result">{revisionResult}</output>
      <output data-testid="blocked-plan-result">{blockedPlanResult}</output>
      <button type="button" onClick={() => planDestination(destination)}>
        Reservar A
      </button>
      <button
        type="button"
        onClick={() =>
          planDestination({ ...destination, id: "DST-OPS-B", quantity: 200 })
        }
      >
        Reservar B
      </button>
      <button
        type="button"
        onClick={() => created && cancelDestination(created.id)}
      >
        Cancelar A
      </button>
      <button
        type="button"
        onClick={() => setDeleteResult(String(removeLot(lot.id).ok))}
      >
        Excluir lote
      </button>
      <button
        type="button"
        onClick={() =>
          setRevisionResult(
            String(reviseLot(lot.id, { ...lot, weight: 100 }).ok),
          )
        }
      >
        Reduzir peso
      </button>
      <button
        type="button"
        onClick={() =>
          openRecall({
            lotId: lot.id,
            reason: "Desvio térmico crítico",
            severity: "critica",
            explanation: "Leitura confirmada acima do limite térmico definido.",
            responsible: "Marina Costa",
          })
        }
      >
        Abrir recolhimento
      </button>
      <button
        type="button"
        onClick={() =>
          setBlockedPlanResult(
            String(
              planDestination({
                ...destination,
                id: "DST-OPS-C",
                quantity: 20,
              }).ok,
            ),
          )
        }
      >
        Reservar com recolhimento
      </button>
    </>
  );
}

function renderOperations() {
  return render(
    <LotesProvider>
      <DestinationsProvider>
        <RescueOperationsProvider>
          <OperationsProvider>
            <OperationsProbe />
          </OperationsProvider>
        </RescueOperationsProvider>
      </DestinationsProvider>
    </LotesProvider>,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

test("coordena reserva, concorrência, cancelamento, auditoria e persistência", async () => {
  const user = userEvent.setup();
  renderOperations();

  expect(screen.getByTestId("availability").textContent).toBe("540");
  await user.click(screen.getByRole("button", { name: "Reservar A" }));
  await user.click(screen.getByRole("button", { name: "Reservar B" }));

  await waitFor(() =>
    expect(screen.getByTestId("destination-status").textContent).toBe(
      "pendente",
    ),
  );
  expect(screen.getByTestId("availability").textContent).toBe("140");
  await user.click(screen.getByRole("button", { name: "Excluir lote" }));
  expect(screen.getByTestId("delete-result").textContent).toBe("false");
  await user.click(screen.getByRole("button", { name: "Reduzir peso" }));
  expect(screen.getByTestId("revision-result").textContent).toBe("false");

  await user.click(screen.getByRole("button", { name: "Cancelar A" }));
  await waitFor(() =>
    expect(screen.getByTestId("destination-status").textContent).toBe(
      "cancelada",
    ),
  );
  expect(screen.getByTestId("availability").textContent).toBe("540");
  await user.click(screen.getByRole("button", { name: "Abrir recolhimento" }));
  await user.click(
    screen.getByRole("button", { name: "Reservar com recolhimento" }),
  );
  expect(screen.getByTestId("blocked-plan-result").textContent).toBe("false");
  expect(window.localStorage.getItem(storageKeys.recalls)).toContain("LT-1026");
  await waitFor(() => {
    const stored = JSON.parse(
      window.localStorage.getItem(storageKeys.destinations),
    );
    expect(stored.find((item) => item.id === destination.id).status).toBe(
      "cancelada",
    );
  });
  expect(
    Number(screen.getByTestId("event-count").textContent),
  ).toBeGreaterThanOrEqual(2);
});
