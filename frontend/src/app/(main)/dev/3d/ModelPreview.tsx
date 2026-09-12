"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode, useState, useEffect } from "react";
import { DEV_MODELS, type DevModel } from "./modelsRegistry";
import styles from "./page.module.css";

// Separate, valid dynamic imports for 3D components
const Earth3D = dynamic(() => import("@/components/space/Earth3D"), {
  ssr: false,
  loading: () => (
    <div className={styles.message} role="status">
      <p>Loading Earth...</p>
    </div>
  ),
});

const ModelViewer = dynamic(() => import("./ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className={styles.message} role="status">
      <p>Initializing 3D viewer...</p>
    </div>
  ),
});

interface PreviewBoundaryProps {
  children: ReactNode;
  model: DevModel;
}

interface PreviewBoundaryState {
  failed: boolean;
  error?: Error;
}

class PreviewBoundary extends Component<
  PreviewBoundaryProps,
  PreviewBoundaryState
> {
  state: PreviewBoundaryState = { failed: false };

  static getDerivedStateFromError(error: Error): PreviewBoundaryState {
    return { failed: true, error };
  }

  componentDidUpdate(prevProps: PreviewBoundaryProps) {
    if (prevProps.model.id !== this.props.model.id && this.state.failed) {
      this.setState({ failed: false, error: undefined });
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className={styles.message} role="alert">
          <p>Unable to load {this.props.model.name} model.</p>
          <p className={styles.errorMessage}>
            {this.state.error?.message ||
              `Check ${this.props.model.path} and WebGL support, then reload to try again.`}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ failed: false, error: undefined })}
          >
            Retry loading
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ModelPreview() {
  const [selectedId, setSelectedId] = useState<string>("earth");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("model");
    if (p && DEV_MODELS.some((m) => m.id === p)) {
      setSelectedId(p);
    }
  }, []);

  const currentModel =
    DEV_MODELS.find((m) => m.id === selectedId) ?? DEV_MODELS[0];

  return (
    <>
      {/* Model Selector */}
      <div className={styles.selectorContainer}>
        <div
          className={styles.selector}
          role="tablist"
          aria-label="3D Model Selection"
        >
          {DEV_MODELS.map((model) => {
            const isSelected = model.id === currentModel.id;
            return (
              <button
                key={model.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`${styles.selectorButton} ${
                  isSelected ? styles.selectorButtonActive : ""
                }`}
                onClick={() => setSelectedId(model.id)}
              >
                <span className={styles.selectorDot} aria-hidden="true" />
                <span>{model.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3D Preview with ONE Canvas */}
      <section
        className={styles.preview}
        aria-label={`${currentModel.name} model preview`}
      >
        <div className={styles.viewerHeader} aria-hidden="true">
          <span className={styles.viewerTitle}>{currentModel.name}</span>
          <span className={styles.viewerSubtitle}>{currentModel.subtitle}</span>
        </div>

        <PreviewBoundary model={currentModel}>
          <ModelViewer model={currentModel} />
        </PreviewBoundary>
      </section>

      <p className={styles.hint}>
        Drag to rotate · Wheel or pinch to zoom · Panning disabled
      </p>

      {/* Dynamic Metadata Panel */}
      <dl className={styles.info}>
        <div>
          <dt>Model</dt>
          <dd>{currentModel.filename}</dd>
        </div>
        <div>
          <dt>Format</dt>
          <dd>{currentModel.format}</dd>
        </div>
        {currentModel.triangles !== undefined && (
          <div>
            <dt>Triangles</dt>
            <dd>{currentModel.triangles.toLocaleString()}</dd>
          </div>
        )}
        <div>
          <dt>Status</dt>
          <dd>Development Preview</dd>
        </div>
      </dl>

      <p className={styles.hint}>{currentModel.description}</p>
    </>
  );
}

// Preserve Earth3D export reference for standalone import compatibility if needed
export { Earth3D };
