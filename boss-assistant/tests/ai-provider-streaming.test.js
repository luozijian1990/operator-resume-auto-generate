const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const encoder = new TextEncoder();

function sse(events, separator = '\n\n', trailing = true) {
  const text = events.map((event) => event === '[DONE]'
    ? 'data: [DONE]'
    : 'data: ' + JSON.stringify(event)).join(separator);
  return text + (trailing ? separator : '');
}

function responseFor(text, byteChunkSizes) {
  const bytes = encoder.encode(text);
  const chunks = [];
  let offset = 0;
  (byteChunkSizes || [bytes.length]).forEach((size) => {
    if (offset < bytes.length) chunks.push(bytes.slice(offset, Math.min(bytes.length, offset + size)));
    offset += size;
  });
  if (offset < bytes.length) chunks.push(bytes.slice(offset));
  let index = 0;
  return {
    ok: true,
    body: {
      getReader() {
        return {
          async read() {
            if (index >= chunks.length) return { done: true };
            return { done: false, value: chunks[index++] };
          },
        };
      },
    },
  };
}

function createProvider(text, byteChunkSizes) {
  let requestBody = null;
  const context = vm.createContext({
    TextDecoder,
    window: {},
    fetch: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return responseFor(text, byteChunkSizes);
    },
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'aiProvider.js'), 'utf8'), context);
  return { provider: context.window.AIProvider, requestBody: () => requestBody };
}

async function collect({ provider = 'openai', text, byteChunkSizes }) {
  const harness = createProvider(text, byteChunkSizes);
  let output = '';
  await harness.provider.stream({
    provider,
    baseUrl: 'https://example.test',
    model: 'test-model',
    apiKey: 'test-key',
    systemPrompt: 'test',
    messages: [],
  }, (delta) => { output += delta; });
  return { output, requestBody: harness.requestBody() };
}

async function main() {
  const openAiEvents = [
    { type: 'response.output_text.delta', delta: '第一段' },
    { type: 'response.output_text.delta', delta: '第二段' },
    { type: 'response.completed', response: { status: 'completed' } },
  ];

  const eofResult = await collect({
    text: sse(openAiEvents, '\n\n', false),
    byteChunkSizes: [7, 19, 2, 31],
  });
  assert.equal(eofResult.output, '第一段第二段', 'EOF 前没有空行时仍必须处理最后的 delta');

  const crlfText = sse(openAiEvents, '\r\n\r\n', true);
  const crlfByteLength = encoder.encode(crlfText).length;
  for (let size = 1; size <= 32; size += 1) {
    const crlfResult = await collect({
      text: crlfText,
      byteChunkSizes: Array(Math.ceil(crlfByteLength / size)).fill(size),
    });
    assert.equal(crlfResult.output, '第一段第二段', 'CRLF SSE 在 ' + size + ' byte 分块下必须完整');
  }

  const compatibleDone = await collect({
    text: sse([
      { type: 'response.output_text.delta', delta: '兼容接口正文' },
      '[DONE]',
    ]),
  });
  assert.equal(compatibleDone.output, '兼容接口正文', '兼容接口的 [DONE] 应视为完整结束');

  const anthropicText = sse([
    { type: 'content_block_delta', delta: { type: 'text_delta', text: '部分报告' } },
    { type: 'message_delta', delta: { stop_reason: 'max_tokens' }, usage: { output_tokens: 4096 } },
    { type: 'message_stop' },
  ]);
  const anthropicHarness = createProvider(anthropicText);
  let anthropicOutput = '';
  await assert.rejects(
    anthropicHarness.provider.stream({
      provider: 'anthropic',
      baseUrl: 'https://example.test',
      model: 'test-model',
      apiKey: 'test-key',
      systemPrompt: 'test',
      messages: [],
    }, (delta) => { anthropicOutput += delta; }),
    /输出上限.*未完整生成/,
    'Anthropic max_tokens 必须明确报告为不完整响应'
  );
  assert.equal(anthropicOutput, '部分报告', '截断前已收到的正文必须保留');
  assert.equal(anthropicHarness.requestBody().max_tokens, 8192, '长报告输出预算应提高到 8192');

  await assert.rejects(
    collect({
      text: sse([
        { type: 'response.output_text.delta', delta: '部分正文' },
        { type: 'response.incomplete', response: { incomplete_details: { reason: 'max_output_tokens' } } },
      ]),
    }),
    /输出上限.*未完整生成/,
    'OpenAI incomplete 事件不得被当作成功'
  );

  await assert.rejects(
    collect({ text: 'data: {not-json}\n\n' }),
    /流事件解析失败/,
    '损坏的 data 事件不得被静默吞掉'
  );

  await assert.rejects(
    collect({ text: sse([{ type: 'response.output_text.delta', delta: '连接中断前正文' }]) }),
    /连接提前结束.*可能不完整/,
    '缺少 completed 或 [DONE] 的流不得伪装成完整响应'
  );

  console.log('ai provider streaming: PASS');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
