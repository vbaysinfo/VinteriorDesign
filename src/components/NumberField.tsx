import React, { useEffect, useState } from 'react';

interface NumberFieldProps {
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  title?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLInputElement>) => void;
  // Shows the field blank (so `placeholder` reads through) instead of
  // literal "0" when the committed value is 0 and it isn't focused -
  // for fields where 0 means "unset" (e.g. depth 0 = civil frame).
  zeroAsEmpty?: boolean;
  // Accepts a decimal point (e.g. ft measurements like "8.5") and commits
  // with parseFloat instead of parseInt.
  decimal?: boolean;
}

// A plain text field for numbers that only pushes a value upstream on blur
// or Enter - never on every keystroke. Several fields in this app feed a
// live recalculation the instant they change (ft<->mm round-trips, shutter-
// width redistribution across the other doors, area/volume recompute).
// Wiring a native <input type="number"> straight to onChange for one of
// those fights the person typing: clearing the field to retype it briefly
// parses as 0 and the recalculated, re-rounded value gets written back into
// the same box before the next keystroke lands, so digits seem to vanish or
// jump around. Keeping the field's own text as local state while it's
// focused, and only parsing/committing once editing is done, fixes that -
// what you type is what stays on screen until you're done.
export const NumberField: React.FC<NumberFieldProps> = ({ value, onCommit, min, className, zeroAsEmpty, decimal, ...rest }) => {
  const displayValue = (v: number) => (zeroAsEmpty && v === 0 ? '' : String(v));
  const [text, setText] = useState(displayValue(value));
  const [focused, setFocused] = useState(false);

  // Only resync from the outside value while the field isn't being typed
  // into - otherwise a sibling field's recalculation (e.g. redistributing
  // the other shutters) would overwrite what's mid-edit here too.
  useEffect(() => {
    if (!focused) setText(displayValue(value));
  }, [value, focused]);

  const commit = () => {
    const cleaned = text.replace(decimal ? /[^\d.-]/g : /[^\d-]/g, '');
    const parsed = decimal ? parseFloat(cleaned) : parseInt(cleaned, 10);
    const finalValue = Number.isFinite(parsed) ? (min !== undefined ? Math.max(min, parsed) : parsed) : value;
    setText(displayValue(finalValue));
    if (finalValue !== value) onCommit(finalValue);
  };

  return (
    <input
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setText(String(value));
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={className}
      {...rest}
    />
  );
};
