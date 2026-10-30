import { Component, type ErrorInfo, type ReactNode } from "react";

export default class Screen04LoadBoundary extends Component<
  { children: ReactNode; onReload: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Do not log component state: Screen 4 may hold private file mappings.
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="workflow-notice workflow-notice--error" role="alert">
          <strong>Screen 4 could not load.</strong>{" "}
          Your prior screens remain unchanged.
          <button type="button" onClick={this.props.onReload}>
            Reload workspace
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
