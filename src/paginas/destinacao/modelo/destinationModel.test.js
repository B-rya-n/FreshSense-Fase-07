import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceDestination,
  completeDestination,
  createDestination,
  formatDestinationVolume,
  getDestinationDueState,
  getEligibleInstitutions,
  getAvailableQuantity,
  getNextDestinationStatus,
  suggestDestination,
  validateDestination,
  validateDestinationCompletion,
} from "./destinationModel.js";

const lot = {
  id: "LT-9001",
  product: "Tomate",
  origin: "Jundiaí - SP",
  weight: 100,
  risk: "alto",
};

test("sugere resposta condicionada à qualidade para lote de alto risco", () => {
  const suggestion = suggestDestination(lot);
  assert.equal(suggestion.type, "doacao");
  assert.match(suggestion.reason, /liberação sanitária/);
});

test("calcula o saldo do lote sem contar operações canceladas", () => {
  const available = getAvailableQuantity(lot, [
    { lotId: lot.id, quantity: 35, status: "aprovada" },
    { lotId: lot.id, quantity: 20, status: "cancelada" },
  ]);
  assert.equal(available, 65);
});

test("impede comprometer quantidade maior que o saldo disponível", () => {
  const errors = validateDestination(
    {
      lotId: lot.id,
      type: "doacao",
      quantity: 70,
      recipient: "INS-01",
      responsible: "Ana Souza",
      pickupDate: "2099-01-01",
      notes: "",
    },
    lot,
    65,
    { id: "INS-01", type: "Banco de alimentos" },
  );
  assert.match(errors.quantity, /máxima disponível é 65 kg/);
});

test("cria destinação pendente com histórico e origem do lote", () => {
  const item = createDestination(
    {
      type: "doacao",
      quantity: "50",
      responsible: "Ana Souza",
      pickupDate: "2099-01-01",
      notes: "Retirada refrigerada",
    },
    lot,
    { id: "INS-01", name: "Banco de Alimentos", type: "Banco de alimentos" },
    new Date("2026-09-28T15:00:00"),
  );
  assert.equal(item.status, "pendente");
  assert.equal(item.quantity, 50);
  assert.equal(item.origin, lot.origin);
  assert.equal(item.history.length, 1);
});

test("gera identificadores distintos sem repetir a cada 16 minutos", () => {
  const values = {
    type: "doacao",
    quantity: "10",
    responsible: "Ana Souza",
    pickupDate: "2099-01-01",
    notes: "",
  };
  const first = createDestination(
    values,
    lot,
    "Banco de Alimentos",
    new Date(1_000_000),
  );
  const second = createDestination(
    values,
    lot,
    "Banco de Alimentos",
    new Date(2_000_000),
  );

  assert.notEqual(first.id, second.id);
  assert.match(first.id, /^DST-[A-Z0-9]+-[A-Z0-9]{8}$/);
});

test("aceita somente a próxima transição operacional válida", () => {
  const destination = { status: "pendente", history: [] };
  const invalid = advanceDestination(
    destination,
    "concluida",
    new Date("2026-10-06T10:00:00"),
  );
  const valid = advanceDestination(
    destination,
    "aprovada",
    new Date("2026-10-06T10:00:00"),
  );
  assert.equal(invalid, destination);
  assert.equal(valid.status, "aprovada");
  assert.equal(valid.history.length, 1);
});

test("registra a data de conclusão ao finalizar a destinação", () => {
  const completed = advanceDestination(
    {
      status: "transporte",
      history: [
        { status: "pendente", date: "01/10/2026 08:00" },
        { status: "aprovada", date: "01/10/2026 08:10" },
        { status: "transporte", date: "02/10/2026 09:00" },
      ],
    },
    "concluida",
    new Date("2026-10-03T10:00:00"),
  );

  assert.equal(completed.status, "concluida");
  assert.equal(completed.completedAt, completed.history.at(-1).date);
});

test("apresenta volumes sem somar unidades incompatíveis", () => {
  assert.equal(
    formatDestinationVolume(
      [
        { quantity: 10, unit: "kg" },
        { quantity: 2, unit: "L" },
        { quantity: 5, unit: "kg" },
      ],
      "pt-BR",
    ),
    "15 kg + 2 L",
  );
});

test("restringe instituições ao tipo de destinação selecionado", () => {
  const list = [
    { id: "INS-01", type: "Banco de alimentos" },
    { id: "VAR-01", type: "Ponto de venda" },
    { id: "UNI-01", type: "Unidade FreshSense" },
  ];
  assert.deepEqual(
    getEligibleInstitutions("transferencia", list).map((item) => item.id),
    ["UNI-01"],
  );
  assert.deepEqual(
    getEligibleInstitutions("venda", list).map((item) => item.id),
    ["VAR-01"],
  );
});

test("confirma a quantidade real antes de encerrar uma destinação", () => {
  const inTransit = {
    status: "transporte",
    quantity: 50,
    unit: "kg",
    history: [
      { status: "pendente", date: "01/10/2026 08:00" },
      { status: "aprovada", date: "01/10/2026 08:20" },
      { status: "transporte", date: "02/10/2026 08:30" },
    ],
  };
  const invalid = validateDestinationCompletion(
    { completedQuantity: "40", confirmedBy: "Ana Souza", completionNotes: "" },
    inTransit,
  );
  const { destination, errors } = completeDestination(
    inTransit,
    {
      completedQuantity: "40",
      confirmedBy: "Ana Souza",
      completionNotes: "Recebimento parcial por conferência de qualidade.",
    },
    new Date("2026-10-03T10:00:00"),
  );
  assert.ok(invalid.completionNotes);
  assert.deepEqual(errors, {});
  assert.equal(destination.completedQuantity, 40);
  assert.equal(destination.status, "concluida");
});

test("identifica destinações abertas vencidas ou próximas do vencimento", () => {
  const now = new Date("2026-10-10T12:00:00");
  assert.equal(
    getDestinationDueState(
      { status: "aprovada", pickupDate: "2026-10-09" },
      now,
    ).state,
    "atrasada",
  );
  assert.equal(
    getDestinationDueState(
      { status: "transporte", pickupDate: "2026-10-11" },
      now,
    ).state,
    "proxima",
  );
});

test("expõe a próxima etapa operacional sem confundir cancelamento", () => {
  assert.equal(getNextDestinationStatus("pendente"), "aprovada");
  assert.equal(getNextDestinationStatus("aprovada"), "transporte");
  assert.equal(getNextDestinationStatus("transporte"), "concluida");
  assert.equal(getNextDestinationStatus("concluida"), null);
  assert.equal(getNextDestinationStatus("cancelada"), null);
});
