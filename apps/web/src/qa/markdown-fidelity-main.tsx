import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "../../qa/markdown-fidelity/qa.css";
import { MarkdownFidelityQaApp } from "./MarkdownFidelityQaApp.js";
import {
  createMarkdownFidelityQaController,
  type MarkdownFidelityQaController,
} from "./markdown-fidelity-controller.js";

declare global {
  interface Window {
    __azuriteMarkdownFidelityQa: MarkdownFidelityQaController;
  }
}

const controller = createMarkdownFidelityQaController();
window.__azuriteMarkdownFidelityQa = controller;
const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <MarkdownFidelityQaApp controller={controller} />
  </StrictMode>,
);
