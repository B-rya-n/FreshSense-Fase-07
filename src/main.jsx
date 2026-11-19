import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { LotesProvider } from "./contextos/LotesContext";
import { RescueOperationsProvider } from "./contextos/RescueOperationsContext";
import { DestinationsProvider } from "./contextos/DestinationsContext";
import { I18nProvider } from "./traducoes/I18nContext";
import { OperationsProvider } from "./contextos/OperationsContext";
import "./estilos/index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <I18nProvider>
      <LotesProvider>
        <DestinationsProvider>
          <RescueOperationsProvider>
            <OperationsProvider>
              <App />
            </OperationsProvider>
          </RescueOperationsProvider>
        </DestinationsProvider>
      </LotesProvider>
    </I18nProvider>
  </React.StrictMode>,
);
