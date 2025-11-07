// lib/ai/bedrock.ts
import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  InvokeModelCommand,
  type ConversationRole,
  type ContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import type { LanguageModelV2, LanguageModelV2Prompt } from '@ai-sdk/provider';

/** ----------------------------------------------------------------
 * Client (singleton) + retry helper
 * ----------------------------------------------------------------*/
let _client: BedrockRuntimeClient | null = null;
let _loggedOnce = false;

function getBedrockClient() {
  if (_client) return _client;

  const region = process.env.AWS_REGION || 'us-east-1';
  _client = new BedrockRuntimeClient({ region });

  if (process.env.NODE_ENV === 'development' && !_loggedOnce) {
    const akid = process.env.AWS_ACCESS_KEY_ID;
    console.log('Bedrock client config:', {
      region,
      profile: process.env.AWS_PROFILE || 'default',
      credSource: akid
        ? 'env'
        : process.env.AWS_PROFILE
          ? `profile/${process.env.AWS_PROFILE}`
          : 'default-chain',
      // omit accessKeyIdPrefix to avoid printing "undefined"
    });
    _loggedOnce = true;
  }

  return _client;
}

async function withRetries<T>(fn: () => Promise<T>) {
  const max = 5;
  for (let i = 0; i < max; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const code = err?.name || err?.code || '';
      const retryable =
        code === 'ThrottlingException' ||
        code === 'TooManyRequestsException' ||
        code === 'InternalServerException' ||
        code === 'ServiceUnavailableException' ||
        code === 'RequestTimeout' ||
        code === 'TimeoutError';

      if (!retryable || i === max - 1) throw err;

      const delay =
        Math.min(300 * 2 ** i, 5000) + Math.floor(Math.random() * 250);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // unreachable
  throw new Error('unreachable');
}

/** ----------------------------------------------------------------
 * Text cleanup helpers
 * ----------------------------------------------------------------*/
function stripMarkdownCodeFences(text: string): string {
  // Remove markdown code fences like ```json\n...\n``` or ```\n...\n```
  const fencePattern =
    /^```(?:json|typescript|javascript|python|)?\s*\n?([\s\S]*?)\n?```$/;
  const match = text.trim().match(fencePattern);
  return match ? match[1].trim() : text;
}

function extractJSONOnly(text: string): string {
  // First strip markdown fences
  const cleaned = stripMarkdownCodeFences(text);

  // Find the JSON object/array and remove any explanation text after it
  // Look for closing } or ] followed by non-JSON text
  try {
    // Try to find where valid JSON ends
    let depth = 0;
    let inString = false;
    let isEscaped = false;
    let jsonEnd = -1;

    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];

      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (char === '\\') {
        isEscaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === '{' || char === '[') {
        depth++;
      } else if (char === '}' || char === ']') {
        depth--;
        if (depth === 0) {
          jsonEnd = i + 1;
          break;
        }
      }
    }

    if (jsonEnd > 0) {
      return cleaned.substring(0, jsonEnd).trim();
    }
  } catch (e) {
    // If extraction fails, return original cleaned text
  }

  return cleaned;
}

/** ----------------------------------------------------------------
 * Prompt conversion helpers
 * ----------------------------------------------------------------*/
type BRMessage = {
  role: ConversationRole | 'user' | 'assistant';
  content: ContentBlock[];
};

function splitSystemAndMessages(prompt: LanguageModelV2Prompt): {
  system?: string;
  messages: BRMessage[];
} {
  let system: string | undefined;
  const messages: BRMessage[] = [];

  for (const msg of prompt) {
    if (msg.role === 'system') {
      system = msg.content;
      continue;
    }

    const text =
      msg.content
        ?.filter((p) => p.type === 'text')
        .map((p) => (p as { type: 'text'; text: string }).text)
        .join('\n') ?? '';

    if (!text) continue;

    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: [{ text }] });
    }
  }

  return { system, messages };
}

/** ----------------------------------------------------------------
 * Model / profile detection
 * ----------------------------------------------------------------*/
// legacy completions (InvokeModel)
function isLegacyAnthropic(id: string) {
  return (
    /anthropic\.claude-v2/i.test(id) || /anthropic\.claude-instant/i.test(id)
  );
}

// inference profile ARN or system profile ID (e.g., "us.anthropic.claude-3-5-haiku-20241022-v1:0")
function isInferenceProfile(id: string) {
  return (
    /^arn:aws:bedrock:[a-z0-9-]+:\d{12}:inference-profile\//i.test(id) ||
    /^[a-z]{2}\.anthropic\./i.test(id)
  );
}

// modern Anthropic raw model IDs (Converse)
function isModernAnthropicModelId(id: string) {
  return (
    /anthropic\.claude-3-5/i.test(id) ||
    /anthropic\.claude-3-(haiku|sonnet|opus)/i.test(id) ||
    /anthropic\.claude-(haiku|sonnet|opus)-4(\.|$)/i.test(id) ||
    /anthropic\.claude-(haiku|sonnet|opus)-4-1/i.test(id) ||
    /anthropic\.claude-(haiku|sonnet|opus)-4-5/i.test(id)
  );
}

// anything that's not legacy is treated as modern (Converse)
function isModernAnthropic(id: string) {
  return isInferenceProfile(id) || isModernAnthropicModelId(id);
}

/** ----------------------------------------------------------------
 * Generate via Converse (Claude 3.x / 4.x / profiles)
 * ----------------------------------------------------------------*/
async function converseGenerate(opts: {
  client: BedrockRuntimeClient;
  modelId: string; // may be an inference profile ID/ARN
  prompt: LanguageModelV2Prompt;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
}) {
  const { system, messages } = splitSystemAndMessages(opts.prompt);

  const cmd = new ConverseCommand({
    modelId: opts.modelId,
    system: system ? [{ text: system }] : undefined,
    messages,
    inferenceConfig: {
      maxTokens: opts.maxOutputTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
      topP: opts.topP,
    },
  });

  try {
    const res = await withRetries(() => opts.client.send(cmd));
    const rawText = res.output?.message?.content?.[0]?.text ?? '';
    // Strip markdown code fences and extract only JSON (remove explanation text)
    const text = extractJSONOnly(rawText);
    const stopReason = res.stopReason ?? 'end_turn';

    return {
      text,
      stopReason,
      inputTokens: res.usage?.inputTokens ?? 0,
      outputTokens: res.usage?.outputTokens ?? 0,
    };
  } catch (error: any) {
    const msg = String(error?.message || error);

    // Common misconfigs → clearer guidance
    if (
      error.name === 'ValidationException' &&
      (msg.includes('inference profile') ||
        msg.includes('on-demand throughput'))
    ) {
      throw new Error(
        `Claude models require inference profiles. You passed "${opts.modelId}". Create/select an inference profile in ${process.env.AWS_REGION || 'us-east-1'} and pass its **ID/ARN** as modelId (e.g., "us.anthropic.claude-3-5-haiku-20241022-v1:0" or an arn:aws:bedrock:...:inference-profile/...).`,
      );
    }
    if (
      error.name === 'ResourceNotFoundException' ||
      msg.includes('Model not found')
    ) {
      throw new Error(
        `Model/profile not found in region or access not granted. Value: "${opts.modelId}". Check Bedrock → Model access and Inference profiles in ${process.env.AWS_REGION || 'us-east-1'}.`,
      );
    }
    if (
      error.name === 'ValidationException' &&
      msg.includes('model identifier')
    ) {
      throw new Error(
        `Invalid model/profile identifier "${opts.modelId}". Verify the ID/ARN and region (us-east-1).`,
      );
    }
    throw error;
  }
}

/** ----------------------------------------------------------------
 * Generate via legacy completion schema (Claude v2 / Instant)
 * ----------------------------------------------------------------*/
async function legacyGenerate(opts: {
  client: BedrockRuntimeClient;
  modelId: string;
  prompt: LanguageModelV2Prompt;
  maxOutputTokens?: number;
  temperature?: number;
}) {
  const { system, messages } = splitSystemAndMessages(opts.prompt);

  const lastUser = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content.map((c) => c.text ?? '').join('\n'))
    .join('\n');

  const promptText = system
    ? `${system}\n\nHuman: ${lastUser}\n\nAssistant:`
    : `Human: ${lastUser}\n\nAssistant:`;

  const body = {
    prompt: promptText,
    max_tokens_to_sample: opts.maxOutputTokens ?? 1024,
    temperature: opts.temperature ?? 0.7,
    stop_sequences: ['\n\nHuman:'],
  };

  const cmd = new InvokeModelCommand({
    modelId: opts.modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: Buffer.from(JSON.stringify(body)),
  });

  const res = await withRetries(() => opts.client.send(cmd));
  const json = JSON.parse(new TextDecoder().decode(res.body));
  const rawText: string = json?.completion ?? '';
  // Strip markdown code fences and extract only JSON
  const text = extractJSONOnly(rawText);
  const stopReason = 'end_turn';

  return { text, stopReason, inputTokens: 0, outputTokens: 0 };
}

/** ----------------------------------------------------------------
 * Public: AI SDK adapter
 * ----------------------------------------------------------------*/
export function bedrock(modelId: string): LanguageModelV2 {
  const client = getBedrockClient();

  return {
    specificationVersion: 'v2',
    provider: 'bedrock',
    modelId,
    supportedUrls: {},

    async doGenerate(options) {
      const { prompt, maxOutputTokens, temperature, topP } = options;

      try {
        const out = isLegacyAnthropic(modelId)
          ? await legacyGenerate({
              client,
              modelId,
              prompt,
              maxOutputTokens,
              temperature,
            })
          : await converseGenerate({
              client,
              modelId, // raw model ID OR inference profile ID/ARN
              prompt,
              maxOutputTokens,
              temperature,
              topP,
            });

        return {
          content: [{ type: 'text', text: out.text }],
          finishReason: out.stopReason === 'max_tokens' ? 'length' : 'stop',
          usage: {
            inputTokens: out.inputTokens,
            outputTokens: out.outputTokens,
            totalTokens: out.inputTokens + out.outputTokens,
          },
          warnings: [],
        };
      } catch (e: any) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Bedrock doGenerate error:', {
            message: e?.message || String(e),
            code: e?.name,
            status: e?.$metadata?.httpStatusCode ?? e?.status,
            requestId: e?.$metadata?.requestId,
            modelId,
            region: process.env.AWS_REGION,
          });
        }
        throw e;
      }
    },

    async doStream(options) {
      const { prompt, maxOutputTokens, temperature, topP } = options;

      if (isLegacyAnthropic(modelId)) {
        // Simulated streaming for legacy models
        const out = await this.doGenerate(options);
        const full = (out.content?.[0] as any)?.text ?? '';
        const finish = out.finishReason === 'length' ? 'length' : 'stop';

        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-delta', textDelta: '' });
            const step = 64;
            for (let i = 0; i < full.length; i += step) {
              controller.enqueue({
                type: 'text-delta',
                textDelta: full.slice(i, i + step),
              });
            }
            controller.enqueue({
              type: 'finish',
              finishReason: finish,
              usage: { inputTokens: 0, outputTokens: 0 },
            });
            controller.close();
          },
        });

        return { stream };
      }

      // True streaming for Converse models / inference profiles
      const { system, messages } = splitSystemAndMessages(prompt);
      const cmd = new ConverseStreamCommand({
        modelId,
        system: system ? [{ text: system }] : undefined,
        messages,
        inferenceConfig: {
          maxTokens: maxOutputTokens ?? 4096,
          temperature: temperature ?? 0.7,
          topP,
        },
      });

      const res = await withRetries(() => client.send(cmd));

      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue({ type: 'text-delta', textDelta: '' });
          try {
            if (!res.stream) throw new Error('Stream response is undefined');
            for await (const event of res.stream) {
              const delta = (event as any)?.chunk?.bytes
                ? new TextDecoder().decode((event as any).chunk.bytes)
                : null;
              if (delta)
                controller.enqueue({ type: 'text-delta', textDelta: delta });

              const stopReason = (event as any)?.metadata?.stopReason;
              const usage = (event as any)?.metadata?.usage;
              if (stopReason) {
                controller.enqueue({
                  type: 'finish',
                  finishReason: stopReason === 'max_tokens' ? 'length' : 'stop',
                  usage: {
                    inputTokens: usage?.inputTokens ?? 0,
                    outputTokens: usage?.outputTokens ?? 0,
                  },
                });
                controller.close();
              }
            }
          } catch (e: any) {
            if (process.env.NODE_ENV === 'development') {
              console.error('Bedrock doStream error:', {
                message: e?.message || String(e),
                code: e?.name,
                status: e?.$metadata?.httpStatusCode ?? e?.status,
                requestId: e?.$metadata?.requestId,
                modelId,
                region: process.env.AWS_REGION,
              });
            }
            controller.error(e);
          }
        },
      });

      return { stream };
    },
  };
}
