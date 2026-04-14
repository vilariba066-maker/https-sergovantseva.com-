const { execSync } = require('child_process');
const { Client } = require('pg');

const pgClient = new Client({
  connectionString: 'postgresql://bloguser:Blog2026Secure!@localhost:5432/blogdb'
});

function mysqlQuery(sql) {
  try {
    const result = execSync(
      `mysql -u wordpress -p'^Q@mdbw25An7iRfIL%' wordpress --batch --skip-column-names -e ${JSON.stringify(sql)}`,
      { maxBuffer: 500 * 1024 * 1024, stdio: ['pipe','pipe','pipe'] }
    ).toString();
    return result.trim().split('\n').filter(Boolean).map(row => row.split('\t'));
  } catch(e) {
    console.error('MySQL error:', e.stderr?.toString());
    throw e;
  }
}

function cleanContent(html) {
  if (!html) return html;
  return html
    .replace(/<!--\s*wp:[\s\S]*?-->/g, '')
    .replace(/<!--\s*\/wp:[\s\S]*?-->/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

function extractFirstImage(html) {
  if (!html) return null;
  const match = html.match(/<img[^>]+src="([^"]+)"/);
  return match ? match[1] : null;
}

function slugify(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9а-яё\-]+/gi, '-').replace(/^-+|-+$/, '').substring(0, 200) || 'post-' + Date.now();
}

async function migrate() {
  await pgClient.connect();
  console.log('PostgreSQL подключён');

  // 1. Категории
  console.log('\n=== Категории ===');
  const terms = mysqlQuery("SELECT t.term_id, t.name, t.slug FROM wp_terms t JOIN wp_term_taxonomy tt ON t.term_id = tt.term_id WHERE tt.taxonomy = 'category'");
  console.log('Найдено категорий:', terms.length);
  for (const [id, name, slug] of terms) {
    const s = (slug || slugify(name));
    await pgClient.query(
      'INSERT INTO categories (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (slug) DO NOTHING',
      [id.toString(), name, s]
    );
  }
  console.log('Категории импортированы');

  // 2. SEO мета
  console.log('\n=== Загружаем SEO мета ===');
  const seoMeta = {};
  const metaRows = mysqlQuery("SELECT post_id, meta_key, meta_value FROM wp_postmeta WHERE meta_key IN ('_yoast_wpseo_title','_yoast_wpseo_metadesc','_yoast_wpseo_focuskw','_thumbnail_id')");
  for (const [pid, key, val] of metaRows) {
    if (!seoMeta[pid]) seoMeta[pid] = {};
    seoMeta[pid][key] = val;
  }
  console.log('SEO мета загружено для постов:', Object.keys(seoMeta).length);

  // 3. Медиа
  console.log('=== Загружаем медиа ===');
  const mediaRows = mysqlQuery("SELECT ID, guid FROM wp_posts WHERE post_type='attachment'");
  const mediaMap = {};
  for (const [id, guid] of mediaRows) mediaMap[id] = guid;
  console.log('Медиа файлов:', mediaRows.length);

  // 4. Посты
  console.log('\n=== Посты ===');
  const posts = mysqlQuery("SELECT ID, post_title, post_content, post_excerpt, post_name, post_date, post_modified FROM wp_posts WHERE post_status='publish' AND post_type='post' ORDER BY ID");
  console.log('Найдено постов:', posts.length);

  let imported = 0;
  for (const [id, title, content, excerpt, slug, date, modified] of posts) {
    const cleanedContent = cleanContent(content);
    const thumbnailId = seoMeta[id] && seoMeta[id]['_thumbnail_id'];
    const featuredImage = thumbnailId ? mediaMap[thumbnailId] : extractFirstImage(content);
    const postSlug = slug || slugify(title);

    await pgClient.query(
      'INSERT INTO posts (id, slug, title, content, excerpt, featured_image, status, seo_title, seo_description, seo_keywords, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, updated_at=EXCLUDED.updated_at',
      [
        id.toString(), postSlug, title || '', cleanedContent || '', excerpt || '',
        featuredImage || null, 'published',
        (seoMeta[id] && seoMeta[id]['_yoast_wpseo_title']) || null,
        (seoMeta[id] && seoMeta[id]['_yoast_wpseo_metadesc']) || null,
        (seoMeta[id] && seoMeta[id]['_yoast_wpseo_focuskw']) || null,
        new Date(date), new Date(modified)
      ]
    );
    imported++;
    if (imported % 200 === 0) console.log('  Импортировано:', imported);
  }
  console.log('Постов импортировано:', imported);

  // 5. Связи пост-категория
  console.log('\n=== Связи пост-категория ===');
  const relations = mysqlQuery("SELECT tr.object_id, tt.term_id FROM wp_term_relationships tr JOIN wp_term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id WHERE tt.taxonomy='category'");
  let relCount = 0;
  for (const [postId, catId] of relations) {
    try {
      await pgClient.query(
        'INSERT INTO post_categories (post_id, category_id) VALUES ($1, $2) ON CONFLICT (post_id, category_id) DO NOTHING',
        [postId.toString(), catId.toString()]
      );
      relCount++;
    } catch(e) {}
  }
  console.log('Связей импортировано:', relCount);

  console.log('\n=== ГОТОВО ===');
  await pgClient.end();
}

migrate().catch(e => { console.error('ОШИБКА:', e.message); process.exit(1); });
