import { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { createCourtSchema, distanceKm, inCebu, NEARBY_COURT_METERS, type Court, type LatLng, type Place } from '@dinkup/shared';
import { api, ApiError } from './api.ts';
import { firstErrors, type FieldErrors } from './forms.ts';

type Draft = { name: string; address: string; city: string };

/**
 * State for "add a court": a draggable pin, a name, and an address the server
 * fills in from the pin (reverse geocoding) unless the player typed their own.
 */
export function useAddCourt(courts: Court[], onAdded: (court: Court) => void) {
  const [active, setActive] = useState(false);
  const [pin, setPin] = useState<LatLng | null>(null);
  const [fields, setFields] = useState<Draft>({ name: '', address: '', city: '' });
  const edited = useRef<Set<keyof Draft>>(new Set());
  const [looking, setLooking] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  function start() {
    setActive(true);
    setPin(null);
    setFields({ name: '', address: '', city: '' });
    edited.current.clear();
    setErrors({});
    setFormError('');
  }
  const cancel = () => setActive(false);

  function setField(key: keyof Draft, value: string) {
    edited.current.add(key);
    setFields((f) => ({ ...f, [key]: value }));
  }

  // Fill in whatever the player hasn't typed themselves.
  function prefill(place: Partial<Draft>) {
    setFields((f) => ({
      name: edited.current.has('name') || !place.name ? f.name : place.name,
      address: edited.current.has('address') || place.address === undefined ? f.address : place.address,
      city: edited.current.has('city') || place.city === undefined ? f.city : place.city,
    }));
  }

  function pickPlace(place: Place) {
    setPin({ lat: place.lat, lng: place.lng });
    prefill({ name: place.label, address: place.address, city: place.city });
  }

  // Reverse-geocode the pin after it settles (not on every drag frame).
  useEffect(() => {
    if (!active || !pin || !inCebu(pin)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLooking(true);
      api<{ place: Place | null }>('GET', `/geo/reverse?lat=${pin.lat}&lng=${pin.lng}`, undefined, { signal: controller.signal })
        .then((res) => res.place && prefill({ address: res.place.address, city: res.place.city }))
        .catch(() => {}) // the address is optional; the player can type it
        .finally(() => !controller.signal.aborted && setLooking(false));
    }, 700);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [active, pin]);

  // Existing courts close to the pin: probably the same place.
  const nearby = useMemo(() => {
    if (!pin) return [];
    return courts
      .map((c) => ({ court: c, meters: Math.round(distanceKm(c, pin) * 1000) }))
      .filter((x) => x.meters <= NEARBY_COURT_METERS)
      .sort((a, b) => a.meters - b.meters);
  }, [courts, pin]);

  async function save(): Promise<Court | null> {
    setFormError('');
    if (!pin) {
      setFormError('Tap the map where the court is first.');
      return null;
    }
    const parsed = createCourtSchema.safeParse({ ...fields, ...pin });
    if (!parsed.success) {
      setErrors(firstErrors(z.flattenError(parsed.error).fieldErrors));
      return null;
    }
    setErrors({});
    setSaving(true);
    try {
      const res = await api<{ court: Court }>('POST', '/courts', parsed.data);
      setActive(false);
      onAdded(res.court);
      return res.court;
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(firstErrors(err.fields));
        setFormError(err.message);
      } else setFormError('Something went wrong');
      return null;
    } finally {
      setSaving(false);
    }
  }

  const outside = pin !== null && !inCebu(pin);
  return { active, start, cancel, pin, setPin, fields, setField, pickPlace, looking, nearby, outside, errors, formError, saving, save };
}

export type AddCourtState = ReturnType<typeof useAddCourt>;
