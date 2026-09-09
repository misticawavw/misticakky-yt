const FAMILY_SENDER = 'families-noreply@google.com';
const INVITE_RE = /https:\/\/families\.google\.com\/join\/promo\/[A-Za-z0-9_-]+/i;

export function decodeBase64Url(data = '') {
  if (!data) return '';
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

export function collectMimeText(payload) {
  if (!payload) return '';
  const chunks = [];
  if (payload.body?.data) chunks.push(decodeBase64Url(payload.body.data));
  for (const part of payload.parts || []) chunks.push(collectMimeText(part));
  return chunks.join('\n');
}

export function getHeader(payload, name) {
  const wanted = String(name).toLowerCase();
  return payload?.headers?.find(h => String(h.name).toLowerCase() === wanted)?.value || '';
}

export function extractEmailAddress(fromHeader = '') {
  const bracket = fromHeader.match(/<([^>]+)>/);
  const candidate = (bracket?.[1] || fromHeader).trim().toLowerCase();
  const email = candidate.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return email?.[0]?.toLowerCase() || '';
}

export function extractFamilyInviteUrl(text = '') {
  const normalized = text.replace(/&amp;/g, '&');
  const match = normalized.match(INVITE_RE);
  return match?.[0] || null;
}

export function isGoogleFamilyInviteMessage(message) {
  const from = getHeader(message?.payload, 'From');
  if (extractEmailAddress(from) !== FAMILY_SENDER) return false;
  return Boolean(extractFamilyInviteUrl(collectMimeText(message?.payload)));
}

export function invitationFromMessage(message) {
  const text = collectMimeText(message.payload);
  const inviteUrl = extractFamilyInviteUrl(text);
  if (!inviteUrl) return null;
  return {
    gmailMessageId: message.id,
    threadId: message.threadId || null,
    receivedAt: new Date(Number(message.internalDate)),
    fromHeader: getHeader(message.payload, 'From'),
    subject: getHeader(message.payload, 'Subject') || 'Convite de Família Google',
    snippet: message.snippet || '',
    inviteUrl
  };
}

export function initialCutoff(scanStartedAt) {
  return new Date(scanStartedAt.getTime() - 7 * 24 * 60 * 60 * 1000);
}

export function isAfterCutoff(internalDate, cutoff, initialScan) {
  const ms = Number(internalDate);
  return initialScan ? ms >= cutoff.getTime() : ms > cutoff.getTime();
}

export function gmailListQuery(lastCheckedAt) {
  if (!lastCheckedAt) {
    return 'newer_than:8d from:families-noreply@google.com';
  }
  const d = new Date(lastCheckedAt.getTime() - 24 * 60 * 60 * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `after:${yyyy}/${mm}/${dd} from:families-noreply@google.com`;
}
