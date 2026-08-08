/**
 * A JSON-compatible value allowed in a native widget preference. Widget
 * preferences deliberately exclude objects and arrays so callers must opt in to
 * every value the native layer can receive.
 */
export type WidgetPreferenceValue = boolean | number | string | null;
export type WidgetPreferences = Record<string, WidgetPreferenceValue>;

export interface WidgetPreferenceField<T extends WidgetPreferenceValue> {
  readonly defaultValue: T;
  /** Converts untrusted persisted/editor input to a safe, bounded value. */
  sanitize(value: unknown): T;
}

export type WidgetPreferenceFields<T extends WidgetPreferences> = {
  readonly [Key in keyof T]: WidgetPreferenceField<T[Key]>;
};

export interface WidgetDefinition<T extends WidgetPreferences> {
  /** Stable, developer-owned identifier. It is never supplied by a user. */
  readonly type: string;
  /** Explicit allowlist of preference keys sent to the native layer. */
  readonly fields: WidgetPreferenceFields<T>;
}

export interface NativeWidget<T extends WidgetPreferences = WidgetPreferences> {
  /** An opaque local UI identifier. Never use an identity, address, or hash. */
  readonly id: string;
  readonly type: string;
  readonly enabled: boolean;
  readonly order: number;
  readonly preferences: T;
}

export interface NativeWidgetConfiguration {
  readonly version: 1;
  readonly widgets: readonly NativeWidget[];
}

export type WidgetRegistry = Readonly<Record<string, WidgetDefinition<WidgetPreferences>>>;

export const MAX_NATIVE_WIDGETS = 12;
export const MAX_WIDGET_ID_LENGTH = 64;
export const MAX_WIDGET_TYPE_LENGTH = 64;

const WIDGET_IDENTIFIER = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidIdentifier(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    WIDGET_IDENTIFIER.test(value)
  );
}

/** Defines a widget using an explicit preference allowlist. */
export function defineWidget<T extends WidgetPreferences>(
  definition: WidgetDefinition<T>
): WidgetDefinition<T> {
  if (!isValidIdentifier(definition.type, MAX_WIDGET_TYPE_LENGTH)) {
    throw new Error("Widget types must be short, stable identifiers.");
  }
  return definition;
}

export function booleanWidgetField(
  defaultValue: boolean
): WidgetPreferenceField<boolean> {
  return {
    defaultValue,
    sanitize: (value) => (typeof value === "boolean" ? value : defaultValue),
  };
}

export function integerWidgetField(
  defaultValue: number,
  minimum: number,
  maximum: number
): WidgetPreferenceField<number> {
  if (!Number.isInteger(defaultValue) || !Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum > maximum) {
    throw new Error("Widget integer fields require an ordered integer range.");
  }

  return {
    defaultValue,
    sanitize: (value) =>
      typeof value === "number" && Number.isFinite(value)
        ? Math.min(maximum, Math.max(minimum, Math.round(value)))
        : defaultValue,
  };
}

/** Limits choices to developer-owned literals rather than arbitrary strings. */
export function enumWidgetField<const T extends string>(
  defaultValue: T,
  values: readonly T[]
): WidgetPreferenceField<T> {
  if (!values.includes(defaultValue) || values.length === 0) {
    throw new Error("Widget enum defaults must be included in a non-empty allowlist.");
  }

  return {
    defaultValue,
    sanitize: (value) =>
      typeof value === "string" && (values as readonly string[]).includes(value)
        ? (value as T)
        : defaultValue,
  };
}

/**
 * Sanitizes a widget's user-controlled preferences. Unknown keys are discarded
 * before the configuration crosses the renderer/native boundary.
 */
export function sanitizeWidgetPreferences<T extends WidgetPreferences>(
  definition: WidgetDefinition<T>,
  value: unknown
): T {
  const input = isRecord(value) ? value : {};
  const result = {} as T;

  for (const key of Object.keys(definition.fields) as (keyof T)[]) {
    const field = definition.fields[key];
    result[key] = field.sanitize(input[key as string]);
  }

  return result;
}

function sanitizeOrder(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(MAX_NATIVE_WIDGETS - 1, Math.floor(value)))
    : null;
}

/**
 * Converts unknown persisted/editor input into the only configuration suitable
 * for native IPC. It carries no balances, identities, addresses, transaction
 * history, or other wallet-derived data. Native code should derive any display
 * data from its own approved snapshot rather than receiving it here.
 */
export function sanitizeNativeWidgetConfiguration(
  value: unknown,
  registry: WidgetRegistry
): NativeWidgetConfiguration {
  const input = isRecord(value) && Array.isArray(value.widgets) ? value.widgets : [];
  const ids = new Set<string>();
  const widgets: NativeWidget[] = [];

  for (const candidate of input) {
    if (widgets.length >= MAX_NATIVE_WIDGETS || !isRecord(candidate)) continue;
    if (!isValidIdentifier(candidate.id, MAX_WIDGET_ID_LENGTH) || ids.has(candidate.id)) continue;
    if (!isValidIdentifier(candidate.type, MAX_WIDGET_TYPE_LENGTH)) continue;

    const definition = registry[candidate.type];
    const order = sanitizeOrder(candidate.order);
    if (!definition || order === null || typeof candidate.enabled !== "boolean") continue;

    ids.add(candidate.id);
    widgets.push({
      id: candidate.id,
      type: candidate.type,
      enabled: candidate.enabled,
      order,
      preferences: sanitizeWidgetPreferences(definition, candidate.preferences),
    });
  }

  return {
    version: 1,
    widgets: widgets.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id)),
  };
}

/** Returns a JSON-safe, allowlisted payload for a future native IPC command. */
export function toNativeWidgetPayload(
  configuration: NativeWidgetConfiguration,
  registry: WidgetRegistry
): NativeWidgetConfiguration {
  return sanitizeNativeWidgetConfiguration(configuration, registry);
}
