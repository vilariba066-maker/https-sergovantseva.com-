import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import { ScriptRunner } from './_components/ScriptRunner';

const prisma = new PrismaClient();

// ─── Types ────────────────────────────────────────────────────────────────────

type TransStat = {
  lang:          string;
  total:         number;
  has_excerpt:   number;
  has_seo:       number;
  has_content:   number;
  has_sitemap:   number;
  hreflang_ok:   number;
};

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getDashboardData() {
  const [
    postCount,
    draftCount,
    transTotal,
    transWithContent,
    hreflangReady,
    postsWithLinks,
    translationStats,
  ] = await Promise.all([
    prisma.post.count({ where: { status: 'published' } }),
    prisma.post.count({ where: { status: 'draft' } }),
    prisma.postTranslation.count(),
    prisma.postTranslation.count({ where: { content: { not: null } } }),
    prisma.postTranslation.count({
      where: {
        isReal: true,
        sitemapAt: { not: null },
      },
    }),
    // posts with at least one internal-link class
    prisma.$queryRaw<[{ cnt: number }]>`
      SELECT COUNT(*)::int AS cnt
      FROM posts
      WHERE status = 'published'
        AND content LIKE '%class="internal-link"%'
    `,
    prisma.$queryRaw<TransStat[]>`
      SELECT
        pt.lang,
        COUNT(*)::int                                                     AS total,
        COUNT(pt.excerpt)::int                                            AS has_excerpt,
        COUNT(pt.seo_title)::int                                          AS has_seo,
        COUNT(pt.content)::int                                            AS has_content,
        COUNT(pt.sitemap_at)::int                                         AS has_sitemap,
        COUNT(
          CASE WHEN pt.is_real
                AND pt.sitemap_at IS NOT NULL
                AND pt.title IS DISTINCT FROM p.title
               THEN 1 END
        )::int                                                            AS hreflang_ok
      FROM post_translations pt
      JOIN posts p ON p.id = pt.post_id
      GROUP BY pt.lang
      ORDER BY COUNT(*) DESC, pt.lang
    `,
  ]);

  // Read translate log (last 30 lines)
  let logLines: string[] = [];
  try {
    const raw = fs.readFileSync('/var/log/translate.log', 'utf8');
    logLines = raw.split('\n').filter(Boolean).slice(-30).reverse();
  } catch { /* log might not exist yet */ }

  return {
    postCount,
    draftCount,
    transTotal,
    transWithContent,
    hreflangReady,
    postsWithLinks: postsWithLinks[0]?.cnt ?? 0,
    translationStats,
    logLines,
  };
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

function pct(n: number, total: number) {
  if (!total) return '0%';
  return Math.round((n / total) * 100) + '%';
}

function Bar({ value, total, color = '#1a73e8' }: { value: number; total: number; color?: string }) {
  const w = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div style={{ background: '#e8eaed', borderRadius: 2, height: 4, marginTop: 4 }}>
      <div style={{ background: color, width: w + '%', height: '100%', borderRadius: 2, transition: 'width 0.3s' }} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminPage() {
  const d = await getDashboardData();

  const card: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: 8,
    padding: '20px 24px',
  };
  const section: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: 8,
    padding: 24,
    marginBottom: 24,
  };
  const h2: React.CSSProperties = {
    margin: '0 0 20px',
    fontSize: 16,
    fontWeight: 500,
    color: '#3c4043',
    borderBottom: '1px solid #f1f3f4',
    paddingBottom: 12,
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Page header ─────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 400, color: '#3c4043' }}>Dashboard</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#80868b' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* ── Overview cards ──────────────────────────────────── */}
      <div id="overview" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Published posts', value: d.postCount,       sub: d.draftCount + ' drafts',          color: '#1a73e8' },
          { label: 'Translations',    value: d.transTotal,      sub: d.transWithContent + ' with content', color: '#1e8e3e' },
          { label: 'Hreflang-ready',  value: d.hreflangReady,   sub: pct(d.hreflangReady, d.transTotal) + ' of total', color: '#f29900' },
          { label: 'Internal links',  value: d.postsWithLinks,  sub: pct(d.postsWithLinks, d.postCount) + ' of posts', color: '#9334e6' },
        ].map(c => (
          <div key={c.label} style={card}>
            <div style={{ fontSize: 28, fontWeight: 400, color: c.color, marginBottom: 4 }}>
              {c.value.toLocaleString()}
            </div>
            <div style={{ fontSize: 13, color: '#3c4043', fontWeight: 500 }}>{c.label}</div>
            <div style={{ fontSize: 11, color: '#80868b', marginTop: 2 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Translation progress ─────────────────────────────── */}
      <div id="translations" style={section}>
        <h2 style={h2}>Translations by Language</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: '#80868b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                {['Lang', 'Total', 'Excerpt', 'SEO title', 'Content', 'Sitemap', 'Hreflang ✓'].map(h => (
                  <th key={h} style={{ padding: '0 12px 10px', textAlign: h === 'Lang' ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.translationStats.map((row, i) => (
                <tr key={row.lang} style={{ background: i % 2 === 0 ? '#f8f9fa' : '#fff' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: '#3c4043', fontFamily: 'monospace' }}>
                    {row.lang.toUpperCase()}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#3c4043' }}>
                    {Number(row.total).toLocaleString()}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <span style={{ color: Number(row.has_excerpt) === Number(row.total) ? '#1e8e3e' : '#d93025' }}>
                      {Number(row.has_excerpt).toLocaleString()}
                    </span>
                    <span style={{ color: '#80868b', fontSize: 10, marginLeft: 4 }}>
                      {pct(Number(row.has_excerpt), Number(row.total))}
                    </span>
                    <Bar value={Number(row.has_excerpt)} total={Number(row.total)} color="#1e8e3e" />
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <span style={{ color: Number(row.has_seo) === Number(row.total) ? '#1e8e3e' : '#f29900' }}>
                      {Number(row.has_seo).toLocaleString()}
                    </span>
                    <span style={{ color: '#80868b', fontSize: 10, marginLeft: 4 }}>
                      {pct(Number(row.has_seo), Number(row.total))}
                    </span>
                    <Bar value={Number(row.has_seo)} total={Number(row.total)} color="#f29900" />
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <span style={{ color: Number(row.has_content) > 0 ? '#1e8e3e' : '#80868b' }}>
                      {Number(row.has_content).toLocaleString()}
                    </span>
                    <span style={{ color: '#80868b', fontSize: 10, marginLeft: 4 }}>
                      {pct(Number(row.has_content), Number(row.total))}
                    </span>
                    <Bar value={Number(row.has_content)} total={Number(row.total)} color="#9334e6" />
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#3c4043' }}>
                    {Number(row.has_sitemap).toLocaleString()}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <span style={{
                      color: Number(row.hreflang_ok) > 100 ? '#1e8e3e' : '#d93025',
                      fontWeight: 500,
                    }}>
                      {Number(row.hreflang_ok).toLocaleString()}
                    </span>
                    <Bar value={Number(row.hreflang_ok)} total={Number(row.total)} color="#1a73e8" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Sitemap ──────────────────────────────────────────── */}
      <div id="sitemap" style={{ ...section, marginBottom: 24 }}>
        <h2 style={h2}>Sitemap Files</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {['trans-index.xml', 'trans-1.xml', 'trans-2.xml', 'trans-3.xml', 'trans-4.xml'].map(f => (
            <a
              key={f}
              href={`https://sergovantseva.com/sitemaps/${f}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                background: '#e8f0fe',
                color: '#1a73e8',
                borderRadius: 6,
                fontSize: 12,
                textDecoration: 'none',
                fontFamily: 'monospace',
              }}
            >
              🗺 {f}
            </a>
          ))}
          <a
            href="https://sergovantseva.com/sitemap.xml"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', background: '#fce8e6', color: '#d93025',
              borderRadius: 6, fontSize: 12, textDecoration: 'none', fontFamily: 'monospace',
            }}
          >
            🗺 sitemap.xml (main)
          </a>
        </div>
        <p style={{ margin: '12px 0 0', fontSize: 12, color: '#80868b' }}>
          GSC submission URL: <code style={{ background: '#f1f3f4', padding: '2px 6px', borderRadius: 3 }}>
            https://sergovantseva.com/sitemaps/trans-index.xml
          </code>
        </p>
      </div>

      {/* ── Quality gate summary ─────────────────────────────── */}
      <div id="quality" style={{ ...section, marginBottom: 24 }}>
        <h2 style={h2}>Quality Gate</h2>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {[
            { label: 'Posts with internal links', value: d.postsWithLinks, total: d.postCount, color: '#1a73e8' },
            { label: 'Hreflang-ready translations', value: d.hreflangReady, total: d.transTotal, color: '#1e8e3e' },
          ].map(item => (
            <div key={item.label} style={{ ...card, flex: '1 1 280px' }}>
              <div style={{ fontSize: 22, fontWeight: 400, color: item.color }}>
                {item.value.toLocaleString()} / {item.total.toLocaleString()}
              </div>
              <div style={{ fontSize: 13, color: '#3c4043', marginTop: 4 }}>{item.label}</div>
              <Bar value={item.value} total={item.total} color={item.color} />
            </div>
          ))}
        </div>
        <p style={{ margin: '16px 0 0', fontSize: 12, color: '#80868b' }}>
          Run the Quality Gate script below to see the full breakdown of failing posts.
        </p>
      </div>

      {/* ── Script runner ────────────────────────────────────── */}
      <div id="scripts" style={section}>
        <h2 style={h2}>Scripts</h2>
        <ScriptRunner />
      </div>

      {/* ── Recent log ───────────────────────────────────────── */}
      <div id="log" style={section}>
        <h2 style={h2}>Recent Translation Log <span style={{ fontSize: 11, color: '#80868b', fontWeight: 400 }}>/var/log/translate.log (last 30 lines)</span></h2>
        {d.logLines.length === 0 ? (
          <p style={{ fontSize: 13, color: '#80868b', margin: 0 }}>No log entries found.</p>
        ) : (
          <pre style={{
            background: '#1e1e1e',
            color: '#d4d4d4',
            padding: '16px',
            borderRadius: 6,
            fontSize: 11,
            lineHeight: 1.7,
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: 320,
            overflowY: 'auto',
            margin: 0,
          }}>
            {d.logLines.join('\n')}
          </pre>
        )}
      </div>

    </div>
  );
}
