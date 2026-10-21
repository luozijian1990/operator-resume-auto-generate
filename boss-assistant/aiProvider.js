window.AIProvider = (function () {
  function authHeaders(provider, apiKey) {
    if (provider === 'anthropic') {
      return {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      };
    }
    return {
      'content-type': 'application/json',
      'authorization': 'Bearer ' + apiKey,
    };
  }

  async function readSseStream(response, onEvent) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let sawDone = false;

    function consumeBlock(rawBlock) {
      const block = rawBlock.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const data = block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n')
        .trim();
      if (!data) return;
      if (data === '[DONE]') {
        sawDone = true;
        return;
      }
      let event;
      try {
        event = JSON.parse(data);
      } catch (error) {
        const parseError = new Error('AI 流事件解析失败，回答可能不完整');
        parseError.cause = error;
        throw parseError;
      }
      onEvent(event);
    }

    function consumeCompleteBlocks() {
      while (true) {
        const match = /\r\n\r\n|\n\n|\r\r/.exec(buffer);
        if (!match) break;
        const block = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        consumeBlock(block);
      }
    }

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      consumeCompleteBlocks();
    }
    buffer += decoder.decode();
    consumeCompleteBlocks();
    if (buffer.trim()) consumeBlock(buffer);
    return { sawDone };
  }

  function incompleteError(reason) {
    const normalized = String(reason || '').toLowerCase();
    const message = normalized.includes('token')
      ? 'AI 回答达到输出上限，未完整生成；请缩小分析范围或继续生成'
      : 'AI 回答未完整生成' + (reason ? '：' + reason : '');
    const error = new Error(message);
    return error;
  }

  function failedError(event) {
    const detail = event && (event.error || (event.response && event.response.error));
    const message = detail && (detail.message || detail.code || detail.type);
    const error = new Error('AI 流式响应失败' + (message ? '：' + message : ''));
    return error;
  }

  async function stream(request, onDelta, signal) {
    const { provider, baseUrl, model, apiKey, systemPrompt, messages } = request;
    if (!apiKey) throw new Error('请先填写并保存 API Key');
    if (!baseUrl) throw new Error('请先填写 Base URL');
    if (!model) throw new Error('请先填写 Model');

    const base = String(baseUrl).replace(/\/+$/, '');
    let url;
    let body;
    if (provider === 'anthropic') {
      url = base + '/v1/messages';
      body = {
        model,
        max_tokens: 8192,
        system: systemPrompt,
        messages,
        stream: true,
      };
    } else {
      url = base + '/v1/responses';
      body = {
        model,
        instructions: systemPrompt,
        input: messages,
        stream: true,
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: authHeaders(provider, apiKey),
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error('请求失败 ' + response.status + (text ? ' ' + text.slice(0, 300) : ''));
    }
    if (!response.body) {
      onDelta(await response.text());
      return;
    }
    let completed = false;
    const streamState = await readSseStream(response, (event) => {
      if (provider === 'anthropic') {
        if (event.type === 'content_block_delta' && event.delta && event.delta.text) {
          onDelta(event.delta.text);
        } else if (event.type === 'message_delta' && event.delta && event.delta.stop_reason === 'max_tokens') {
          throw incompleteError('max_tokens');
        } else if (event.type === 'message_stop') {
          completed = true;
        } else if (event.type === 'error') {
          throw failedError(event);
        }
      } else {
        if (event.type === 'response.output_text.delta' && event.delta) {
          onDelta(event.delta);
        } else if (event.type === 'response.completed') {
          completed = true;
        } else if (event.type === 'response.incomplete') {
          const details = event.response && event.response.incomplete_details;
          throw incompleteError(details && details.reason);
        } else if (event.type === 'response.failed' || event.type === 'error') {
          throw failedError(event);
        }
      }
    });
    if (!completed && !streamState.sawDone) {
      throw new Error('AI 流连接提前结束，回答可能不完整；请重试');
    }
  }

  return { stream };
})();
