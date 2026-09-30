import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { registerSchema, type PreferredFormat, type SkillLevel } from '@dinkup/shared';
import { SelectField, TextField } from '../components/Field.tsx';
import { useAuth } from '../lib/auth.tsx';
import { errorsFromApi, validate, type FieldErrors } from '../lib/forms.ts';
import { formatOptions, levelOptions } from '../lib/labels.ts';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
    skillLevel: '3.0' as SkillLevel,
    preferredFormat: 'either' as PreferredFormat,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const { data, errors } = validate(registerSchema, values);
    setErrors(errors ?? {});
    setFormError('');
    if (!data) return;

    setSubmitting(true);
    try {
      await register(data);
      navigate('/profile', { replace: true });
    } catch (err) {
      const { form, fields } = errorsFromApi(err);
      setFormError(form);
      setErrors(fields);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card narrow">
      <h1>Join Dinkup</h1>
      <p className="muted">Find players and games around Cebu.</p>
      <form onSubmit={onSubmit} noValidate>
        <TextField label="Name" autoComplete="name" value={values.name} onChange={(e) => set('name', e.target.value)} error={errors.name} />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(e) => set('email', e.target.value)}
          error={errors.email}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={(e) => set('password', e.target.value)}
          error={errors.password}
          hint="At least 8 characters"
        />
        <SelectField
          label="Skill level"
          value={values.skillLevel}
          onChange={(e) => set('skillLevel', e.target.value as SkillLevel)}
          options={levelOptions}
          error={errors.skillLevel}
          hint="Your best guess. You'll level up by winning confirmed games."
        />
        <SelectField
          label="Preferred format"
          value={values.preferredFormat}
          onChange={(e) => set('preferredFormat', e.target.value as PreferredFormat)}
          options={formatOptions}
          error={errors.preferredFormat}
        />
        {formError ? <p className="form-error" role="alert">{formError}</p> : null}
        <button className="button button-block" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="muted center">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </section>
  );
}
