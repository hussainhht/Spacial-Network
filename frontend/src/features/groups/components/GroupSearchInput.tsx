"use client";

interface GroupSearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

export default function GroupSearchInput({
  value,
  onChange,
}: GroupSearchInputProps) {
  return (
    <div className="group-search">
      <svg
        className="group-search-icon"
        aria-hidden="true"
        viewBox="0 0 20 20"
        width="16"
        height="16"
      >
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Zm5.5 12L17 18"
        />
      </svg>
      <input
        type="search"
        className="group-search-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search groups..."
        aria-label="Search groups"
      />
      {value.length > 0 && (
        <button
          type="button"
          className="group-search-clear"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
}
