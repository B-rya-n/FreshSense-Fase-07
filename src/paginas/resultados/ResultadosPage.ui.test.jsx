import React from "react";
import { afterEach, expect, test } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../test/renderWithProviders";
import { LotesContext } from "../../contextos/useLots";
import { DestinationsContext } from "../../contextos/useDestinations";
import { OperationsContext } from "../../contextos/useOperations";
import { ResultadosPage } from "./ResultadosPage";
afterEach(cleanup);
test("filters records, resets and updates totals when an operation completes", async () => {
  const user = userEvent.setup();
  const destination = {
    id: "D1",
    lotId: "L1",
    product: "Maçã",
    type: "doacao",
    quantity: 12,
    unit: "kg",
    status: "pendente",
    createdAt: "31/10/2026 14:00",
  };
  const view = (record) => (
    <OperationsContext.Provider value={{ recalls: [] }}>
      <LotesContext.Provider value={{ lots: [] }}>
        <DestinationsContext.Provider value={{ destinations: [record] }}>
          <ResultadosPage />
        </DestinationsContext.Provider>
      </LotesContext.Provider>
    </OperationsContext.Provider>
  );
  const app = renderWithProviders(view(destination));
  expect(
    screen.getByText("1 destinações no período e tipo selecionados."),
  ).toBeTruthy();
  expect(screen.queryByText("12 kg", { selector: "strong" })).toBeNull();
  app.rerender(view({ ...destination, status: "concluida" }));
  expect(screen.getByText("12 kg", { selector: "strong" })).toBeTruthy();
  await user.selectOptions(
    screen.getByLabelText("Tipo de destinação"),
    "venda",
  );
  expect(
    screen.getByText("0 destinações no período e tipo selecionados."),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
  expect(screen.getByText("12 kg", { selector: "strong" })).toBeTruthy();
});
