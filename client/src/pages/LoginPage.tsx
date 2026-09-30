import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { loginSchema } from '@dinkup/shared';
import { DemoButton } from '../components/DemoButton.tsx';
import { TextField } from '../components/Field.tsx';
import { useAuth } from '../lib/auth.tsx';
import { errorsFromApi, validate, type FieldErrors } from '../lib/forms.ts';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const { data, errors } = validate(loginSchema, values);
    setErrors(errors ?? {});
    setFormError('');
    if (!data) return;

    setSubmitting(true);
    try {
      await login(data);
      navigate(from, { replace: true });
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
      <h1>Log in</h1>
      <form onSubmit={onSubmit} noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
          error={errors.email}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={(e) => setValues({ ...values, password: e.target.value })}
          error={errors.password}
        />
        {formError ? <p className="form-error" role="alert">{formError}</p> : null}
        <button className="button button-block" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="muted center">
        New to Dinkup? <Link to="/register">Create an account</Link>
      </p>
      <div className="demo-cta">
        <span className="muted small">Just looking around?</span>
        <DemoButton className="button button-ghost button-small" label="Try the demo, no signup" />
      </div>
    </section>
  );
}
