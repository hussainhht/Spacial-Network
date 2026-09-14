"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import styles from "./SegmentedTabs.module.css";

export interface SegmentedTabOption<Value extends string> {
  value: Value;
  label: ReactNode;
  disabled?: boolean;
}

interface SegmentedTabsProps<Value extends string> {
  value: Value;
  options: readonly SegmentedTabOption<Value>[];
  onChange: (value: Value) => void;
  ariaLabel: string;
  idPrefix: string;
  panelId: string | ((value: Value) => string);
  className?: string;
}

interface IndicatorRect {
  left: number;
  width: number;
}

export default function SegmentedTabs<Value extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  idPrefix,
  panelId,
  className,
}: SegmentedTabsProps<Value>) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = useState<IndicatorRect | null>(null);
  const selectedIndex = options.findIndex((option) => option.value === value);

  useEffect(() => {
    const list = listRef.current;
    const activeTab = tabRefs.current[selectedIndex];
    if (!list || !activeTab) return;

    const updateIndicator = () => {
      const listRect = list.getBoundingClientRect();
      const tabRect = activeTab.getBoundingClientRect();
      setIndicator({
        left: tabRect.left - listRect.left - list.clientLeft,
        width: tabRect.width,
      });
    };

    updateIndicator();

    if (typeof ResizeObserver === "undefined") return;

    const resizeObserver = new ResizeObserver(updateIndicator);
    resizeObserver.observe(list);
    tabRefs.current.forEach((tab) => {
      if (tab) resizeObserver.observe(tab);
    });

    return () => resizeObserver.disconnect();
  }, [selectedIndex, options]);

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    const enabledIndexes = options
      .map((option, index) => (option.disabled ? -1 : index))
      .filter((index) => index !== -1);
    const currentPosition = enabledIndexes.indexOf(currentIndex);

    if (currentPosition === -1) return;

    let nextPosition: number | undefined;

    switch (event.key) {
      case "ArrowLeft":
        nextPosition =
          (currentPosition - 1 + enabledIndexes.length) % enabledIndexes.length;
        break;
      case "ArrowRight":
        nextPosition = (currentPosition + 1) % enabledIndexes.length;
        break;
      case "Home":
        nextPosition = 0;
        break;
      case "End":
        nextPosition = enabledIndexes.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextIndex = enabledIndexes[nextPosition];
    const nextOption = options[nextIndex];

    onChange(nextOption.value);
    tabRefs.current[nextIndex]?.focus();
  }

  const rootClassName = className
    ? `${styles.root} ${className}`
    : styles.root;

  return (
    <div
      ref={listRef}
      className={rootClassName}
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      data-segmented-tabs=""
    >
      {indicator && (
        <div
          className={styles.indicator}
          style={{
            transform: `translateX(${indicator.left}px)`,
            width: `${indicator.width}px`,
          }}
          aria-hidden="true"
        />
      )}
      {options.map((option, index) => {
        const isSelected = value === option.value;
        const controlledPanelId =
          typeof panelId === "function" ? panelId(option.value) : panelId;

        return (
          <button
            key={option.value}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${option.value}`}
            aria-selected={isSelected}
            aria-controls={controlledPanelId}
            tabIndex={isSelected ? 0 : -1}
            disabled={option.disabled}
            className={styles.tab}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
