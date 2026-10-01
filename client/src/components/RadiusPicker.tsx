import { NEAR_RADII_KM } from '@dinkup/shared';
import { Segmented } from './Segmented.tsx';

export function RadiusPicker({ value, onChange }: { value: number; onChange: (km: number) => void }) {
  return (
    <div className="near-radius">
      <Segmented
        label="How far?"
        value={String(value)}
        options={NEAR_RADII_KM.map((km) => ({ value: String(km), label: `${km} km` }))}
        onChange={(v) => onChange(Number(v))}
      />
    </div>
  );
}
