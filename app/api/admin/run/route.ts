import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

const APP_DIR = '/var/www/nextblog';

type ScriptDef = { file: string; args: string[]; background?: boolean };

const SCRIPTS: Record<string, ScriptDef> = {
  'translate-seo':     { file: 'translate-remaining.js', args: ['--seo-only', '--batch=100'], background: true },
  'sitemap-gen':       { file: 'sitemap-gate.js',        args: ['--generate'] },
  'sitemap-submit':    { file: 'sitemap-gate.js',        args: ['--generate', '--submit'] },
  'quality-check':     { file: 'quality-gate.js',        args: ['--failing'] },
  'auto-linker-stats': { file: 'auto-linker.js',         args: ['--stats'] },
  'auto-linker-run':   { file: 'auto-linker.js',         args: ['--run', '--limit=100'], background: true },
  'content-stats':     { file: 'content-improver.js',    args: ['--stats'] },
  'retranslate-check': { file: 'retranslate-fakes.js',   args: ['--check'] },
  'gsc-stats':         { file: 'gsc-feedback-loop.js',   args: ['--stats'] },
  'gsc-run':           { file: 'gsc-feedback-loop.js',   args: ['--run', '--limit=50'], background: true },
};

function checkAuth(req: NextRequest): boolean {
  const token = req.cookies.get('admin_session')?.value;
  const pass  = process.env.ADMIN_PASSWORD ?? 'admin2026';
  return token === btoa(pass);
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { script } = await req.json();
  const def = SCRIPTS[script];
  if (!def) {
    return NextResponse.json({ error: 'Unknown script: ' + script }, { status: 400 });
  }

  // Background scripts: spawn detached, return immediately
  if (def.background) {
    const proc = spawn('node', ['scripts/' + def.file, ...def.args], {
      cwd: APP_DIR,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env },
    });
    proc.unref();
    return NextResponse.json({
      ok: true,
      output: `Script "${def.file} ${def.args.join(' ')}" started in background.\nCheck /var/log/translate.log for progress.`,
      background: true,
    });
  }

  // Foreground scripts: wait up to 60s and capture output
  return new Promise<NextResponse>((resolve) => {
    const proc = spawn('node', ['scripts/' + def.file, ...def.args], {
      cwd: APP_DIR,
      env: { ...process.env },
    });

    let output = '';
    proc.stdout.on('data', (d: Buffer) => { output += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { output += d.toString(); });

    const timeout = setTimeout(() => {
      proc.kill();
      resolve(NextResponse.json({
        ok: false,
        output: output.slice(-4000) + '\n\n[Timeout after 60s — script may still be running]',
      }));
    }, 60_000);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      resolve(NextResponse.json({
        ok: code === 0,
        output: output.slice(-6000),
        exitCode: code,
      }));
    });

    proc.on('error', (err: Error) => {
      clearTimeout(timeout);
      resolve(NextResponse.json({ ok: false, error: err.message }, { status: 500 }));
    });
  });
}
