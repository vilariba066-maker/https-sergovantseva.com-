'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push('/admin');
        router.refresh();
      } else {
        setError('Invalid password');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f1f3f4',
      fontFamily: '"Google Sans", Roboto, Arial, sans-serif',
    }}>
      <div style={{
        background: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: 8,
        padding: '40px 48px',
        width: 360,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔑</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 400, color: '#3c4043' }}>Admin Panel</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#80868b' }}>sergovantseva.com</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#3c4043', marginBottom: 6, fontWeight: 500 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #dadce0',
                borderRadius: 4,
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
                color: '#3c4043',
              }}
            />
          </div>

          {error && (
            <div style={{
              color: '#d93025',
              fontSize: 12,
              marginBottom: 16,
              padding: '8px 12px',
              background: '#fce8e6',
              borderRadius: 4,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px',
              background: loading ? '#e8eaed' : '#1a73e8',
              color: loading ? '#80868b' : '#fff',
              border: 'none',
              borderRadius: 4,
              fontSize: 14,
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
