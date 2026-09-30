import type { Court } from '@dinkup/shared';
import type { AddCourtState } from '../lib/useAddCourt.ts';
import { TextField } from './Field.tsx';

// The form half of "add a court"; the map half is the draggable pin.
export function AddCourtPanel({ add, onUseExisting }: { add: AddCourtState; onUseExisting: (court: Court) => void }) {
  return (
    <div
      className="add-court"
      // This panel can sit inside the Post a game form: Enter saves the court,
      // it must not submit the game.
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
          e.preventDefault();
          void add.save();
        }
      }}
    >
      <p className="notice">
        {add.pin ? 'Drag the orange pin to the exact spot if needed.' : 'Tap the map where the court is, or search for the place above.'}
      </p>
      {add.outside ? <p className="form-error">That spot is outside Cebu. Dinkup only lists courts in Cebu.</p> : null}
      {add.nearby.length > 0 ? (
        <div className="notice notice-warn">
          <strong>Is it one of these?</strong>
          <ul>
            {add.nearby.slice(0, 3).map(({ court, meters }) => (
              <li key={court.id}>
                {court.name} <span className="muted small">({meters} m away)</span>{' '}
                <button type="button" className="link-button small" onClick={() => onUseExisting(court)}>
                  Use this one
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <TextField label="Court name" placeholder="e.g. Barangay Lahug Covered Court" value={add.fields.name} onChange={(e) => add.setField('name', e.target.value)} error={add.errors.name} />
      <TextField
        label="Address"
        placeholder={add.looking ? 'Looking up the address…' : 'Street, barangay'}
        value={add.fields.address}
        onChange={(e) => add.setField('address', e.target.value)}
        error={add.errors.address}
        hint="Filled in from the pin. Edit it if it's off."
      />
      <TextField label="City" value={add.fields.city} onChange={(e) => add.setField('city', e.target.value)} error={add.errors.city} />
      {add.errors.lat ? <p className="form-error">{add.errors.lat}</p> : null}
      {add.formError ? (
        <p className="form-error" role="alert">
          {add.formError}
        </p>
      ) : null}
      <p className="muted small">New courts show up for everyone, labeled with your name.</p>
      <div className="add-court-actions">
        <button type="button" className="button button-ghost" onClick={add.cancel}>
          Cancel
        </button>
        <button type="button" className="button" onClick={() => void add.save()} disabled={add.saving || !add.pin || add.outside}>
          {add.saving ? 'Adding…' : 'Add court'}
        </button>
      </div>
    </div>
  );
}
