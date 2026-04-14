const { Client } = require('pg');
const pg = new Client({ connectionString: 'postgresql://bloguser:Blog2026Secure!@localhost:5432/blogdb' });

async function run() {
  await pg.connect();

  const { rows } = await pg.query("SELECT substring(content, 1, 200) as snippet FROM posts WHERE content ~ '/wp-content/images/' LIMIT 1");
  const snippet = rows[0].snippet;
  console.log('Raw snippet:');
  console.log(JSON.stringify(snippet));
  console.log('\nVisible:');
  console.log(snippet);

  await pg.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
