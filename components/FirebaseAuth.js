import { useState } from 'react';
import { useRouter } from 'next/router';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { getFirebase, clearLegacyAuthCookie } from '../utils/auth/firebase-client.mjs';

export default function FirebaseAuth() {
  const router = useRouter();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const changeMode = next => {
    setMode(next);
    setPassword('');
    setMessage('');
    setError('');
  };
  const submit = async event => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError('');
    setMessage('');
    try {
      const auth = getFirebase().auth;
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email.trim());
        setMessage('If this address has an account, password reset instructions are on their way.');
      } else {
        const action = mode === 'signup' ? createUserWithEmailAndPassword : signInWithEmailAndPassword;
        await action(auth, email.trim(), password);
        clearLegacyAuthCookie();
        await router.replace('/');
      }
    } catch {
      setError(mode === 'reset' ? 'Unable to request a reset. Please try again.' : 'Unable to sign in or create an account. Check your details and try again.');
    } finally {
      setPending(false);
    }
  };
  const title = mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Sign in';
  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">Email
          <input className="block border rounded p-2 w-full" type="email" name="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} disabled={pending} />
        </label>
        {mode !== 'reset' && <label className="block">Password
          <input className="block border rounded p-2 w-full" type="password" name="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 12 : undefined} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} disabled={pending} />
        </label>}
        {mode === 'signup' && <p>Use at least 12 characters.</p>}
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        <button className="px-4 py-2 bg-blue-200 rounded" type="submit" disabled={pending}>{pending ? 'Please wait…' : title}</button>
      </form>
      <div className="flex gap-4">
        {mode !== 'signin' && <button type="button" disabled={pending} onClick={() => changeMode('signin')}>Sign in</button>}
        {mode !== 'signup' && <button type="button" disabled={pending} onClick={() => changeMode('signup')}>Create account</button>}
        {mode !== 'reset' && <button type="button" disabled={pending} onClick={() => changeMode('reset')}>Forgot password?</button>}
      </div>
    </div>
  );
}
