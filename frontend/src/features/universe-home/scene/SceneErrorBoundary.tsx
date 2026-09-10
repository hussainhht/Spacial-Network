"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

export default class SceneErrorBoundary extends Component<
  {
    children: ReactNode;
    label: string;
    fallback?: ReactNode;
    onError?: () => void;
  },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[Universe Home] ${this.props.label}`, error, info.componentStack);
    this.props.onError?.();
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
