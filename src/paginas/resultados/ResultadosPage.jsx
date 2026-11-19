import { useMemo, useState } from "react";
import { PageHero } from "../../componentes/PageHero";
import { useLots } from "../../contextos/useLots";
import { useDestinations } from "../../contextos/useDestinations";
import { useOperations } from "../../contextos/useOperations";
import {
  destinationStatus,
  destinationTypes,
  getCompletedQuantity,
  getDestinationDueState,
} from "../destinacao/modelo/destinationModel";
import {
  completionDay,
  buildResultInsights,
  formatQuantities,
  summarizeResults,
} from "./resultsModel";
import "./resultados.css";

const emptyFilters = { from: "", to: "", type: "" };

const resultMetricLabels = Object.freeze({
  doacao: "Volume doado",
  venda: "Volume vendido",
  desconto: "Volume com desconto",
  transferencia: "Volume transferido",
});
export function ResultadosPage() {
  const { lots } = useLots();
  const { destinations } = useDestinations();
  const { recalls } = useOperations();
  const [filters, setFilters] = useState(emptyFilters);
  const result = useMemo(
    () => summarizeResults(lots, destinations, filters),
    [lots, destinations, filters],
  );
  const insights = useMemo(() => buildResultInsights(result), [result]);
  const openRecalls = recalls.filter((recall) => recall.status !== "encerrado");
  function update(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }
  return (
    <>
      <PageHero
        eyebrow="Resultados da operação · Fase 7"
        title="Cada destinação, um resultado."
        text="Acompanhe o que foi concluído, o que ainda está em andamento e onde o estoque precisa de atenção."
      />
      <main className="results-page section">
        <div className="container results-stack">
          <details className="results-method-note">
            <summary>Como esta leitura é calculada</summary>
            <p>
              Ambiente acadêmico: os indicadores usam os registros deste
              navegador. Uma destinação planejada só entra no volume realizado
              após ser marcada como concluída. Os valores não representam
              desperdício evitado comprovado.
            </p>
          </details>
          <section
            className="results-command-center"
            aria-labelledby="results-command-title"
          >
            <div className="results-command-intro">
              <span>Visão executiva</span>
              <h2 id="results-command-title">
                Resultados que orientam a próxima decisão.
              </h2>
              <p>
                Volumes confirmados, pendências operacionais e estoque de risco
                reunidos em uma única leitura da operação.
              </p>
            </div>
            <div className="results-command-score">
              <span>Execução confirmada</span>
              <strong>{insights.confirmedRate}%</strong>
              <div
                className="results-progress-track"
                role="progressbar"
                aria-label="Execução confirmada em relação ao volume planejado"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={insights.confirmedRate}
              >
                <i style={{ width: `${insights.confirmedRate}%` }} />
              </div>
              <small>
                {insights.completedVolume.toLocaleString("pt-BR")} kg
                confirmados de {insights.plannedVolume.toLocaleString("pt-BR")}{" "}
                kg planejados
              </small>
            </div>
          </section>
          <section
            className="results-executive-grid"
            aria-label="Indicadores executivos"
          >
            <article>
              <span>Volume confirmado</span>
              <strong>
                {insights.completedVolume.toLocaleString("pt-BR")}{" "}
                <small>kg</small>
              </strong>
              <p>Somente operações concluídas e validadas.</p>
            </article>
            <article>
              <span>Operações concluídas</span>
              <strong>{result.completed.length}</strong>
              <p>Registros finalizados com rastreabilidade.</p>
            </article>
            <article className={result.overdue.length ? "has-alert" : ""}>
              <span>Prioridades abertas</span>
              <strong>{result.overdue.length + result.dueSoon.length}</strong>
              <p>
                {result.overdue.length
                  ? `${result.overdue.length} atrasada(s) exigem ação.`
                  : "Nenhum prazo vencido neste momento."}
              </p>
            </article>
            <article className="results-secondary-metric">
              <span>Estoque sob atenção</span>
              <strong>
                {insights.attentionVolume.toLocaleString("pt-BR")}{" "}
                <small>kg</small>
              </strong>
              <p>{result.attention.length} lotes com risco médio ou alto.</p>
            </article>
            <article
              className={`results-secondary-metric ${
                openRecalls.length ? "has-alert" : ""
              }`}
            >
              <span>Recolhimentos ativos</span>
              <strong>{openRecalls.length}</strong>
              <p>
                {openRecalls.length
                  ? "Lotes bloqueados aguardando contenção."
                  : "Nenhum lote bloqueado neste momento."}
              </p>
              <a href="/recolhimento">Abrir Central de Recolhimento</a>
            </article>
          </section>
          <section
            className="results-box"
            aria-labelledby="results-filters-title"
          >
            <h2 id="results-filters-title">Consultar resultados</h2>
            <p>
              Destinações concluídas são consideradas pela data de conclusão. As
              demais usam a data de criação; os dias inicial e final são
              incluídos.
            </p>
            <div className="results-filters">
              <label>
                Data inicial
                <input
                  type="date"
                  value={filters.from}
                  onChange={(event) => update("from", event.target.value)}
                  aria-invalid={result.invalidPeriod}
                  aria-describedby={
                    result.invalidPeriod ? "period-error" : undefined
                  }
                />
              </label>
              <label>
                Data final
                <input
                  type="date"
                  value={filters.to}
                  onChange={(event) => update("to", event.target.value)}
                  aria-invalid={result.invalidPeriod}
                  aria-describedby={
                    result.invalidPeriod ? "period-error" : undefined
                  }
                />
              </label>
              <label>
                Tipo de destinação
                <select
                  value={filters.type}
                  onChange={(event) => update("type", event.target.value)}
                >
                  <option value="">Todos os tipos</option>
                  {Object.entries(destinationTypes).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn-fresh"
                type="button"
                onClick={() => setFilters(emptyFilters)}
              >
                Limpar filtros
              </button>
            </div>
            {result.invalidPeriod && (
              <p id="period-error" role="alert">
                A data inicial deve ser anterior ou igual à data final.
              </p>
            )}
          </section>
          <div aria-live="polite" className="results-summary">
            {result.records.length} destinações no período e tipo selecionados.
          </div>
          <section
            className="results-breakdown"
            aria-label="Volumes concluídos"
          >
            <div className="results-section-heading">
              <div>
                <span className="results-eyebrow">Leitura por estratégia</span>
                <h2>Volume confirmado por destinação</h2>
              </div>
              <p>Somente operações concluídas entram nesta leitura.</p>
            </div>
            <div className="results-metrics">
              {Object.entries(destinationTypes).map(([key, label]) => (
                <article className="results-box" key={key}>
                  <span className="results-eyebrow">
                    {resultMetricLabels[key] ?? label}
                  </span>
                  <strong>{formatQuantities(result.quantities[key])}</strong>
                  <small>Somente operações concluídas</small>
                </article>
              ))}
            </div>
          </section>
          <section
            className="results-insight-grid"
            aria-label="Distribuição das destinações concluídas"
          >
            <article className="results-box results-mix-panel">
              <div className="results-heading">
                <div>
                  <span className="results-eyebrow">
                    Composição dos resultados
                  </span>
                  <h2>Como o volume foi direcionado</h2>
                </div>
              </div>
              {insights.mix.length ? (
                <ul className="results-mix-list">
                  {insights.mix.map((item) => (
                    <li key={item.type}>
                      <div>
                        <strong>{destinationTypes[item.type]}</strong>
                        <span>
                          {item.total.toLocaleString("pt-BR")} kg confirmados
                        </span>
                      </div>
                      <div
                        className="results-mix-bar"
                        aria-label={`${destinationTypes[item.type]}: ${item.percentage}%`}
                      >
                        <i style={{ width: `${item.percentage}%` }} />
                      </div>
                      <b>{item.percentage}%</b>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="results-empty">
                  Conclua uma destinação para visualizar a distribuição por
                  tipo.
                </p>
              )}
            </article>
            <article className="results-box results-guidance-panel">
              <span className="results-eyebrow">Leitura recomendada</span>
              <h2>Qual é a prioridade agora?</h2>
              {result.overdue.length ? (
                <p>
                  Existem{" "}
                  <strong>
                    {result.overdue.length} operação(ões) atrasada(s)
                  </strong>
                  . Trate os prazos vencidos antes de abrir novas destinações.
                </p>
              ) : result.dueSoon.length ? (
                <p>
                  Existem{" "}
                  <strong>
                    {result.dueSoon.length} operação(ões) próximas do prazo
                  </strong>
                  . Confirme responsáveis, retirada e transporte.
                </p>
              ) : result.attention.length ? (
                <p>
                  Não há prazos urgentes. O próximo foco é o estoque em atenção,
                  principalmente os lotes de risco alto.
                </p>
              ) : (
                <p>
                  Não há pendências ou lotes críticos com saldo disponível neste
                  momento.
                </p>
              )}
              <a
                className="btn-fresh"
                href={
                  result.overdue.length || result.dueSoon.length
                    ? "/destinacao"
                    : "/gestao-lotes"
                }
              >
                {result.overdue.length || result.dueSoon.length
                  ? "Acompanhar operações"
                  : "Revisar lotes"}
              </a>
            </article>
          </section>
          <section
            className="results-status-grid"
            aria-label="Situação das destinações"
          >
            <article className="results-box">
              <span>Em andamento</span>
              <strong>{result.pending.length}</strong>
              <p>Pendentes, aprovadas ou em transporte.</p>
            </article>
            <article className="results-box">
              <span>Concluídas</span>
              <strong>{result.completed.length}</strong>
              <p>Operações finalizadas no sistema.</p>
            </article>
            <article className="results-box">
              <span>Canceladas</span>
              <strong>{result.cancelled.length}</strong>
              <p>Excluídas dos volumes realizados.</p>
            </article>
            <article
              className={
                result.overdue.length ? "results-box is-overdue" : "results-box"
              }
            >
              <span>Atrasadas</span>
              <strong>{result.overdue.length}</strong>
              <p>Operações abertas cujo prazo já venceu.</p>
            </article>
          </section>
          <section
            className="results-box"
            aria-labelledby="results-deadline-title"
          >
            <div className="results-heading">
              <div>
                <h2 id="results-deadline-title">Prioridades de prazo</h2>
                <p>
                  Destinações abertas com prazo vencido, para hoje ou para os
                  próximos dois dias.
                </p>
              </div>
            </div>
            {result.overdue.length || result.dueSoon.length ? (
              <ul className="results-deadline-list">
                {[...result.overdue, ...result.dueSoon].map((item) => {
                  const due = getDestinationDueState(item);
                  return (
                    <li className={`deadline-${due.state}`} key={item.id}>
                      <div>
                        <strong>
                          {item.product} · {item.lotId}
                        </strong>
                        <span>
                          {destinationTypes[item.type]} ·{" "}
                          {Number(item.quantity).toLocaleString("pt-BR")}{" "}
                          {item.unit || "kg"}
                        </span>
                      </div>
                      <div className="results-deadline-action">
                        <em>{due.label}</em>
                        <a
                          href={`/destinacao?lote=${encodeURIComponent(item.lotId)}`}
                        >
                          Tratar operação →
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="results-empty">
                Nenhuma destinação aberta exige ação por prazo neste momento.
              </p>
            )}
          </section>
          <section
            className="results-box"
            aria-labelledby="results-records-title"
          >
            <div className="results-heading">
              <div>
                <h2 id="results-records-title">Destinações do período</h2>
                <p>Confira os registros que compõem os indicadores.</p>
              </div>
              <a className="btn-fresh" href="/destinacao">
                Gerenciar destinações
              </a>
            </div>
            {result.records.length ? (
              <div
                className="results-table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Tabela de destinações"
              >
                <table>
                  <caption>
                    Registros filtrados pelo marco operacional e tipo
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Lote / produto</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Quantidade</th>
                      <th scope="col">Confirmada</th>
                      <th scope="col">Situação</th>
                      <th scope="col">Criada em</th>
                      <th scope="col">Concluída em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.records.map((item) => (
                      <tr key={item.id}>
                        <th scope="row">
                          {item.lotId}
                          <small>{item.product}</small>
                        </th>
                        <td>{destinationTypes[item.type]}</td>
                        <td>
                          {Number(item.quantity).toLocaleString("pt-BR")}{" "}
                          {item.unit || "kg"}
                        </td>
                        <td>
                          {item.status === "concluida"
                            ? `${getCompletedQuantity(item).toLocaleString("pt-BR")} ${item.unit || "kg"}`
                            : "—"}
                        </td>
                        <td>{destinationStatus[item.status]}</td>
                        <td>{item.createdAt}</td>
                        <td>{completionDay(item) || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="results-empty">
                Nenhuma destinação corresponde aos filtros. Ajuste o período ou
                registre uma destinação.
              </p>
            )}
          </section>
          <section
            className="results-box"
            aria-labelledby="results-attention-title"
          >
            <div className="results-heading">
              <div>
                <h2 id="results-attention-title">
                  Estoque que precisa de atenção
                </h2>
                <p>
                  Situação atual, independente dos filtros acima. Lotes de risco
                  médio ou alto com saldo ainda não comprometido.
                </p>
              </div>
              <a href="/gestao-lotes" className="btn-fresh">
                Gerenciar lotes
              </a>
            </div>
            {result.attention.length ? (
              <ul className="results-attention">
                {result.attention.map((lot) => (
                  <li key={lot.id}>
                    <div>
                      <strong>
                        {lot.product} · {lot.id}
                      </strong>
                      <span>
                        Risco {lot.risk === "alto" ? "alto" : "médio"} ·{" "}
                        {lot.available.toLocaleString("pt-BR")}{" "}
                        {lot.unit || "kg"} disponíveis
                      </span>
                    </div>
                    <div className="results-attention-actions">
                      <a
                        href={`/passaporte-lote?lote=${encodeURIComponent(lot.id)}`}
                      >
                        Consultar lote →
                      </a>
                      <a
                        href={`/destinacao?lote=${encodeURIComponent(lot.id)}`}
                      >
                        Planejar destinação →
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="results-empty">
                Nenhum lote de risco médio ou alto com saldo disponível neste
                momento.
              </p>
            )}
          </section>
          <p className="results-footnote">
            Dados mantidos localmente. Ao editar lotes ou atualizar uma
            destinação, volte a este painel para consultar os indicadores
            recalculados. Unidades diferentes são apresentadas separadamente.
          </p>
        </div>
      </main>
    </>
  );
}
