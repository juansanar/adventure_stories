import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("UI error:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="errorBoundary">
          <h1 className="errorBoundaryTitle">Something went wrong</h1>
          <p className="errorBoundaryText">
            The page hit an error. If you were using on-device AI, try template
            mode or reload after closing other heavy tabs.
          </p>
          <pre className="errorBoundaryPre">{this.state.error.message}</pre>
          <button
            type="button"
            className="errorBoundaryBtn"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
