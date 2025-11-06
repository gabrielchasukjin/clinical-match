import { Tavily } from '@tavily/core';

if (!process.env.TAVILY_API_KEY) {
  throw new Error('TAVILY_API_KEY is required');
}

export const tavily = new Tavily({
  apiKey: process.env.TAVILY_API_KEY,
});

// Crowdfunding platforms to search
export const CROWDFUNDING_DOMAINS = [
  'gofundme.com',
  'givesendgo.com',
  'fundly.com',
  'giveforward.com',
  'plumfund.com',
];
