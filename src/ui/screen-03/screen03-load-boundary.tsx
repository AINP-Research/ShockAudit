import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";

export function Screen03LoadFailure({ onReload }: { onReload: () => void }) {
  return (
    <div className="workflow-notice workflow-notice--warning" role="alert">
      <strong>Screen 3 could not load.</strong>{" "}
      Your saved ShockAudit workflow is still intact. Reload this card to fetch
      its latest no-cache app. If this release was retired, open the latest
      ShockAudit card in the conversation.
      <button
        type="button"
        onClick={onReload}
        data-testid="screen03-load-reload"
      >
        Reload this ShockAudit card
      </button>
    </div>
  );
}

export default class Screen03LoadBoundary extends Component<
  { children: ReactNode; onReload: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    console.warn("ShockAudit could not load the Screen 3 UI chunk.");
  }

  render() {
    return this.state.failed
      ? <Screen03LoadFailure onReload={this.props.onReload} />
      : this.props.children;
  }
}
