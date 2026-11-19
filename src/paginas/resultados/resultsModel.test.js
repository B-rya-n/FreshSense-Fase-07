import test from "node:test";
import assert from "node:assert/strict";
import {
  completionDay,
  creationDay,
  summarizeResults,
} from "./resultsModel.js";
const base = {
  lotId: "L1",
  type: "doacao",
  quantity: 10,
  unit: "kg",
  createdAt: "31/10/2026 12:00",
};
test("counts only completed volume and separates cancellation and pending", () => {
  const r = summarizeResults(
    [],
    [
      { ...base, status: "concluida" },
      { ...base, status: "pendente" },
      { ...base, status: "cancelada" },
    ],
  );
  assert.equal(r.quantities.doacao.kg, 10);
  assert.equal(r.pending.length, 1);
  assert.equal(r.cancelled.length, 1);
});
test("keeps different units and destination types separate", () => {
  const r = summarizeResults(
    [],
    [
      { ...base, status: "concluida" },
      { ...base, status: "concluida", unit: "L", quantity: 3 },
      { ...base, type: "desconto", status: "concluida", quantity: 4 },
    ],
  );
  assert.deepEqual(r.quantities, {
    doacao: { kg: 10, L: 3 },
    desconto: { kg: 4 },
  });
});
test("inclusive creation date boundaries, type filter and reversed interval", () => {
  const ds = [
    { ...base, status: "concluida" },
    { ...base, type: "venda", status: "concluida" },
    { ...base, createdAt: "01/11/2026", status: "concluida" },
  ];
  assert.equal(
    summarizeResults([], ds, {
      from: "2026-10-31",
      to: "2026-10-31",
      type: "doacao",
    }).records.length,
    1,
  );
  assert.equal(
    summarizeResults([], ds, { from: "2026-11-01", to: "2026-10-31" })
      .invalidPeriod,
    true,
  );
  assert.equal(creationDay("31/10/2026, 12:00"), "2026-10-31");
});
test("usa a data de conclusão para resultados concluídos", () => {
  const completedLater = {
    ...base,
    type: "transferencia",
    status: "concluida",
    createdAt: "28/09/2026 12:00",
    completedAt: "03/10/2026 09:00",
  };

  const octoberResult = summarizeResults([], [completedLater], {
    from: "2026-10-03",
    to: "2026-10-03",
  });
  const septemberResult = summarizeResults([], [completedLater], {
    from: "2026-09-28",
    to: "2026-09-28",
  });

  assert.equal(completionDay(completedLater), "2026-10-03");
  assert.equal(octoberResult.completed.length, 1);
  assert.equal(octoberResult.quantities.transferencia.kg, 10);
  assert.equal(septemberResult.records.length, 0);
});
test("attention uses available stock and ignores historical filters", () => {
  const lots = [
    { id: "L1", risk: "alto", weight: 20 },
    { id: "L2", risk: "baixo", weight: 40 },
  ];
  const r = summarizeResults(
    lots,
    [
      { ...base, status: "concluida" },
      { ...base, status: "cancelada" },
    ],
    { from: "2027-01-01" },
  );
  assert.equal(r.records.length, 0);
  assert.equal(r.attention[0].available, 10);
  assert.equal(
    summarizeResults(lots, [{ ...base, status: "aprovada", quantity: 20 }])
      .attention.length,
    0,
  );
});

test("separa prioridades vencidas das que vencem em breve", () => {
  const result = summarizeResults(
    [],
    [
      { ...base, id: "D1", status: "aprovada", pickupDate: "2026-10-09" },
      { ...base, id: "D2", status: "transporte", pickupDate: "2026-10-11" },
      { ...base, id: "D3", status: "concluida", pickupDate: "2026-10-08" },
    ],
    {},
    new Date("2026-10-10T12:00:00"),
  );
  assert.equal(result.overdue.map((item) => item.id).join(), "D1");
  assert.equal(result.dueSoon.map((item) => item.id).join(), "D2");
});
