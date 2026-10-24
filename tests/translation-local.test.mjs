import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalTranslator, inferSourceLanguage } from '../lib/translation.mjs';

test('local translator uses the native language pair, reports preparation and reuses a ready model', async () => {
  const calls = [],
    progress = [];
  let destroyed = 0;
  const engine = new LocalTranslator(() => ({
    async create(options) {
      calls.push(options);
      options.monitor({
        addEventListener(type, callback) {
          assert.equal(type, 'downloadprogress');
          callback({ loaded: 0.5 });
        },
      });
      return {
        async translate(text, { signal }) {
          assert.ok(signal instanceof AbortSignal);
          return '译文：' + text;
        },
        destroy() {
          destroyed++;
        },
      };
    },
  }));
  const result = await engine.translate('A selected paragraph.', 'zh-CN', {
    onProgress: (p) => progress.push(p),
  });
  assert.equal(result.text, '译文：A selected paragraph.');
  assert.equal(calls[0].sourceLanguage, 'en');
  assert.equal(calls[0].targetLanguage, 'zh');
  assert.equal(progress.find((p) => p.stage === 'download').progress, 0.5);
  await engine.translate('A different paragraph.', 'zh-CN');
  assert.equal(calls.length, 1);
  engine.close();
  assert.equal(destroyed, 1);
});

test('reverse translation selects Chinese and same-language requests need no model', async () => {
  assert.equal(inferSourceLanguage('模型召回率提高。'), 'zh-CN');
  let pairs = [];
  const engine = new LocalTranslator(() => ({
    async create(options) {
      pairs.push([options.sourceLanguage, options.targetLanguage]);
      return {
        async translate() {
          return 'The recall improves.';
        },
        destroy() {},
      };
    },
  }));
  assert.equal((await engine.translate('模型召回率提高。', 'en')).text, 'The recall improves.');
  assert.deepEqual(pairs, [['zh', 'en']]);
  assert.equal(
    (await new LocalTranslator(() => undefined).translate('已经是中文。', 'zh-CN')).text,
    '已经是中文。',
  );
  engine.close();
});

test('invalid input and unsupported browsers return actionable errors without a cloud fallback', async () => {
  const engine = new LocalTranslator(() => undefined);
  for (const [text, target] of [
    ['', 'zh-CN'],
    ['x'.repeat(3001), 'zh-CN'],
    ['A passage', 'fr'],
  ])
    await assert.rejects(engine.translate(text, target), (e) => e.code === 'INVALID_TRANSLATION');
  await assert.rejects(
    engine.translate('A passage', 'zh-CN'),
    (e) => e.code === 'TRANSLATOR_UNSUPPORTED' && e.message.includes('桌面'),
  );
});

test('cancelling a model download aborts preparation and never returns a translation', async () => {
  const request = new AbortController();
  let created = false;
  const engine = new LocalTranslator(() => ({
    create({ signal }) {
      created = true;
      return new Promise((resolve, reject) =>
        signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
      );
    },
  }));
  const task = engine.translate('Selected words', 'zh-CN', { signal: request.signal });
  assert.equal(created, true);
  request.abort();
  await assert.rejects(task, (e) => e.name === 'AbortError');
  assert.equal(engine.translators.size, 0);
  assert.equal(engine.pending.size, 0);
});

test('translation failures produce no fabricated result and a subsequent retry recreates the model', async () => {
  let attempts = 0,
    destroyed = 0;
  const engine = new LocalTranslator(() => ({
    async create() {
      attempts++;
      return {
        async translate() {
          if (attempts === 1) throw new DOMException('too long', 'QuotaExceededError');
          return '真实结果';
        },
        destroy() {
          destroyed++;
        },
      };
    },
  }));
  await assert.rejects(
    engine.translate('A long paragraph', 'zh-CN'),
    (e) => e.code === 'TRANSLATION_TOO_LONG',
  );
  assert.equal(destroyed, 1);
  assert.equal((await engine.translate('A short paragraph', 'zh-CN')).text, '真实结果');
  assert.equal(attempts, 2);
  engine.close();
});
