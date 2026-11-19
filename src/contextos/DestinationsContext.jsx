import { useEffect, useMemo, useRef } from "react";
import { usePersistedState } from "../hooks/usePersistedState";
import { initialDestinations } from "../paginas/destinacao/modelo/destinationModel";
import { storageKeys } from "../utilitarios/browserStorage";
import { DestinationsContext } from "./useDestinations";
import {
  isPersistedDestination,
  isPersistedDestinationList,
  migratePersistedDestinations,
  normalizePersistedDestination,
} from "./persistenceMigrations";

export function DestinationsProvider({ children }) {
  const [destinations, setDestinations] = usePersistedState(
    storageKeys.destinations,
    initialDestinations,
    isPersistedDestinationList,
    migratePersistedDestinations,
  );
  const destinationsRef = useRef(destinations);

  useEffect(() => {
    destinationsRef.current = destinations;
  }, [destinations]);

  const value = useMemo(
    () => ({
      destinations,
      addDestination(destination, maximumLotQuantity) {
        if (!isPersistedDestination(destination)) {
          return { ok: false, reason: "Registro de destinação inválido." };
        }

        const normalizedDestination =
          normalizePersistedDestination(destination);
        const current = destinationsRef.current;
        if (current.some((item) => item.id === normalizedDestination.id)) {
          return { ok: false, reason: "Esta destinação já foi registrada." };
        }
        if (Number.isFinite(maximumLotQuantity)) {
          const reserved = current
            .filter(
              (item) =>
                item.lotId === normalizedDestination.lotId &&
                item.status !== "cancelada",
            )
            .reduce((total, item) => total + Number(item.quantity || 0), 0);
          if (reserved + normalizedDestination.quantity > maximumLotQuantity) {
            return {
              ok: false,
              reason: "O saldo disponível do lote foi alterado.",
            };
          }
        }
        const next = [normalizedDestination, ...current];
        destinationsRef.current = next;
        setDestinations(next);
        return { ok: true, destination: normalizedDestination };
      },
      updateDestination(destination) {
        if (!isPersistedDestination(destination)) {
          return { ok: false, reason: "Registro de destinação inválido." };
        }

        const normalizedDestination =
          normalizePersistedDestination(destination);
        const next = destinationsRef.current.map((item) =>
          item.id === normalizedDestination.id ? normalizedDestination : item,
        );
        destinationsRef.current = next;
        setDestinations(next);
        return { ok: true, destination: normalizedDestination };
      },
    }),
    [destinations, setDestinations],
  );

  return (
    <DestinationsContext.Provider value={value}>
      {children}
    </DestinationsContext.Provider>
  );
}
