import { Component, type ErrorInfo, type ReactNode } from "react";

export default class Screen02AuditLoadBoundary extends Component<
  { children: ReactNode; onReload: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Do not log workflow state or source material from the private audit run.
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="workflow-notice workflow-notice--error" role="alert">
          <strong>Screen 2 Audit could not load.</strong>{" "}
          Your saved workflow remains unchanged.
          <button type="button" onClick={this.props.onReload}>
            Reload workspace
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
