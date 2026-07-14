import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AzuriteRouterProvider } from "./app-router.js";
import { AzuriteErrorBoundary } from "./components/AzuriteErrorBoundary.js";
import { readWebSentryConfig } from "./config/sentry-config.js";
import { initializeWebSentry } from "./observability/initialize-web-sentry.js";
import "./styles/global.css";

const sentryConfig = readWebSentryConfig();
await initializeWebSentry(sentryConfig);

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <AzuriteErrorBoundary>
      <AzuriteRouterProvider />
    </AzuriteErrorBoundary>
  </StrictMode>,
);
