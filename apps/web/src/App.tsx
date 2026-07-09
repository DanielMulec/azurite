import type { ReactElement } from "react";

import { getApplicationTitle } from "./app-title.js";
import { NoteEditorSurface } from "./components/NoteEditorSurface.js";
import { NoteList } from "./components/NoteList.js";
import {
  isSentryDiagnosticsPanelEnabled,
  SentryDiagnosticsPanel,
} from "./components/SentryDiagnosticsPanel.js";
import { readWebSentryConfig } from "./config/sentry-config.js";
import { useNoteBrowser } from "./use-note-browser.js";

type AppProps = {
  readonly devDiagnostics?: "sentry-test" | undefined;
  readonly navigation: {
    readonly pushSelectedNote: (noteId: string) => void;
    readonly replaceSelectedNote: (noteId: string) => void;
  };
  readonly routeNoteId: string | undefined;
};

/** Root React component for the current Azurite web shell. */
export function App({
  devDiagnostics,
  navigation,
  routeNoteId,
}: AppProps): ReactElement {
  const browser = useNoteBrowser({ navigation, routeNoteId });
  const sentryConfig = readWebSentryConfig();
  const showSentryDiagnostics = isSentryDiagnosticsPanelEnabled(
    sentryConfig,
    devDiagnostics,
  );

  return (
    <main className="min-h-screen bg-[var(--azurite-background)] text-[var(--azurite-text)]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-4 md:grid md:grid-cols-[20rem_minmax(0,1fr)] md:px-6 md:py-6">
        <header className="md:col-span-2">
          <h1 className="text-2xl font-semibold tracking-normal">
            {getApplicationTitle()}
          </h1>
        </header>
        {showSentryDiagnostics ? (
          <SentryDiagnosticsPanel config={sentryConfig} />
        ) : null}
        <NoteList
          notesState={browser.notesState}
          onSelectNote={browser.selectNote}
          selectedNoteId={browser.selectedNoteId}
        />
        <NoteEditorSurface
          draftRecoveryStatus={browser.draftRecoveryStatus}
          onDiscardDraftAndReloadDiskVersion={
            browser.discardDraftAndReloadDiskVersion
          }
          onDiscardMissingDraft={browser.discardMissingDraft}
          onMarkdownChange={browser.updateDraftMarkdown}
          noteState={browser.noteState}
          onSaveNote={browser.saveSelectedNote}
          onEditorModeChange={browser.updateEditorMode}
        />
      </div>
    </main>
  );
}
