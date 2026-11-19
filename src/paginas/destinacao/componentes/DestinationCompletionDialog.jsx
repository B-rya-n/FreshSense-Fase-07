import { useEffect, useRef, useState } from "react";
import { Dialog } from "../../../componentes/Dialog";
import { validateDestinationCompletion } from "../modelo/destinationModel";

function buildValues(destination) {
  return {
    completedQuantity: String(destination?.quantity ?? ""),
    confirmedBy: "",
    completionNotes: "",
  };
}

export function DestinationCompletionDialog({
  destination,
  onClose,
  onConfirm,
}) {
  const [values, setValues] = useState(() => buildValues(destination));
  const [errors, setErrors] = useState({});
  const refs = useRef({});

  useEffect(() => {
    if (!destination) return;
    setValues(buildValues(destination));
    setErrors({});
  }, [destination]);

  if (!destination) return null;

  function update(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function submit(event) {
    event.preventDefault();
    const nextErrors = validateDestinationCompletion(values, destination);
    setErrors(nextErrors);
    const firstInvalid = [
      "completedQuantity",
      "confirmedBy",
      "completionNotes",
    ].find((key) => nextErrors[key]);
    if (firstInvalid) {
      refs.current[firstInvalid]?.focus();
      return;
    }
    onConfirm(values);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy="completion-dialog-title"
      describedBy="completion-dialog-description"
      className="destination-completion-dialog"
    >
      <div className="destination-completion-dialog-heading">
        <span>Confirmação de entrega</span>
        <h2 id="completion-dialog-title">Concluir destinação</h2>
        <p id="completion-dialog-description">
          Registre a quantidade efetivamente entregue para que os resultados
          reflitam a operação real.
        </p>
      </div>
      <form onSubmit={submit} noValidate>
        <dl className="destination-completion-summary">
          <div>
            <dt>Lote</dt>
            <dd>
              {destination.product} · {destination.lotId}
            </dd>
          </div>
          <div>
            <dt>Planejado</dt>
            <dd>
              {Number(destination.quantity).toLocaleString("pt-BR")}{" "}
              {destination.unit}
            </dd>
          </div>
          <div>
            <dt>Destino</dt>
            <dd>{destination.recipient}</dd>
          </div>
        </dl>
        <label htmlFor="completion-quantity">
          Quantidade confirmada
          <input
            id="completion-quantity"
            ref={(node) => {
              refs.current.completedQuantity = node;
            }}
            data-autofocus
            type="number"
            min="0.01"
            max={destination.quantity}
            step="0.01"
            value={values.completedQuantity}
            onChange={(event) =>
              update("completedQuantity", event.target.value)
            }
            aria-invalid={Boolean(errors.completedQuantity)}
            aria-describedby={
              errors.completedQuantity ? "completion-quantity-error" : undefined
            }
          />
          {errors.completedQuantity && (
            <small
              id="completion-quantity-error"
              className="destination-field-error"
            >
              {errors.completedQuantity}
            </small>
          )}
        </label>
        <label htmlFor="completion-confirmed-by">
          Confirmado por
          <input
            id="completion-confirmed-by"
            ref={(node) => {
              refs.current.confirmedBy = node;
            }}
            type="text"
            placeholder="Nome e sobrenome"
            value={values.confirmedBy}
            onChange={(event) => update("confirmedBy", event.target.value)}
            aria-invalid={Boolean(errors.confirmedBy)}
            aria-describedby={
              errors.confirmedBy ? "completion-confirmed-by-error" : undefined
            }
          />
          {errors.confirmedBy && (
            <small
              id="completion-confirmed-by-error"
              className="destination-field-error"
            >
              {errors.confirmedBy}
            </small>
          )}
        </label>
        <label htmlFor="completion-notes">
          Observação <small>(obrigatória se houver diferença)</small>
          <textarea
            id="completion-notes"
            ref={(node) => {
              refs.current.completionNotes = node;
            }}
            rows="3"
            maxLength="240"
            value={values.completionNotes}
            onChange={(event) => update("completionNotes", event.target.value)}
            aria-invalid={Boolean(errors.completionNotes)}
            aria-describedby={
              errors.completionNotes ? "completion-notes-error" : undefined
            }
          />
          {errors.completionNotes && (
            <small
              id="completion-notes-error"
              className="destination-field-error"
            >
              {errors.completionNotes}
            </small>
          )}
        </label>
        <div className="destination-completion-actions">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit">Confirmar conclusão</button>
        </div>
      </form>
    </Dialog>
  );
}
