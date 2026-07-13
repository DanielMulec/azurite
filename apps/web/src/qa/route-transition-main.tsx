import { createRoot } from "react-dom/client";

import { AzuriteRouterProvider } from "../app-router.js";
import { AzuriteErrorBoundary } from "../components/AzuriteErrorBoundary.js";
import { readWebSentryConfig } from "../config/sentry-config.js";
import { initializeWebSentry } from "../observability/initialize-web-sentry.js";
import "../../qa/route-transition/qa.css";
import { RouteTransitionQaPanel } from "./RouteTransitionQaPanel.js";
import {
  createRouteTransitionQaController,
  type RouteTransitionQaController,
} from "./route-transition-controller.js";

declare global {
  interface Window {
    __azuriteRouteTransitionQa: RouteTransitionQaController;
  }
}

const sentryConfig = readWebSentryConfig();
await initializeWebSentry(sentryConfig);
const controller = createRouteTransitionQaController();
window.__azuriteRouteTransitionQa = controller;

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(
  <AzuriteErrorBoundary>
    <AzuriteRouterProvider
      createRouteGate={controller.createRouteGate}
      runtimeOptions={{ confirmRestoration: controller.confirmRestoration }}
    />
    <RouteTransitionQaPanel controller={controller} />
  </AzuriteErrorBoundary>,
);
