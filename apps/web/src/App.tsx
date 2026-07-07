import type { ReactElement } from "react";

import { getApplicationTitle } from "./app-title.js";
import { NoteList } from "./components/NoteList.js";
import { NoteViewer } from "./components/NoteViewer.js";
import { useNoteBrowser } from "./use-note-browser.js";

/** Root React component for the current Azurite web shell. */
export function App(): ReactElement {
  const browser = useNoteBrowser();

  return (
    <main className="min-h-screen bg-[var(--azurite-background)] text-[var(--azurite-text)]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-4 md:grid md:grid-cols-[20rem_minmax(0,1fr)] md:px-6 md:py-6">
        <header className="md:col-span-2">
          <h1 className="text-2xl font-semibold tracking-normal">
            {getApplicationTitle()}
          </h1>
        </header>
        <NoteList
          notesState={browser.notesState}
          onSelectNote={browser.selectNote}
          selectedNoteId={browser.selectedNoteId}
        />
        <NoteViewer noteState={browser.noteState} />
      </div>
    </main>
  );
}
