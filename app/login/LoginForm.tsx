'use client';

import { useActionState } from 'react';
import { login, type LoginState } from './actions';

export default function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ''} />
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" placeholder="nama@perusahaan.id" />
      </div>
      <div>
        <label htmlFor="password" className="label">Kata sandi</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{state.error}</p>
      )}
      <button type="submit" disabled={pending} className="btn-primary btn-lg w-full">
        {pending ? 'Memproses…' : 'Masuk'}
      </button>
    </form>
  );
}
