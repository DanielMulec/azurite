import "@tanstack/history";

declare module "@tanstack/history" {
  interface HistoryState {
    readonly __azurite_navigation_token?: string;
  }
}
