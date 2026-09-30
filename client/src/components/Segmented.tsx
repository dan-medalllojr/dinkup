import { useId } from 'react';

type Option<T extends string> = { value: T; label: string; hint?: string };

// A radio group styled as a segmented control; keyboard and screen-reader friendly.
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="field segmented">
      <legend>{label}</legend>
      <div className="segmented-options">
        {options.map((o) => (
          <label key={o.value} className={o.value === value ? 'segmented-option is-selected' : 'segmented-option'}>
            <input type="radio" name={name} value={o.value} checked={o.value === value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
            {o.hint ? <span className="segmented-hint">{o.hint}</span> : null}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
