const { Client } = require('pg');
const pg = new Client({ connectionString: 'postgresql://bloguser:Blog2026Secure!@localhost:5432/blogdb' });

async function run() {
  await pg.connect();

  const { rows } = await pg.query("SELECT id, content FROM posts WHERE content ~ '/wp-content/images/'");
  if (!rows.length) { console.log('Nothing to fix'); await pg.end(); return; }

  const post = rows[0];
  // Find and remove img tags with /wp-content/images/ using JS
  let content = post.content;
  // Replace <img...wp-content/images...> including cases where > appears inside alt
  // Strategy: find <img, then find the closing > that ends the tag
  let result = '';
  let i = 0;
  while (i < content.length) {
    const imgStart = content.indexOf('<img', i);
    if (imgStart === -1) { result += content.slice(i); break; }
    
    // Check if this img contains wp-content/images
    // Find the closing > of this img tag (handle self-closing />)
    let j = imgStart + 4;
    let inQuote = false;
    let quoteChar = '';
    while (j < content.length) {
      const c = content[j];
      if (inQuote) {
        if (c === quoteChar) inQuote = false;
      } else {
        if (c === '"' || c === "'") { inQuote = true; quoteChar = c; }
        else if (c === '>') { j++; break; }
      }
      j++;
    }
    
    const imgTag = content.slice(imgStart, j);
    if (imgTag.includes('/wp-content/images/')) {
      // Skip this img tag, also check if wrapped in <p>...</p>
      result += content.slice(i, imgStart);
      i = j;
      console.log('Removed img:', imgTag.slice(0, 80) + '...');
    } else {
      result += content.slice(i, j);
      i = j;
    }
  }

  await pg.query('UPDATE posts SET content = $1 WHERE id = $2', [result, post.id]);
  console.log('Fixed post id:', post.id);

  const { rows: verify } = await pg.query("SELECT count(*) FROM posts WHERE content ~ '/wp-content/images/'");
  console.log('Remaining:', verify[0].count);
  await pg.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
