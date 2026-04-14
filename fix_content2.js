const { Client } = require('pg');
const pg = new Client({ connectionString: 'postgresql://bloguser:Blog2026Secure!@localhost:5432/blogdb' });

async function run() {
  await pg.connect();

  // Remove <p><img src="/wp-content/images/..."/></p> blocks from all post content
  const { rowCount } = await pg.query(`
    UPDATE posts
    SET content = regexp_replace(content, '<p><img[^>]+/wp-content/images/[^>]+></p>', '', 'g')
    WHERE content ~ '/wp-content/images/'
  `);
  console.log('Posts updated:', rowCount);

  // Verify
  const { rows } = await pg.query("SELECT count(*) as remaining FROM posts WHERE content ~ '/wp-content/images/'");
  console.log('Posts still containing FIFU paths:', rows[0].remaining);

  await pg.end();
}
run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
