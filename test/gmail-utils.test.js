import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractFamilyInviteUrl,
  isAfterCutoff,
  initialCutoff,
  gmailListQuery,
  isGoogleFamilyInviteMessage
} from '../src/gmail-utils.js';

const b64url = s => Buffer.from(s).toString('base64url');

test('extracts only Google family join promo link', () => {
  assert.equal(extractFamilyInviteUrl('Accept https://families.google.com/join/promo/AbC_123-x now'), 'https://families.google.com/join/promo/AbC_123-x');
  assert.equal(extractFamilyInviteUrl('https://families.google.com/families'), null);
});

test('requires exact family sender and join link', () => {
  const message = { payload: { headers: [{name:'From', value:'Google <families-noreply@google.com>'}], body: {data:b64url('https://families.google.com/join/promo/Test_1')}} };
  assert.equal(isGoogleFamilyInviteMessage(message), true);
  message.payload.headers[0].value = 'Google <noreply@google.com>';
  assert.equal(isGoogleFamilyInviteMessage(message), false);
});

test('first scan cutoff is exactly seven days', () => {
  const start = new Date('2026-09-09T22:00:00Z');
  const cutoff = initialCutoff(start);
  assert.equal(cutoff.toISOString(), '2026-09-02T22:00:00.000Z');
  assert.equal(isAfterCutoff(String(cutoff.getTime()), cutoff, true), true);
  assert.equal(isAfterCutoff(String(cutoff.getTime()), cutoff, false), false);
});

test('Gmail query is narrow and incremental', () => {
  assert.equal(gmailListQuery(null), 'newer_than:8d from:families-noreply@google.com');
  const q = gmailListQuery(new Date('2026-09-09T01:00:00Z'));
  assert.match(q, /^after:2026\/09\/08 from:families-noreply@google\.com$/);
});
