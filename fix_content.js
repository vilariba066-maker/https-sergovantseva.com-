const { Client } = require('pg');
const pg = new Client({ connectionString: 'postgresql://bloguser:Blog2026Secure!@localhost:5432/blogdb' });

async function run() {
  await pg.connect();

  // Count posts to update
  const { rows: cnt } = await pg.query("SELECT count(*) FROM posts WHERE content ~ '/wp-content/images/'");
  console.log('Posts with FIFU images:', cnt[0].count);

  // Preview one
  const { rows: preview } = await pg.query(`
    SELECT length(content) as before_len,
           length(regexp_replace(content, '<p><img\s[^>]*src="/wp-content/images/[^"]*"[^>]*/></p>', '', 'g')) as after_len
    FROM posts WHERE content ~ '/wp-content/images/' LIMIT 1
  `);
  console.log('Preview (before/after length):', preview[0]);

  // Run the actual update
  const { rowCount } = await pg.query(`
    UPDATE posts
    SET content = regexp_replace(content, '<p><img\s[^>]*src="/wp-content/images/[^"]*"[^>]*/></p>', '', 'g')
    WHERE content ~ '/wp-content/images/'
  `);
  console.log('Updated rows:', rowCount);

  // Verify
  const { rows: verify } = await pg.query("SELECT count(*) FROM posts WHERE content ~ '/wp-content/images/'");
  console.log('Posts still with FIFU images:', verify[0].count);

  await pg.end();
}
run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
