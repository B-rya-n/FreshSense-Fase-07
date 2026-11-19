import { useMemo } from "react";
import { useLots } from "../../../contextos/useLots";
import { useDestinations } from "../../../contextos/useDestinations";
import { useOperations } from "../../../contextos/useOperations";
import { Translated } from "../../../traducoes/I18nContext";
import { useI18n } from "../../../traducoes/useI18n";
import { DestinationForm } from "./DestinationForm";
import { DestinationList } from "./DestinationList";
import {
  formatDestinationVolume,
  institutions,
} from "../modelo/destinationModel";

export function DestinationWorkspace() {
  const { language } = useI18n();
  const locale = language === "pt" ? "pt-BR" : language;
  const { lots } = useLots();
  const { destinations } = useDestinations();
  const {
    planDestination,
    progressDestination,
    confirmDestination,
    cancelDestination,
    recalls,
  } = useOperations();
  const blockedLotIds = recalls
    .filter((recall) => recall.status !== "encerrado")
    .map((recall) => recall.lotId);
  const initialLotId =
    new URLSearchParams(window.location.search).get("lote") ?? "";
  const committedVolume = useMemo(
    () =>
      formatDestinationVolume(
        destinations.filter((item) => item.status !== "cancelada"),
        locale,
      ),
    [destinations, locale],
  );
  const completedVolume = useMemo(
    () =>
      formatDestinationVolume(
        destinations.filter((item) => item.status === "concluida"),
        locale,
        { confirmed: true },
      ),
    [destinations, locale],
  );
  const activeOperations = destinations.filter(
    (item) => !["concluida", "cancelada"].includes(item.status),
  ).length;

  return (
    <Translated>
      <section className="section destination-section">
        <div className="container">
          <div className="destination-kpis" aria-label="Resumo das destinações">
            <article>
              <span>Operações em andamento</span>
              <strong>{activeOperations}</strong>
              <small>planos aguardando conclusão</small>
            </article>
            <article>
              <span>Volume comprometido</span>
              <strong>{committedVolume}</strong>
              <small>em destinações não canceladas</small>
            </article>
            <article>
              <span>Volume concluído</span>
              <strong>{completedVolume}</strong>
              <small>em operações finalizadas</small>
            </article>
          </div>

          <div className="destination-intro">
            <div>
              <span>Fluxo conectado</span>
              <h2>Da identificação do risco à ação operacional</h2>
            </div>
            <p>
              Os saldos vêm diretamente da Gestão de Lotes. As validações
              impedem quantidades indisponíveis, datas inválidas e registros sem
              responsável.
            </p>
          </div>

          <div className="destination-grid">
            <DestinationForm
              key={initialLotId || "destination-form"}
              lots={lots}
              destinations={destinations}
              institutions={institutions}
              initialLotId={initialLotId}
              blockedLotIds={blockedLotIds}
              onCreate={planDestination}
            />
            <DestinationList
              destinations={destinations}
              blockedLotIds={blockedLotIds}
              onAdvance={progressDestination}
              onConfirm={confirmDestination}
              onCancel={cancelDestination}
            />
          </div>

          <p className="destination-data-note">
            Ambiente demonstrativo: os registros são mantidos localmente pelo
            React neste navegador. A liberação sanitária deve ser confirmada
            pela equipe responsável antes de qualquer movimentação.
          </p>
        </div>
      </section>
    </Translated>
  );
}
