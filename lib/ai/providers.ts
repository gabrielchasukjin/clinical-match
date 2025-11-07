// lib/ai/providers.ts
import {
  customProvider,
  // extractReasoningMiddleware, // not needed for Claude
  // wrapLanguageModel,
} from 'ai';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';
import { isTestEnvironment } from '../constants';

import { bedrock } from '@/lib/ai/bedrock';

// Use env so you can change the model/profile without code changes
const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0';
if (process.env.NODE_ENV === 'development') {
  console.log('Using Bedrock modelId:', BEDROCK_MODEL_ID);
}

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
      },
    })
  : customProvider({
      languageModels: {
        // Map your existing keys to Bedrock (Claude via inference profile)
        'chat-model': bedrock(BEDROCK_MODEL_ID),
        'chat-model-reasoning': bedrock(BEDROCK_MODEL_ID),
        'title-model': bedrock(BEDROCK_MODEL_ID),
        'artifact-model': bedrock(BEDROCK_MODEL_ID),
      },
      // Bedrock image models aren’t wired here; remove xai.imageModel usage.
      // If you later add a Bedrock image model, add an imageModels section.
    });
