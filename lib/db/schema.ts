import type { InferSelectModel } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  timestamp,
  json,
  uuid,
  text,
  primaryKey,
  foreignKey,
  boolean,
  integer,
  decimal,
} from 'drizzle-orm/pg-core';

export const user = pgTable('User', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  email: varchar('email', { length: 64 }).notNull(),
  password: varchar('password', { length: 64 }),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable('Chat', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  createdAt: timestamp('createdAt').notNull(),
  title: text('title').notNull(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
  visibility: varchar('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = pgTable('Message', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id),
  role: varchar('role').notNull(),
  content: json('content').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = pgTable('Message_v2', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id),
  role: varchar('role').notNull(),
  parts: json('parts').notNull(),
  attachments: json('attachments').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = pgTable(
  'Vote',
  {
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id),
    messageId: uuid('messageId')
      .notNull()
      .references(() => messageDeprecated.id),
    isUpvoted: boolean('isUpvoted').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = pgTable(
  'Vote_v2',
  {
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id),
    messageId: uuid('messageId')
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean('isUpvoted').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  'Document',
  {
    id: uuid('id').notNull().defaultRandom(),
    createdAt: timestamp('createdAt').notNull(),
    title: text('title').notNull(),
    content: text('content'),
    kind: varchar('text', { enum: ['text', 'code', 'image', 'sheet'] })
      .notNull()
      .default('text'),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  },
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  'Suggestion',
  {
    id: uuid('id').notNull().defaultRandom(),
    documentId: uuid('documentId').notNull(),
    documentCreatedAt: timestamp('documentCreatedAt').notNull(),
    originalText: text('originalText').notNull(),
    suggestedText: text('suggestedText').notNull(),
    description: text('description'),
    isResolved: boolean('isResolved').notNull().default(false),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    createdAt: timestamp('createdAt').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  }),
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  'Stream',
  {
    id: uuid('id').notNull().defaultRandom(),
    chatId: uuid('chatId').notNull(),
    createdAt: timestamp('createdAt').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  }),
);

export type Stream = InferSelectModel<typeof stream>;

// ==================== CLINICAL TRIAL MATCHING TABLES ====================

export const patients = pgTable('Patient', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  name: varchar('name', { length: 255 }),
  age: integer('age'),
  gender: varchar('gender', { length: 50 }),
  bmi: decimal('bmi', { precision: 5, scale: 2 }),
  conditions: json('conditions').$type<string[]>().notNull(),
  location: text('location'),
  campaign_url: text('campaign_url'),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export type Patient = InferSelectModel<typeof patients>;

export const clinicalTrials = pgTable('ClinicalTrial', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  user_id: uuid('user_id')
    .notNull()
    .references(() => user.id),
  title: text('title').notNull(),
  raw_criteria_input: text('raw_criteria_input').notNull(),
  eligibility_criteria: json('eligibility_criteria').$type<{
    age?: { min?: number; max?: number };
    gender?: string[];
    bmi?: { min?: number; max?: number };
    conditions?: string[];
  }>().notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export type ClinicalTrial = InferSelectModel<typeof clinicalTrials>;

export const trialSearchSession = pgTable('TrialSearchSession', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  user_id: uuid('user_id')
    .notNull()
    .references(() => user.id),
  search_query: text('search_query').notNull(),
  parsed_criteria: json('parsed_criteria').$type<{
    age?: { min?: number; max?: number };
    gender?: string[];
    conditions?: string[];
    location?: string;
  }>().notNull(),
  search_queries: json('search_queries').$type<string[]>().notNull(),
  total_results: integer('total_results').notNull().default(0),
  match_count: integer('match_count').notNull().default(0),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export type TrialSearchSession = InferSelectModel<typeof trialSearchSession>;

export const trialSearchResult = pgTable('TrialSearchResult', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  session_id: uuid('session_id')
    .notNull()
    .references(() => trialSearchSession.id),
  patient_name: varchar('patient_name', { length: 255 }),
  organizer_name: varchar('organizer_name', { length: 255 }),
  patient_age: integer('patient_age'),
  patient_gender: varchar('patient_gender', { length: 50 }),
  patient_conditions: json('patient_conditions').$type<string[]>().notNull(),
  patient_location: text('patient_location'),
  campaign_url: text('campaign_url').notNull(),
  match_score: integer('match_score').notNull(),
  criteria_breakdown: json('criteria_breakdown').$type<{
    age?: boolean;
    gender?: boolean;
    conditions?: boolean;
    location?: boolean;
  }>().notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export type TrialSearchResult = InferSelectModel<typeof trialSearchResult>;
