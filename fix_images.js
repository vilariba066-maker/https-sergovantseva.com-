const { execSync } = require('child_process');
const { Client } = require('pg');

const pg = new Client({ connectionString: 'postgresql://bloguser:Blog2026Secure!@localhost:5432/blogdb' });

function mysql(sql) {
  const r = execSync(
    'mysql -u wordpress "-p^Q@mdbw25An7iRfIL%" wordpress --batch --skip-column-names -e ' + JSON.stringify(sql),
    { maxBuffer: 50 * 1024 * 1024 }
  ).toString();
  return r.trim().split('\n').filter(Boolean).map(l => l.split('\t'));
}

async function run() {
  await pg.connect();

  const { rows: pgPosts } = await pg.query('SELECT id, slug FROM posts WHERE featured_image IS NULL');
  const slugToId = {};
  for (const r of pgPosts) slugToId[r.slug] = r.id;
  console.log('Постов без изображения:', pgPosts.length);

  const sql = "SELECT p.post_name, att.guid FROM wp_posts p JOIN wp_postmeta pm ON pm.post_id = p.ID AND pm.meta_key = '_thumbnail_id' JOIN wp_posts att ON att.ID = pm.meta_value AND att.post_type = 'attachment' WHERE p.post_type = 'post' AND p.post_status = 'publish' AND att.guid LIKE '%/wp-content/uploads/%'";
  const wpRows = mysql(sql);

  const wpImages = {};
  for (const row of wpRows) {
    if (row.length === 2 && row[0] && row[1]) {
      wpImages[row[0]] = row[1].replace('http://137.184.177.72', 'https://sergovantseva.com');
    }
  }
  console.log('WP изображений найдено:', Object.keys(wpImages).length);

  let updated = 0;
  for (const [slug, id] of Object.entries(slugToId)) {
    if (wpImages[slug]) {
      await pg.query('UPDATE posts SET featured_image = $1 WHERE id = $2', [wpImages[slug], id]);
      updated++;
    }
  }
  console.log('Обновлено:', updated);

  const res = await pg.query("SELECT COUNT(*) FILTER (WHERE featured_image IS NOT NULL) as with_img, COUNT(*) FILTER (WHERE featured_image IS NULL) as without_img FROM posts");
  console.log('С изображением:', res.rows[0].with_img, '| Без:', res.rows[0].without_img);
  await pg.end();
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
