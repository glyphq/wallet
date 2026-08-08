import {
  sanitizeNativeWidgetConfiguration,
  type NativeWidgetConfiguration,
  type WidgetRegistry,
} from "@/lib/widgets";

export interface WidgetConfigurationState {
  readonly configuration: NativeWidgetConfiguration;
  /** Lets an editor detect a local configuration change without retaining wallet data. */
  readonly revision: number;
}

export type WidgetConfigurationAction =
  | { readonly type: "replace"; readonly configuration: unknown }
  | { readonly type: "upsert"; readonly widget: unknown }
  | { readonly type: "remove"; readonly id: string }
  | { readonly type: "set-enabled"; readonly id: string; readonly enabled: boolean }
  | { readonly type: "set-preferences"; readonly id: string; readonly preferences: unknown }
  | { readonly type: "reorder"; readonly ids: readonly string[] };

export function createWidgetConfigurationState(
  configuration: unknown,
  registry: WidgetRegistry
): WidgetConfigurationState {
  return {
    configuration: sanitizeNativeWidgetConfiguration(configuration, registry),
    revision: 0,
  };
}

function sanitizeWidgets(
  widgets: readonly unknown[],
  registry: WidgetRegistry
): NativeWidgetConfiguration {
  return sanitizeNativeWidgetConfiguration({ version: 1, widgets }, registry);
}

/**
 * Pure editor state reducer. It only handles allowlisted configuration and must
 * not be given balance, identity, address, or transaction data.
 */
export function reduceWidgetConfiguration(
  state: WidgetConfigurationState,
  action: WidgetConfigurationAction,
  registry: WidgetRegistry
): WidgetConfigurationState {
  const current = state.configuration.widgets;
  let configuration: NativeWidgetConfiguration;

  switch (action.type) {
    case "replace":
      configuration = sanitizeNativeWidgetConfiguration(action.configuration, registry);
      break;
    case "upsert": {
      const candidate = action.widget as { id?: unknown };
      const withoutExisting = current.filter((widget) => widget.id !== candidate.id);
      configuration = sanitizeWidgets([...withoutExisting, action.widget], registry);
      break;
    }
    case "remove":
      configuration = sanitizeWidgets(
        current.filter((widget) => widget.id !== action.id),
        registry
      );
      break;
    case "set-enabled":
      configuration = sanitizeWidgets(
        current.map((widget) =>
          widget.id === action.id ? { ...widget, enabled: action.enabled } : widget
        ),
        registry
      );
      break;
    case "set-preferences":
      configuration = sanitizeWidgets(
        current.map((widget) =>
          widget.id === action.id
            ? { ...widget, preferences: action.preferences }
            : widget
        ),
        registry
      );
      break;
    case "reorder": {
      const requestedIds = new Set<string>();
      const requested = action.ids.flatMap((id) => {
        if (requestedIds.has(id)) return [];
        requestedIds.add(id);
        const widget = current.find((candidate) => candidate.id === id);
        return widget ? [widget] : [];
      });
      const remaining = current.filter((widget) => !requestedIds.has(widget.id));
      configuration = sanitizeWidgets(
        [...requested, ...remaining].map((widget, order) => ({ ...widget, order })),
        registry
      );
      break;
    }
  }

  return {
    configuration,
    revision: state.revision + 1,
  };
}
