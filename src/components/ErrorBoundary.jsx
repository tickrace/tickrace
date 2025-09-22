// src/components/ErrorBoundary.jsx
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { this.setState({ info }); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-3xl mx-auto p-6 my-10 rounded-2xl border border-red-200 bg-red-50">
          <h2 className="text-lg font-semibold text-red-700">Une erreur est survenue dans cette page</h2>
          <p className="text-sm text-red-800 mt-2">{String(this.state.error?.message || this.state.error)}</p>
          {process.env.NODE_ENV !== "production" && this.state.info?.componentStack && (
            <pre className="mt-3 text-xs text-red-900 whitespace-pre-wrap">{this.state.info.componentStack}</pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
