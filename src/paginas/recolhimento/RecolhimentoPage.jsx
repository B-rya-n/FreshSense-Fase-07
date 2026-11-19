import { useMemo, useState } from "react";
import { PageHero } from "../../componentes/PageHero";
import { useDestinations } from "../../contextos/useDestinations";
import { useLots } from "../../contextos/useLots";
import { useOperations } from "../../contextos/useOperations";
import { destinationStatus } from "../destinacao/modelo/destinationModel";
import {
  getAffectedDestinations,
  isOpenRecall,
  recallSeverity,
  recallStatus,
} from "./modelo/recallModel";
import "./recolhimento.css";

const initialForm = {
  lotId: "",
  reason: "",
  severity: "alta",
  explanation: "",
  responsible: "",
};

const recallReasons = [
  "Desvio térmico crítico",
  "Suspeita de não conformidade de qualidade",
  "Divergência de rastreabilidade",
  "Alerta sanitário ou documental",
  "Outro risco operacional",
];

function formatDate(value) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function RecallCard({ recall, destinations, onTask, onFinish }) {
  const [resolution, setResolution] = useState("");
  const [error, setError] = useState("");
  const affected = recall.affectedDestinationIds
    .map((id) => destinations.find((destination) => destination.id === id))
    .filter(Boolean);
  const completedTasks = recall.tasks.filter((task) => task.completed).length;
  const open = isOpenRecall(recall);
  const containmentProgress = Math.round(
    (completedTasks / Math.max(recall.tasks.length, 1)) * 100,
  );

  function finish() {
    const result = onFinish(recall.id, resolution);
    if (!result.ok) {
      setError(
        result.errors?.tasks ??
          result.errors?.resolution ??
          "Não foi possível encerrar o incidente.",
      );
      return;
    }
    setError("");
  }

  return (
    <article className={`recall-card severity-${recall.severity}`}>
      <header className="recall-card-header">
        <div>
          <span className="recall-overline">{recall.id}</span>
          <h2>{recall.lotSnapshot.product}</h2>
          <p>
            Lote <strong>{recall.lotId}</strong> · aberto em{" "}
            {formatDate(recall.createdAt)}
          </p>
        </div>
        <div className="recall-card-badges">
          <span className={`recall-severity severity-${recall.severity}`}>
            {recallSeverity[recall.severity]}
          </span>
          <span className={`recall-status status-${recall.status}`}>
            {recallStatus[recall.status]}
          </span>
        </div>
      </header>

      <div className="recall-summary-grid">
        <div>
          <span>Motivo</span>
          <strong>{recall.reason}</strong>
        </div>
        <div>
          <span>Responsável</span>
          <strong>{recall.responsible}</strong>
        </div>
        <div>
          <span>Operações afetadas</span>
          <strong>{affected.length}</strong>
        </div>
        <div>
          <span>Contenção</span>
          <strong>
            {completedTasks}/{recall.tasks.length} tarefas
          </strong>
        </div>
      </div>

      <div className="recall-progress" aria-label="Progresso da contenção">
        <div>
          <span>Progresso da contenção</span>
          <strong>{containmentProgress}%</strong>
        </div>
        <div
          className="recall-progress-track"
          role="progressbar"
          aria-label="Tarefas de contenção concluídas"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={containmentProgress}
        >
          <i style={{ width: `${containmentProgress}%` }} />
        </div>
        <small>
          {open
            ? "O bloqueio é mantido até que a contenção seja concluída e encerrada."
            : "Incidente encerrado com resolução registrada."}
        </small>
      </div>

      <p className="recall-explanation">{recall.explanation}</p>

      <section className="recall-section" aria-label="Tarefas de contenção">
        <div className="recall-section-title">
          <div>
            <span>Plano de contenção</span>
            <h3>Ações obrigatórias</h3>
          </div>
          {open && (
            <small>O lote permanece bloqueado até o encerramento.</small>
          )}
        </div>
        <ul className="recall-task-list">
          {recall.tasks.map((task) => (
            <li key={task.id} className={task.completed ? "is-done" : ""}>
              <label>
                <input
                  type="checkbox"
                  checked={task.completed}
                  disabled={!open}
                  onChange={() => onTask(recall.id, task.id)}
                />
                <span>
                  <strong>{task.title}</strong>
                  <small>{task.owner}</small>
                </span>
              </label>
              {task.completedAt && <time>{formatDate(task.completedAt)}</time>}
            </li>
          ))}
        </ul>
      </section>

      <section
        className="recall-section recall-affected"
        aria-label="Destinações afetadas"
      >
        <div className="recall-section-title">
          <div>
            <span>Impacto operacional</span>
            <h3>Destinações vinculadas</h3>
          </div>
          <a href={`/destinacao?lote=${encodeURIComponent(recall.lotId)}`}>
            Ver destinação
          </a>
        </div>
        {affected.length ? (
          <ul>
            {affected.map((destination) => (
              <li key={destination.id}>
                <div>
                  <strong>{destination.recipient}</strong>
                  <span>
                    {destination.id} · {destination.quantity} {destination.unit}
                  </span>
                </div>
                <span>{destinationStatus[destination.status]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            Nenhuma destinação ativa estava vinculada quando este incidente foi
            consultado.
          </p>
        )}
      </section>

      {open ? (
        <section
          className="recall-close-section"
          aria-label="Encerrar recolhimento"
        >
          <label htmlFor={`recall-resolution-${recall.id}`}>
            Resolução do incidente
            <textarea
              id={`recall-resolution-${recall.id}`}
              value={resolution}
              onChange={(event) => {
                setResolution(event.target.value);
                setError("");
              }}
              placeholder="Descreva a avaliação final, a decisão e as evidências registradas."
              maxLength="360"
            />
          </label>
          {error && (
            <p className="recall-form-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn-fresh" type="button" onClick={finish}>
            Encerrar recolhimento
          </button>
        </section>
      ) : (
        <div className="recall-resolution">
          <span>Resolução registrada</span>
          <p>{recall.resolution}</p>
        </div>
      )}
    </article>
  );
}

export function RecolhimentoPage() {
  const { lots } = useLots();
  const { destinations } = useDestinations();
  const { recalls, openRecall, completeRecallTask, finishRecall } =
    useOperations();
  const requestedLotId = new URLSearchParams(window.location.search).get(
    "lote",
  );
  const [form, setForm] = useState(() => ({
    ...initialForm,
    lotId: lots.some((lot) => lot.id === requestedLotId) ? requestedLotId : "",
  }));
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState("");
  const openRecalls = useMemo(() => recalls.filter(isOpenRecall), [recalls]);
  const selectedLot = lots.find((lot) => lot.id === form.lotId);
  const selectedAffected = selectedLot
    ? getAffectedDestinations(selectedLot.id, destinations)
    : [];

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setFeedback("");
  }

  function submit(event) {
    event.preventDefault();
    const result = openRecall(form);
    if (!result.ok) {
      setErrors(
        result.errors ?? { lotId: "Não foi possível abrir o recolhimento." },
      );
      return;
    }
    setFeedback(
      `Recolhimento ${result.recall.id} aberto. O lote ${result.recall.lotId} está bloqueado para novas destinações.`,
    );
    setForm(initialForm);
    setErrors({});
  }

  return (
    <>
      <PageHero
        className="recall-hero"
        eyebrow="Resposta coordenada · Fase 7"
        title="Central de Recolhimento e Bloqueio"
        text="Controle incidentes de qualidade com bloqueio preventivo, ações de contenção, visibilidade das operações afetadas e encerramento auditável."
      />
      <main className="section recall-page">
        <div className="container recall-stack">
          <section
            className="recall-command-bar"
            aria-label="Resumo de recolhimentos"
          >
            <div>
              <span>Incidentes em aberto</span>
              <strong>{openRecalls.length}</strong>
              <small>lotes bloqueados para novas destinações</small>
            </div>
            <div>
              <span>Operações impactadas</span>
              <strong>
                {openRecalls.reduce(
                  (total, recall) =>
                    total + recall.affectedDestinationIds.length,
                  0,
                )}
              </strong>
              <small>destinações exigindo acompanhamento</small>
            </div>
            <div>
              <span>Rastreabilidade</span>
              <strong>{recalls.length}</strong>
              <small>incidentes preservados no histórico local</small>
            </div>
          </section>

          <div className="recall-layout">
            <form className="recall-form" noValidate onSubmit={submit}>
              <div className="recall-form-heading">
                <span>Novo incidente</span>
                <h2>Bloquear lote para recolhimento</h2>
                <p>
                  O bloqueio impede novos planos de destinação. As operações já
                  registradas permanecem visíveis para contenção e auditoria.
                </p>
              </div>
              <label>
                Lote afetado
                <select
                  value={form.lotId}
                  onChange={(event) => update("lotId", event.target.value)}
                  aria-invalid={Boolean(errors.lotId)}
                >
                  <option value="">Selecione...</option>
                  {lots.map((lot) => {
                    const locked = openRecalls.some(
                      (recall) => recall.lotId === lot.id,
                    );
                    return (
                      <option key={lot.id} value={lot.id} disabled={locked}>
                        {lot.id} · {lot.product}
                        {locked ? " · bloqueado" : ""}
                      </option>
                    );
                  })}
                </select>
                {errors.lotId && (
                  <small className="recall-form-error">{errors.lotId}</small>
                )}
              </label>
              {selectedLot && (
                <div className="recall-lot-preview">
                  <span>
                    {selectedLot.product} · {selectedLot.id}
                  </span>
                  <strong>
                    {selectedLot.temperature} °C · risco {selectedLot.risk}
                  </strong>
                  <small>
                    {selectedAffected.length} destinação(ões) ativa(s) serão
                    acompanhadas.
                  </small>
                </div>
              )}
              <div className="recall-form-grid">
                <label>
                  Motivo
                  <select
                    value={form.reason}
                    onChange={(event) => update("reason", event.target.value)}
                    aria-invalid={Boolean(errors.reason)}
                  >
                    <option value="">Selecione...</option>
                    {recallReasons.map((reason) => (
                      <option key={reason}>{reason}</option>
                    ))}
                  </select>
                  {errors.reason && (
                    <small className="recall-form-error">{errors.reason}</small>
                  )}
                </label>
                <label>
                  Severidade
                  <select
                    value={form.severity}
                    onChange={(event) => update("severity", event.target.value)}
                    aria-invalid={Boolean(errors.severity)}
                  >
                    {Object.entries(recallSeverity).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {errors.severity && (
                    <small className="recall-form-error">
                      {errors.severity}
                    </small>
                  )}
                </label>
              </div>
              <label>
                Responsável pelo incidente
                <input
                  value={form.responsible}
                  onChange={(event) =>
                    update("responsible", event.target.value)
                  }
                  placeholder="Ex.: Marina Costa"
                  aria-invalid={Boolean(errors.responsible)}
                />
                {errors.responsible && (
                  <small className="recall-form-error">
                    {errors.responsible}
                  </small>
                )}
              </label>
              <label>
                Contexto e evidências iniciais
                <textarea
                  value={form.explanation}
                  onChange={(event) =>
                    update("explanation", event.target.value)
                  }
                  placeholder="Descreva a ocorrência, a leitura ou a evidência que exige contenção."
                  maxLength="360"
                  aria-invalid={Boolean(errors.explanation)}
                />
                {errors.explanation && (
                  <small className="recall-form-error">
                    {errors.explanation}
                  </small>
                )}
              </label>
              <button className="btn-fresh" type="submit">
                Abrir recolhimento e bloquear lote
              </button>
              {feedback && (
                <p className="recall-feedback" role="status">
                  {feedback}
                </p>
              )}
            </form>

            <aside className="recall-guidance">
              <span>Regra operacional</span>
              <h2>Bloqueio é preventivo, não apagamento.</h2>
              <p>
                O FreshSense preserva decisões, destinações e evidências já
                registradas. O foco é impedir novas movimentações até que a
                contenção seja concluída.
              </p>
              <ol>
                <li>Abra o incidente com evidências.</li>
                <li>Conclua as tarefas de contenção.</li>
                <li>Registre uma resolução antes de encerrar.</li>
              </ol>
              <a href="/passaporte-lote">Consultar passaporte do lote</a>
            </aside>
          </div>

          {feedback && (
            <p className="recall-mobile-feedback" role="status">
              {feedback}
            </p>
          )}

          <section className="recall-list" aria-labelledby="recall-list-title">
            <div className="recall-list-heading">
              <div>
                <span>Registro auditável</span>
                <h2 id="recall-list-title">Incidentes e ações de contenção</h2>
              </div>
              <p>
                Os incidentes não são excluídos: o histórico permanece
                disponível para análise no ambiente demonstrativo.
              </p>
            </div>
            {recalls.length ? (
              recalls.map((recall) => (
                <RecallCard
                  key={recall.id}
                  recall={recall}
                  destinations={destinations}
                  onTask={completeRecallTask}
                  onFinish={finishRecall}
                />
              ))
            ) : (
              <div className="recall-empty">
                <strong>Nenhum recolhimento registrado.</strong>
                <span>
                  Abra um incidente apenas quando houver uma condição que
                  justifique interromper novas destinações do lote.
                </span>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
