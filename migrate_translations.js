const { execSync } = require('child_process');
const { Client } = require('pg');

const pg = new Client({ connectionString: 'postgresql://bloguser:Blog2026Secure!@localhost:5432/blogdb' });

function mysqlQuery(sql) {
  const r = execSync(
    `mysql -u wordpress -p'^Q@mdbw25An7iRfIL%' wordpress --batch --skip-column-names -e ${JSON.stringify(sql)}`,
    { maxBuffer: 1024 * 1024 * 1024, stdio: ['pipe','pipe','pipe'] }
  ).toString();
  return r.trim().split('\n').filter(Boolean).map(row => row.split('\t'));
}

// Маппинг TranslatePress lang -> ISO код
const LANG_MAP = {
  'en_gb': 'en', 'ru_ru': 'ru', 'de_de': 'de', 'el': 'el',
  'es_es': 'es', 'fr_fr': 'fr', 'it_it': 'it', 'pl_pl': 'pl',
  'pt_pt': 'pt', 'tr_tr': 'tr', 'uk': 'uk'
};

async function migrate() {
  await pg.connect();
  console.log('Подключён к PostgreSQL');

  // Получаем все посты из PG
  const pgPosts = await pg.query('SELECT id, slug FROM posts');
  const postBySlug = {};
  for (const row of pgPosts.rows) postBySlug[row.slug] = row.id;
  console.log('Постов в PG:', pgPosts.rows.length);

  // Для каждой пары языков (оригинал -> перевод)
  const tables = [
    ['en_gb', 'de_de'], ['en_gb', 'el'], ['en_gb', 'es_es'],
    ['en_gb', 'fr_fr'], ['en_gb', 'it_it'], ['en_gb', 'pl_pl'],
    ['en_gb', 'pt_pt'], ['en_gb', 'ru_ru'], ['en_gb', 'tr_tr'], ['en_gb', 'uk'],
    ['ru_ru', 'de_de'], ['ru_ru', 'el'], ['ru_ru', 'en_gb'],
    ['ru_ru', 'es_es'], ['ru_ru', 'fr_fr'], ['ru_ru', 'it_it'],
    ['ru_ru', 'pl_pl'], ['ru_ru', 'pt_pt'], ['ru_ru', 'tr_tr'], ['ru_ru', 'uk']
  ];

  // Получаем slug переводы из TranslatePress
  console.log('\n=== Slug переводы ===');
  let slugTranslations = {};
  try {
    const slugRows = mysqlQuery('SELECT original, translated, language_code FROM wp_trp_slug_translations st JOIN wp_trp_slug_originals so ON st.original_id = so.id');
    for (const [orig, trans, lang] of slugRows) {
      const isoLang = LANG_MAP[lang] || lang;
      if (!slugTranslations[isoLang]) slugTranslations[isoLang] = {};
      slugTranslations[isoLang][orig] = trans;
    }
    console.log('Slug переводов загружено для языков:', Object.keys(slugTranslations).length);
  } catch(e) {
    console.log('Slug переводы недоступны:', e.message);
  }

  // Получаем переводы заголовков и контента через trp_original_strings + словари
  console.log('\n=== Переводы контента ===');

  // Сначала получим оригинальные строки
  const origStrings = {};
  try {
    const origRows = mysqlQuery('SELECT id, original FROM wp_trp_original_strings LIMIT 100000');
    for (const [id, orig] of origRows) origStrings[id] = orig;
    console.log('Оригинальных строк:', origRows.length);
  } catch(e) {
    console.log('Оригинальные строки:', e.message);
  }

  // Для каждого поста получим переводы заголовков
  // TranslatePress хранит переводы строки к строке, не привязывая к посту
  // Собираем title переводы из словарей
  const titleTranslations = {}; // lang -> { orig_title -> trans_title }

  for (const [fromLang, toLang] of tables) {
    const tableName = `wp_trp_dictionary_${fromLang}_${toLang}`;
    const isoTo = LANG_MAP[toLang] || toLang;

    try {
      const rows = mysqlQuery(`SELECT original, translated FROM ${tableName} WHERE translated != '' AND translated IS NOT NULL LIMIT 500000`);
      if (!titleTranslations[isoTo]) titleTranslations[isoTo] = {};
      for (const [orig, trans] of rows) {
        if (orig && trans) titleTranslations[isoTo][orig] = trans;
      }
      console.log(`  ${tableName}: ${rows.length} строк`);
    } catch(e) {
      console.log(`  ${tableName}: пропущено (${e.message.slice(0,50)})`);
    }
  }

  // Теперь для каждого поста ищем переводы заголовков
  console.log('\n=== Импорт переводов в PostgreSQL ===');
  const wpPosts = mysqlQuery("SELECT ID, post_title, post_name FROM wp_posts WHERE post_status='publish' AND post_type='post'");

  let totalTranslations = 0;
  const langs = ['de','el','es','fr','it','pl','pt','ru','tr','uk','en'];

  for (const [wpId, wpTitle, wpSlug] of wpPosts) {
    const pgPostId = postBySlug[wpSlug];
    if (!pgPostId) continue;

    for (const lang of langs) {
      const transTitle = titleTranslations[lang] && titleTranslations[lang][wpTitle];
      const transSlug = slugTranslations[lang] && slugTranslations[lang][wpSlug];

      if (transTitle || transSlug) {
        try {
          await pg.query(
            'INSERT INTO post_translations (id, post_id, lang, title, slug, translated_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW()) ON CONFLICT (post_id, lang) DO UPDATE SET title=EXCLUDED.title, slug=EXCLUDED.slug',
            [pgPostId, lang, transTitle || null, transSlug || null]
          );
          totalTranslations++;
        } catch(e) {
          console.error('Ошибка вставки перевода:', e.message.slice(0,100));
        }
      }
    }
  }

  console.log('Переводов импортировано:', totalTranslations);
  console.log('\n=== ПЕРЕВОДЫ ГОТОВЫ ===');
  await pg.end();
}

migrate().catch(e => { console.error('КРИТИЧЕСКАЯ ОШИБКА:', e.message); process.exit(1); });
