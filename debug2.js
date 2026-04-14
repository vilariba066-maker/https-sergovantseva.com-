const { Client } = require('pg');
const pg = new Client({ connectionString: 'postgresql://bloguser:Blog2026Secure!@localhost:5432/blogdb' });

async function run() {
  await pg.connect();

  // Test if simple string match works
  const { rows: r1 } = await pg.query("SELECT content ~ '<p><img' as matches_img FROM posts WHERE content ~ '/wp-content/images/' LIMIT 1");
  console.log('Matches <p><img:', r1[0].matches_img);

  // Test regex_replace with simpler pattern
  const { rows: r2 } = await pg.query(`
    SELECT 
      length(content) as orig,
      length(regexp_replace(content, '<img[^>]+/wp-content/images/[^>]+>', '', 'g')) as stripped
    FROM posts WHERE content ~ '/wp-content/images/' LIMIT 1
  `);
  console.log('Simple img strip test:', r2[0]);

  // Try stripping paragraph + img
  const { rows: r3 } = await pg.query(`
    SELECT 
      length(content) as orig,
      length(regexp_replace(content, '<p><img[^>]+/wp-content/images/[^>]+></p>', '', 'g')) as stripped
    FROM posts WHERE content ~ '/wp-content/images/' LIMIT 1
  `);
  console.log('p+img strip test:', r3[0]);

  await pg.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
