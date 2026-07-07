import type { ReactElement } from "react";

import { getApplicationTitle } from "./app-title.js";

export function App(): ReactElement {
  return (
    <main>
      <h1>{getApplicationTitle()}</h1>
      <p>Workspace note browsing starts in the next slice.</p>
    </main>
  );
}
