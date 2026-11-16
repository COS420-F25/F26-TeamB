// KAIte/react/components/redaction/DecisionCheckbox.tsx
//
// One review-table checkbox. A tick always means "this leaves the shared
// output" (hidden or left out); the caller decides what that maps to.

export interface DecisionCheckboxProps {
  checked: boolean;
  ariaLabel: string;
  onChange: (checked: boolean) => void;
}

export function DecisionCheckbox({ checked, ariaLabel, onChange }: DecisionCheckboxProps) {
  return (
    <label className="f-check">
      <input
        type="checkbox"
        checked={checked}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
    </label>
  );
}
