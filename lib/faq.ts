// lib/faq.ts — Extract FAQPage schema from H2/H3 question headings

interface FaqItem {
  '@type': 'Question';
  name: string;
  acceptedAnswer: {
    '@type': 'Answer';
    text: string;
  };
}

export interface FaqSchema {
  '@context': 'https://schema.org';
  '@type': 'FAQPage';
  mainEntity: FaqItem[];
}

/**
 * Scans post HTML for H2/H3 headings containing "?".
 * For each question heading, captures the following paragraph(s) as the answer.
 * Returns null when no question headings are found.
 * Caps at 10 items (Google's recommended limit for FAQPage).
 */
export function buildFaqSchema(html: string): FaqSchema | null {
  if (!html) return null;

  // Collect all h2/h3 headings with their start/end positions
  const headingRe = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
  const segments: { text: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;

  while ((m = headingRe.exec(html)) !== null) {
    const text = m[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&[a-zA-Z#0-9]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    segments.push({ text, start: m.index, end: m.index + m[0].length });
  }

  if (segments.length === 0) return null;

  const mainEntity: FaqItem[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg.text.includes('?')) continue;

    // Answer: HTML between the end of this heading and start of the next heading
    const contentEnd = i + 1 < segments.length
      ? segments[i + 1].start
      : html.length;

    const answerHtml = html.slice(seg.end, Math.min(contentEnd, seg.end + 3000));

    const answerText = answerHtml
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-zA-Z#0-9]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);

    if (!answerText) continue;

    mainEntity.push({
      '@type': 'Question',
      name: seg.text,
      acceptedAnswer: { '@type': 'Answer', text: answerText },
    });

    if (mainEntity.length >= 10) break;
  }

  if (mainEntity.length === 0) return null;

  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity };
}
