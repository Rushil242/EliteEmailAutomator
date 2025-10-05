import { type Contact, type InsertContact, type Campaign, type InsertCampaign, type EmailResult, type InsertEmailResult, type AiMessage, type InsertAiMessage } from "../shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Contact methods
  createContact(contact: InsertContact): Promise<Contact>;
  getContact(id: string): Promise<Contact | undefined>;
  updateContact(id: string, updates: Partial<Contact>): Promise<Contact>;
  getContactsByCampaign(campaignId: string): Promise<Contact[]>;
  createManyContacts(contacts: InsertContact[]): Promise<Contact[]>;
  validateContacts(contacts: Contact[]): Promise<Contact[]>;
  
  // Campaign methods
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  getCampaign(id: string): Promise<Campaign | undefined>;
  updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign>;
  
  // Email result methods
  createEmailResult(result: InsertEmailResult): Promise<EmailResult>;
  getEmailResultsByCampaign(campaignId: string): Promise<EmailResult[]>;
  
  // AI message methods
  createAiMessage(message: InsertAiMessage): Promise<AiMessage>;
  getAiMessage(id: string): Promise<AiMessage | undefined>;
}

export class MemStorage implements IStorage {
  private contacts: Map<string, Contact>;
  private campaigns: Map<string, Campaign>;
  private emailResults: Map<string, EmailResult>;
  private aiMessages: Map<string, AiMessage>;

  constructor() {
    this.contacts = new Map();
    this.campaigns = new Map();
    this.emailResults = new Map();
    this.aiMessages = new Map();
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const id = randomUUID();
    const contact: Contact = { 
      ...insertContact, 
      id,
      isValid: insertContact.isValid ?? false,
      campaignId: insertContact.campaignId ?? null
    };
    this.contacts.set(id, contact);
    return contact;
  }

  async getContact(id: string): Promise<Contact | undefined> {
    return this.contacts.get(id);
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact> {
    const contact = this.contacts.get(id);
    if (!contact) {
      throw new Error(`Contact with id ${id} not found`);
    }
    const updatedContact = { ...contact, ...updates };
    this.contacts.set(id, updatedContact);
    return updatedContact;
  }

  async getContactsByCampaign(campaignId: string): Promise<Contact[]> {
    return Array.from(this.contacts.values()).filter(
      (contact) => contact.campaignId === campaignId
    );
  }

  async createManyContacts(insertContacts: InsertContact[]): Promise<Contact[]> {
    const contacts = insertContacts.map(insertContact => {
      const id = randomUUID();
      const contact: Contact = { 
        ...insertContact, 
        id,
        isValid: insertContact.isValid ?? false,
        campaignId: insertContact.campaignId ?? null
      };
      this.contacts.set(id, contact);
      return contact;
    });
    return contacts;
  }

  async validateContacts(contacts: Contact[]): Promise<Contact[]> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return contacts.map(contact => ({
      ...contact,
      isValid: emailRegex.test(contact.email)
    }));
  }

  async createCampaign(insertCampaign: InsertCampaign): Promise<Campaign> {
    const id = randomUUID();
    const campaign: Campaign = { 
      ...insertCampaign, 
      id,
      status: insertCampaign.status ?? "pending",
      totalContacts: insertCampaign.totalContacts ?? 0,
      sentCount: insertCampaign.sentCount ?? 0,
      failedCount: insertCampaign.failedCount ?? 0,
      createdAt: new Date()
    };
    this.campaigns.set(id, campaign);
    return campaign;
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    return this.campaigns.get(id);
  }

  async updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign> {
    const campaign = this.campaigns.get(id);
    if (!campaign) {
      throw new Error(`Campaign with id ${id} not found`);
    }
    const updatedCampaign = { ...campaign, ...updates };
    this.campaigns.set(id, updatedCampaign);
    return updatedCampaign;
  }

  async createEmailResult(insertResult: InsertEmailResult): Promise<EmailResult> {
    const id = randomUUID();
    const result: EmailResult = { 
      ...insertResult, 
      id,
      error: insertResult.error ?? null,
      sentAt: new Date()
    };
    this.emailResults.set(id, result);
    return result;
  }

  async getEmailResultsByCampaign(campaignId: string): Promise<EmailResult[]> {
    return Array.from(this.emailResults.values()).filter(
      (result) => result.campaignId === campaignId
    );
  }

  async createAiMessage(insertMessage: InsertAiMessage): Promise<AiMessage> {
    const id = randomUUID();
    const message: AiMessage = { 
      ...insertMessage, 
      id,
      isCompliant: insertMessage.isCompliant ?? false,
      createdAt: new Date()
    };
    this.aiMessages.set(id, message);
    return message;
  }

  async getAiMessage(id: string): Promise<AiMessage | undefined> {
    return this.aiMessages.get(id);
  }
}

export const storage = new MemStorage();
