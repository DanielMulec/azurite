import { createRoot } from "react-dom/client";

import { AzuriteRouterProvider } from "./app-router.js";
import "./styles/global.css";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(<AzuriteRouterProvider />);
