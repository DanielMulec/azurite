/** Uncensored Session Replay options for explicit local debug sessions. */
export const uncensoredReplayOptions = {
  blockAllMedia: false,
  maskAllInputs: false,
  maskAllText: false,
} as const;

/** Browser request targets eligible for Sentry trace propagation. */
export const webTracePropagationTargets: readonly (RegExp | string)[] = [
  /^\/api(?:\/|$)/,
  /^\/__azurite\/dev\/sentry-test-event$/,
  "localhost",
  /^https?:\/\/[^/]+\.ts\.net(?::\d+)?\/(?:api|__azurite)\//,
];

/** Parsed browser observability configuration. */
export type WebSentryConfig = {
  readonly development: boolean;
  readonly dsn: string | undefined;
  readonly enabled: boolean;
  readonly environment: string;
  readonly release: string;
  readonly replayErrorSampleRate: number;
  readonly replaySessionSampleRate: number;
  readonly testEventsEnabled: boolean;
  readonly traceSampleRate: number;
};

type WebSentryEnvironment = Readonly<Record<string, string | undefined>>;

const defaultEnvironment = "development";
const defaultRelease = "azurite-local";
const defaultSampleRate = 1;

/** Reads Vite-exposed environment values through the typed web config boundary. */
export function readWebSentryConfig(): WebSentryConfig {
  return parseWebSentryConfig(import.meta.env, import.meta.env.DEV);
}

/** Parses browser observability configuration without depending on its value source. */
export function parseWebSentryConfig(
  environment: WebSentryEnvironment,
  development = true,
): WebSentryConfig {
  const dsn = parseOptionalString(environment.VITE_SENTRY_DSN);

  return {
    development,
    dsn,
    enabled: environment.VITE_SENTRY_ENABLED === "true" && dsn !== undefined,
    environment: parseStringWithFallback(
      environment.VITE_SENTRY_ENVIRONMENT,
      defaultEnvironment,
    ),
    release: parseStringWithFallback(
      environment.VITE_SENTRY_RELEASE,
      defaultRelease,
    ),
    replayErrorSampleRate: parseSampleRate(
      environment.VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE,
      defaultSampleRate,
    ),
    replaySessionSampleRate: parseSampleRate(
      environment.VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE,
      defaultSampleRate,
    ),
    testEventsEnabled: environment.VITE_SENTRY_TEST_EVENTS_ENABLED === "true",
    traceSampleRate: parseSampleRate(
      environment.VITE_SENTRY_TRACE_SAMPLE_RATE,
      defaultSampleRate,
    ),
  };
}

function parseOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length === 0 ? undefined : trimmedValue;
}

function parseSampleRate(value: string | undefined, fallback: number): number {
  const parsedValue = parseOptionalString(value);

  if (parsedValue === undefined) {
    return fallback;
  }

  return normalizeSampleRate(Number(parsedValue)) ?? fallback;
}

function normalizeSampleRate(value: number): number | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  const clampedValue = Math.min(1, Math.max(0, value));
  return Object.is(clampedValue, value) ? value : undefined;
}

function parseStringWithFallback(
  value: string | undefined,
  fallback: string,
): string {
  return parseOptionalString(value) ?? fallback;
}
