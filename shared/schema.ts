import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  isValid: boolean("is_valid").notNull().default(false),
  campaignId: varchar("campaign_id"),
});

export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  totalContacts: integer("total_contacts").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending, sending, completed, failed
  createdAt: timestamp("created_at").defaultNow(),
});

export const emailResults = pgTable("email_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull(),
  contactId: varchar("contact_id").notNull(),
  email: text("email").notNull(),
  status: text("status").notNull(), // sent, failed
  error: text("error"),
  sentAt: timestamp("sent_at").defaultNow(),
});

export const aiMessages = pgTable("ai_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageType: text("message_type").notNull(), // whatsapp, sms
  promotionalIdea: text("promotional_idea").notNull(),
  generatedMessage: text("generated_message").notNull(),
  characterCount: integer("character_count").notNull(),
  wordCount: integer("word_count").notNull(),
  isCompliant: boolean("is_compliant").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
});

export const insertEmailResultSchema = createInsertSchema(emailResults).omit({
  id: true,
  sentAt: true,
});

export const insertAiMessageSchema = createInsertSchema(aiMessages).omit({
  id: true,
  createdAt: true,
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type EmailResult = typeof emailResults.$inferSelect;
export type InsertEmailResult = z.infer<typeof insertEmailResultSchema>;
export type AiMessage = typeof aiMessages.$inferSelect;
export type InsertAiMessage = z.infer<typeof insertAiMessageSchema>;
