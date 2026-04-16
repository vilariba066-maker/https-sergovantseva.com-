'use client';
import { useState } from 'react';

type Script = {
  id: string;
  label: string;
  description: string;
  background?: boolean;
  danger?: boolean;
};

const SCRIPTS: Script[] = [
  { id: 'translate-seo',      label: 'Translate SEO fields',  description: '--seo-only --batch=100', background: true },
  { id: 'sitemap-gen',        label: 'Regenerate Sitemap',    description: '--generate' },
  { id: 'sitemap-submit',     label: 'Submit Sitemap',        description: '--generate --submit' },
  { id: 'quality-check',      label: 'Quality Gate',          description: '--failing (top 50)' },
  { id: 'auto-linker-stats',  label: 'Link Stats',            description: '--stats' },
  { id: 'auto-linker-run',    label: 'Auto-link 100 posts',   description: '--run --limit=100', background: true },
  { id: 'content-stats',      label: 'Content Stats',         description: '--stats' },
  { id: 'retranslate-check',  label: 'Check Fake Translations', description: '--check' },
  { id: 'gsc-stats',          label: 'GSC Opportunity Report',  description: '--stats (CTR < 3%)' },
  { id: 'gsc-run',            label: 'GSC Feedback Loop',       description: '--run --limit=50 (background)' },
];

export function ScriptRunner() {
  const [running, setRunning] = useState<string | null>(null);
  const [output, setOutput] = useState<{ script: string; text: string; ok: boolean } | null>(null);

  async function run(script: Script) {
    setRunning(script.id);
    setOutput(null);
    try {
      const res = await fetch('/api/admin/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: script.id }),
      });
      const data = await res.json();
      setOutput({
        script: script.label,
        text: data.output || data.error || 'No output',
        ok: data.ok !== false,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setOutput({ script: script.label, text: msg, ok: false });
    } finally {
      setRunning(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {SCRIPTS.map(s => (
          <div key={s.id} style={{
            background: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: 8,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}>
            <div style={{ fontWeight: 500, fontSize: 13, color: '#3c4043' }}>{s.label}</div>
            <div style={{ fontSize: 11, color: '#80868b', fontFamily: 'monospace' }}>{s.description}</div>
            {s.background && (
              <div style={{ fontSize: 10, color: '#f29900' }}>⚡ Runs in background</div>
            )}
            <button
              onClick={() => run(s)}
              disabled={running !== null}
              style={{
                marginTop: 4,
                padding: '6px 12px',
                background: running === s.id ? '#e8eaed' : '#1a73e8',
                color: running === s.id ? '#80868b' : '#fff',
                border: 'none',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 500,
                cursor: running !== null ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {running === s.id ? '⟳ Running…' : '▶ Run'}
            </button>
          </div>
        ))}
      </div>

      {output && (
        <div style={{ marginTop: 20 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 8, fontSize: 13, fontWeight: 500, color: '#3c4043',
          }}>
            <span style={{ color: output.ok ? '#1e8e3e' : '#d93025' }}>
              {output.ok ? '✓' : '✗'}
            </span>
            {output.script}
          </div>
          <pre style={{
            background: '#1e1e1e',
            color: '#d4d4d4',
            padding: '14px 16px',
            borderRadius: 6,
            fontSize: 11,
            lineHeight: 1.6,
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 400,
            overflowY: 'auto',
            margin: 0,
          }}>
            {output.text}
          </pre>
        </div>
      )}
    </div>
  );
}
