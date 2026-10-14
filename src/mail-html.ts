import { CONTACT, SITE_URL, type Lang } from './content.ts'

const INK = '#101010'
const PAPER = '#f4f1ea'
const YELLOW = '#f5c400'
const MUTED = '#6b665c'
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** Blank lines start a new paragraph; single line breaks stay line breaks. */
function paragraphs(text: string): string {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map(
      (block) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${INK};">${escapeHtml(block.trim()).replace(/\n/g, '<br>')}</p>`,
    )
    .join('')
}

const LABELS: Record<Lang, { button: string; tagline: string }> = {
  nl: { button: 'Afspraak plannen', tagline: 'Kapper en barbier in Axel' },
  en: { button: 'Book a visit', tagline: 'Barber in Axel' },
}

/**
 * The branded HTML version of a mail whose text Bjorn writes in Settings.
 * Tables and inline styles only, so it renders the same in Gmail, Outlook and Apple Mail.
 */
export function mailHtml(text: string, lang: Lang, subject = ''): string {
  const labels = LABELS[lang]
  const preheader = text.trim().split('\n').find((line) => line.trim() && !/^(hoi|hi)\b/i.test(line.trim())) ?? ''
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader.trim())}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #d9d3c7;">
<tr><td style="background:${INK};padding:22px 28px;border-bottom:4px solid ${YELLOW};">
<a href="${SITE_URL}" style="text-decoration:none;"><img src="${SITE_URL}/logo-lockup-white.png?v=3" width="150" alt="Bjorn’s Barber" style="display:block;border:0;width:150px;height:auto;color:#ffffff;font-family:${FONT};font-size:20px;font-weight:700;"></a>
</td></tr>
<tr><td style="padding:28px 28px 12px;font-family:${FONT};">
${paragraphs(text)}
</td></tr>
<tr><td style="padding:0 28px 28px;font-family:${FONT};">
<a href="${SITE_URL}/#afspraak" style="display:inline-block;background:${YELLOW};color:${INK};font-weight:700;font-size:15px;text-decoration:none;padding:12px 20px;">${labels.button}</a>
</td></tr>
<tr><td style="padding:18px 28px;background:${PAPER};border-top:1px solid #e4dfd4;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">
<strong style="color:${INK};">Bjorn’s Barber</strong> · ${labels.tagline}<br>
${escapeHtml(CONTACT.addressFull)}<br>
<a href="${CONTACT.phoneHref}" style="color:${MUTED};">${escapeHtml(CONTACT.phone)}</a> · <a href="${SITE_URL}" style="color:${MUTED};">bjornsbarber.nl</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}
