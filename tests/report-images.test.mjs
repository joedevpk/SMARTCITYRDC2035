// Tests exécutables sous Node 22+ (type stripping) : logique pure des images de signalement et du multimodal Gemini.
// Run: node --experimental-strip-types --test tests/report-images.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sniffImageMime, validateImage, MAX_ATTACHMENT_BYTES } from '../lib/report-attachments.ts';
import { callGemini, parseSuggestion } from '../supabase/functions/ai-service/gemini.ts';

const bytes = (...a) => new Uint8Array(a);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0);
const WEBP = new Uint8Array([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')]);

test('sniffImageMime : type RÉEL d\'après les octets', () => {
  assert.equal(sniffImageMime(JPG), 'image/jpeg');
  assert.equal(sniffImageMime(PNG), 'image/png');
  assert.equal(sniffImageMime(WEBP), 'image/webp');
  assert.equal(sniffImageMime(Buffer.from('<svg onload=alert(1)>')), null);
  assert.equal(sniffImageMime(Buffer.from('%PDF-1.7')), null);
  assert.equal(sniffImageMime(bytes()), null);
});

test('validateImage : un exécutable renommé .jpg est refusé, une vraie image acceptée, >5 Mo refusé', async () => {
  const fake = new File([Buffer.from('MZ\x90\x00 not an image')], 'photo.jpg', { type: 'image/jpeg' });
  const r1 = await validateImage(fake);
  assert.equal(r1.ok, false);
  const ok = await validateImage(new File([JPG], 'a.jpg', { type: 'image/jpeg' }));
  assert.equal(ok.ok, true);
  assert.equal(ok.value.mime, 'image/jpeg');
  const big = await validateImage(new File([new Uint8Array(MAX_ATTACHMENT_BYTES + 1)], 'big.png', { type: 'image/png' }));
  assert.equal(big.ok, false);
  assert.match(big.error, /5 Mo/);
  assert.equal((await validateImage(new File([], 'vide.png'))).ok, false);
});

const okResp = (obj) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, finishReason: 'STOP' }] }), { status: 200 });
const GOOD = { category: 'lighting', priority: 'high', summary: 's', facts: ['f'], assumptions: ['a'], recommendation: 'r' };

test('callGemini : les images partent en inlineData, la clé reste dans l\'en-tête (jamais dans l\'URL)', async () => {
  let seen;
  const res = await callGemini({
    apiKey: 'K', model: 'm1', system: 'sys', user: 'u', images: [{ mimeType: 'image/png', data: 'QUJD' }],
    fetchFn: async (url, init) => { seen = { url, init }; return okResp(GOOD); },
  });
  assert.equal(res.ok, true);
  assert.ok(!seen.url.includes('K') || !/[?&]key=/.test(seen.url));
  assert.equal(seen.init.headers['x-goog-api-key'], 'K');
  const parts = JSON.parse(seen.init.body).contents[0].parts;
  assert.equal(parts.length, 2);
  assert.deepEqual(parts[1], { inlineData: { mimeType: 'image/png', data: 'QUJD' } });
});

test('callGemini sans image : une seule partie texte (comportement inchangé)', async () => {
  let body;
  await callGemini({ apiKey: 'K', model: 'm1', system: 's', user: 'u', fetchFn: async (_u, i) => { body = JSON.parse(i.body); return okResp(GOOD); } });
  assert.equal(body.contents[0].parts.length, 1);
});

test('parseSuggestion : observed_in_images retenu seulement si des images ont été envoyées', () => {
  const txt = JSON.stringify({ ...GOOD, observed_in_images: ['poteau éteint'] });
  assert.deepEqual(parseSuggestion(txt, { imagesSent: true }).suggestion.observed_in_images, ['poteau éteint']);
  assert.equal(parseSuggestion(txt, { imagesSent: false }).suggestion.observed_in_images, undefined);
  assert.equal(parseSuggestion(txt).suggestion.observed_in_images, undefined);
  // champ obligatoire manquant : toujours rejeté, aucune valeur par défaut inventée
  assert.equal(parseSuggestion(JSON.stringify({ ...GOOD, summary: '' }), { imagesSent: true }).ok, false);
});

import { sniffImage } from '../supabase/functions/_shared/sniff.ts';
test('sniffImage (Edge) : identique au contrôle navigateur', () => {
  assert.equal(sniffImage(JPG), 'image/jpeg');
  assert.equal(sniffImage(PNG), 'image/png');
  assert.equal(sniffImage(WEBP), 'image/webp');
  assert.equal(sniffImage(Buffer.from('GIF89a....')), null);
  assert.equal(sniffImage(Buffer.from('<?php system($_GET[1]);')), null);
});
