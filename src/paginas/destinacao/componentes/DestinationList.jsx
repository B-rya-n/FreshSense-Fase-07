import { useMemo, useState } from "react";
import { Translated } from "../../../traducoes/I18nContext";
import { useI18n } from "../../../traducoes/useI18n";
import { DestinationCompletionDialog } from "./DestinationCompletionDialog";
import {
  destinationStatus,
  destinationTypes,
  formatPickupDate,
  getDestinationDueState,
  getNextDestinationStatus,
} from "../modelo/destinationModel";

const filters = [
  "todos",
  "pendente",
  "aprovada",
  "transporte",
  "concluida",
  "cancelada",
];

export function DestinationList({
  destinations,
  blockedLotIds = [],
  onAdvance,
  onConfirm,
  onCancel,
}) {
  const { language, t } = useI18n();
  const locale = language === "pt" ? "pt-BR" : language;
  const [filter, setFilter] = useState("todos");
  const [expanded, setExpanded] = useState(destinations[0]?.id ?? null);
  const [completionTarget, setCompletionTarget] = useState(null);
  const [actionFeedback, setActionFeedback] = useState("");
  const visible = useMemo(
    () =>
      filter === "todos"
        ? destinations
        : destinations.filter((item) => item.status === filter),
    [destinations, filter],
  );

  function advance(item) {
    if (blockedLotIds.includes(item.lotId)) {
      setActionFeedback(
        "Esta movimentação está bloqueada por recolhimento. Use a Central de Recolhimento para concluir a contenção.",
      );
      return;
    }
    const status = getNextDestinationStatus(item.status);
    if (status === "concluida") setCompletionTarget(item);
    else if (status) {
      const result = onAdvance(item.id);
      if (!result?.ok && result?.reason) setActionFeedback(result.reason);
    }
  }

  function cancel(item) {
    onCancel(item.id);
  }

  function complete(values) {
    if (!completionTarget) return;
    const result = onConfirm(completionTarget.id, values);
    if (result?.ok) {
      setCompletionTarget(null);
    } else if (result?.reason) {
      setActionFeedback(result.reason);
      setCompletionTarget(null);
    }
  }

  return (
    <Translated>
      <article className="destination-panel destination-list-panel">
        <div className="destination-panel-heading">
          <span>Acompanhamento</span>
          <h2>Destinações registradas</h2>
          <p>Avance cada operação e mantenha um histórico auditável.</p>
        </div>

        <div className="destination-filters" aria-label="Filtrar destinações">
          {filters.map((status) => (
            <button
              key={status}
              type="button"
              className={filter === status ? "active" : ""}
              aria-pressed={filter === status}
              onClick={() => setFilter(status)}
            >
              {status === "todos" ? t("Todas") : t(destinationStatus[status])}
            </button>
          ))}
        </div>

        <div className="destination-list" aria-live="polite">
          {visible.map((item) => {
            const isExpanded = expanded === item.id;
            const upcomingStatus = getNextDestinationStatus(item.status);
            const isBlocked = blockedLotIds.includes(item.lotId);
            const canAdvance = Boolean(upcomingStatus) && !isBlocked;
            const due = getDestinationDueState(item);

            return (
              <article
                className={`destination-item status-${item.status} deadline-${due.state}`}
                key={item.id}
              >
                <button
                  type="button"
                  className="destination-item-summary"
                  aria-expanded={isExpanded}
                  onClick={() => setExpanded(isExpanded ? null : item.id)}
                >
                  <span className="destination-status-dot" aria-hidden="true" />
                  <span>
                    <strong>
                      {t(item.product)} · {item.quantity.toLocaleString(locale)}{" "}
                      {item.unit}
                    </strong>
                    <small>
                      {item.id} · {t(destinationTypes[item.type])}
                    </small>
                  </span>
                  <em>{t(destinationStatus[item.status])}</em>
                  <b aria-hidden="true">{isExpanded ? "−" : "+"}</b>
                </button>

                {isExpanded && (
                  <div className="destination-item-details">
                    <dl>
                      <div>
                        <dt>Lote</dt>
                        <dd>{item.lotId}</dd>
                      </div>
                      <div>
                        <dt>Destino</dt>
                        <dd>{item.recipient}</dd>
                      </div>
                      <div>
                        <dt>Responsável</dt>
                        <dd>{item.responsible}</dd>
                      </div>
                      <div>
                        <dt>Data prevista</dt>
                        <dd>{formatPickupDate(item.pickupDate, locale)}</dd>
                      </div>
                      <div>
                        <dt>Prazo operacional</dt>
                        <dd className={`destination-deadline ${due.state}`}>
                          {due.label}
                        </dd>
                      </div>
                      {item.status === "concluida" && (
                        <>
                          <div>
                            <dt>Quantidade confirmada</dt>
                            <dd>
                              {Number(
                                item.completedQuantity ?? item.quantity,
                              ).toLocaleString(locale)}{" "}
                              {item.unit}
                            </dd>
                          </div>
                          <div>
                            <dt>Confirmado por</dt>
                            <dd>{item.confirmedBy || "Registro histórico"}</dd>
                          </div>
                        </>
                      )}
                    </dl>

                    {item.notes && (
                      <p className="destination-item-notes">{item.notes}</p>
                    )}
                    {item.completionNotes && (
                      <p className="destination-item-notes completion">
                        {item.completionNotes}
                      </p>
                    )}
                    {isBlocked && (
                      <p className="destination-recall-hold" role="status">
                        Movimentação suspensa por recolhimento ativo.{" "}
                        <a
                          href={`/recolhimento?lote=${encodeURIComponent(item.lotId)}`}
                        >
                          Ver incidente
                        </a>
                      </p>
                    )}

                    <div
                      className="destination-timeline"
                      aria-label={`${t("Histórico da destinação")} ${item.id}`}
                    >
                      {item.history.map((entry, index) => (
                        <div key={`${entry.status}-${entry.date}-${index}`}>
                          <i aria-hidden="true" />
                          <span>
                            <strong>
                              {t(destinationStatus[entry.status])}
                            </strong>
                            <small>{entry.date}</small>
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="destination-actions">
                      {canAdvance && (
                        <button type="button" onClick={() => advance(item)}>
                          {t("Avançar para")}{" "}
                          {t(destinationStatus[upcomingStatus])}
                        </button>
                      )}
                      {!["concluida", "cancelada"].includes(item.status) && (
                        <button
                          type="button"
                          className="cancel"
                          onClick={() => cancel(item)}
                        >
                          Cancelar operação
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}

          {!visible.length && (
            <div className="destination-empty">
              <strong>Nenhuma destinação encontrada</strong>
              <p>Altere o filtro ou registre um novo plano.</p>
            </div>
          )}
        </div>
        {actionFeedback && (
          <p className="destination-action-feedback" role="status">
            {actionFeedback}
          </p>
        )}
      </article>
      <DestinationCompletionDialog
        destination={completionTarget}
        onClose={() => setCompletionTarget(null)}
        onConfirm={complete}
      />
    </Translated>
  );
}
