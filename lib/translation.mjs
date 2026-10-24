export const MAX_TRANSLATION_CHARS = 3000;
export class TranslationError extends Error {
  constructor(message, code = 'TRANSLATION_UNAVAILABLE') {
    super(message);
    this.name = 'TranslationError';
    this.code = code;
  }
}
export function inferSourceLanguage(text) {
  const chars = String(text).replace(/\s/g, '');
  const han = (chars.match(/\p{Script=Han}/gu) || []).length;
  return han > 0 && han >= Math.max(1, chars.length * 0.2) ? 'zh-CN' : 'en';
}
const checkAbort = (signal) => {
  if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError');
};
const emit = (callback, status) => {
  try {
    callback?.(status);
  } catch {}
};

// The browser owns the specialist language packs and runs inference on the device.
// This module has no fetch path: selected text never goes to a translation server.
export class LocalTranslator {
  constructor(getApi = () => globalThis.Translator) {
    this.getApi = getApi;
    this.translators = new Map();
    this.pending = new Set();
  }
  async translate(value, target = 'zh-CN', { signal, onProgress } = {}) {
    if (
      typeof value !== 'string' ||
      !value.trim() ||
      value.length > MAX_TRANSLATION_CHARS ||
      !['zh-CN', 'en'].includes(target)
    )
      throw new TranslationError(
        `每次请选择 1–${MAX_TRANSLATION_CHARS} 个字符，并选择中文或英文`,
        'INVALID_TRANSLATION',
      );
    checkAbort(signal);
    const text = value.replace(/\s+/g, ' ').trim(),
      source = inferSourceLanguage(text);
    if (source === target) return { text, source, target, provider: '原文已是目标语言' };
    const api = this.getApi();
    if (!api?.create)
      throw new TranslationError(
        '此浏览器不支持本机翻译。请用支持该功能的最新版桌面 Chrome 或 Edge 打开；手机浏览器暂不支持。',
        'TRANSLATOR_UNSUPPORTED',
      );
    const key = source + '|' + target;
    let translator = this.translators.get(key),
      stage = 'prepare';
    try {
      if (!translator) {
        emit(onProgress, { stage, message: '正在准备本机翻译模型，首次使用需要下载…' });
        const lifetime = new AbortController();
        this.pending.add(lifetime);
        const abort = () => lifetime.abort(signal.reason);
        signal?.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(
          () => lifetime.abort(new DOMException('Model download timed out', 'TimeoutError')),
          120000,
        );
        try {
          translator = await api.create({
            sourceLanguage: source === 'zh-CN' ? 'zh' : source,
            targetLanguage: target === 'zh-CN' ? 'zh' : target,
            signal: lifetime.signal,
            monitor(m) {
              m.addEventListener('downloadprogress', (event) => {
                const progress = Number(event.loaded);
                emit(onProgress, {
                  stage: 'download',
                  progress: Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : null,
                  message: '正在下载本机翻译模型…',
                });
              });
            },
          });
          if (signal?.aborted || lifetime.signal.aborted) {
            translator.destroy();
            throw signal?.reason || lifetime.signal.reason;
          }
          this.translators.set(key, translator);
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener('abort', abort);
          this.pending.delete(lifetime);
        }
      }
      checkAbort(signal);
      stage = 'translate';
      emit(onProgress, { stage, message: '正在本机翻译…' });
      const operation = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(30000)]);
      const result = await translator.translate(text, { signal: operation });
      checkAbort(signal);
      if (typeof result !== 'string' || !result.trim())
        throw new TranslationError('未获得译文，请重试或选择较短的段落。');
      return { text: result.trim(), source, target, provider: '本机专用翻译' };
    } catch (error) {
      checkAbort(signal);
      // A failed native instance may have been destroyed by its browser. Recreate on retry.
      if (stage === 'translate') {
        this.translators.delete(key);
        try {
          translator?.destroy();
        } catch {}
      }
      if (error instanceof TranslationError) throw error;
      if (error?.name === 'QuotaExceededError')
        throw new TranslationError(
          '选段超过本机模型的单次长度限制，请选择较短的段落。',
          'TRANSLATION_TOO_LONG',
        );
      if (error?.name === 'NotSupportedError')
        throw new TranslationError(
          '此浏览器暂不支持这个翻译方向。请使用支持本机翻译的最新版桌面 Chrome 或 Edge。',
          'TRANSLATOR_UNSUPPORTED',
        );
      if (stage === 'prepare')
        throw new TranslationError(
          '本机翻译模型未准备完成，请检查网络后重试。首次下载可能需要较长时间。',
          'MODEL_UNAVAILABLE',
        );
      if (error?.name === 'TimeoutError')
        throw new TranslationError(
          '本机翻译用时较长，请选择较短的段落后重试。',
          'TRANSLATION_TIMEOUT',
        );
      throw new TranslationError('本机翻译未完成，请重试或选择较短的段落。');
    }
  }
  close() {
    for (const pending of this.pending) pending.abort(new DOMException('Closed', 'AbortError'));
    this.pending.clear();
    for (const translator of this.translators.values()) {
      try {
        translator.destroy();
      } catch {}
    }
    this.translators.clear();
  }
}
