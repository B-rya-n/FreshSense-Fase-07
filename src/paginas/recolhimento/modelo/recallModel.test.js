import assert from "node:assert/strict";
import test from "node:test";
import { initialLots } from "../../../dados/lotData.js";
import {
  closeRecall,
  createRecall,
  getAffectedDestinations,
  isOpenRecall,
  toggleRecallTask,
  validateRecall,
  validateRecallClosure,
} from "./recallModel.js";

const values = {
  reason: "Desvio térmico crítico",
  severity: "critica",
  explanation: "Leitura confirmada acima do limite térmico definido.",
  responsible: "Marina Costa",
};

test("cria recolhimento com tarefas e preserva as operações ativas afetadas", () => {
  const lot = initialLots.find((item) => item.id === "PX-332");
  const destinations = [
    { id: "D-ATIVA", lotId: lot.id, status: "transporte" },
    { id: "D-CANCELADA", lotId: lot.id, status: "cancelada" },
    { id: "D-OUTRO", lotId: "LT-1031", status: "pendente" },
  ];
  const recall = createRecall(
    values,
    lot,
    destinations,
    new Date("2026-11-01T12:00:00Z"),
  );

  assert.equal(recall.lotId, lot.id);
  assert.equal(recall.status, "aberto");
  assert.equal(recall.tasks.length, 4);
  assert.deepEqual(recall.affectedDestinationIds, ["D-ATIVA"]);
  assert.equal(getAffectedDestinations(lot.id, destinations).length, 1);
});

test("exige dados válidos, bloqueia duplicidade e só encerra após a contenção", () => {
  const lot = initialLots.find((item) => item.id === "PX-332");
  const recall = createRecall(
    values,
    lot,
    [],
    new Date("2026-11-01T12:00:00Z"),
  );
  assert.ok(validateRecall({ ...values, lotId: lot.id }, lot, [recall]).lotId);
  assert.ok(
    validateRecall({ ...values, explanation: "curto" }, lot, []).explanation,
  );
  assert.ok(
    validateRecallClosure(recall, "Contenção concluída e evidências revisadas.")
      .tasks,
  );

  const contained = recall.tasks.reduce(
    (current, task, index) =>
      toggleRecallTask(
        current,
        task.id,
        new Date(`2026-11-01T12:0${index}:00Z`),
      ),
    recall,
  );
  assert.equal(contained.status, "em-contencao");
  assert.equal(isOpenRecall(contained), true);
  assert.deepEqual(
    validateRecallClosure(
      contained,
      "Contenção concluída e evidências revisadas.",
    ),
    {},
  );
  const closed = closeRecall(
    contained,
    "Contenção concluída e evidências revisadas.",
    new Date("2026-11-01T12:10:00Z"),
  );
  assert.equal(closed.status, "encerrado");
  assert.equal(isOpenRecall(closed), false);
});
