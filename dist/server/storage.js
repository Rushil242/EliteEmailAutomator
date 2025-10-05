import { randomUUID } from "crypto";
export class MemStorage {
    constructor() {
        this.contacts = new Map();
        this.campaigns = new Map();
        this.emailResults = new Map();
        this.aiMessages = new Map();
    }
    async createContact(insertContact) {
        const id = randomUUID();
        const contact = {
            ...insertContact,
            id,
            isValid: insertContact.isValid ?? false,
            campaignId: insertContact.campaignId ?? null
        };
        this.contacts.set(id, contact);
        return contact;
    }
    async getContact(id) {
        return this.contacts.get(id);
    }
    async updateContact(id, updates) {
        const contact = this.contacts.get(id);
        if (!contact) {
            throw new Error(`Contact with id ${id} not found`);
        }
        const updatedContact = { ...contact, ...updates };
        this.contacts.set(id, updatedContact);
        return updatedContact;
    }
    async getContactsByCampaign(campaignId) {
        return Array.from(this.contacts.values()).filter((contact) => contact.campaignId === campaignId);
    }
    async createManyContacts(insertContacts) {
        const contacts = insertContacts.map(insertContact => {
            const id = randomUUID();
            const contact = {
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
    async validateContacts(contacts) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return contacts.map(contact => ({
            ...contact,
            isValid: emailRegex.test(contact.email)
        }));
    }
    async createCampaign(insertCampaign) {
        const id = randomUUID();
        const campaign = {
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
    async getCampaign(id) {
        return this.campaigns.get(id);
    }
    async updateCampaign(id, updates) {
        const campaign = this.campaigns.get(id);
        if (!campaign) {
            throw new Error(`Campaign with id ${id} not found`);
        }
        const updatedCampaign = { ...campaign, ...updates };
        this.campaigns.set(id, updatedCampaign);
        return updatedCampaign;
    }
    async createEmailResult(insertResult) {
        const id = randomUUID();
        const result = {
            ...insertResult,
            id,
            error: insertResult.error ?? null,
            sentAt: new Date()
        };
        this.emailResults.set(id, result);
        return result;
    }
    async getEmailResultsByCampaign(campaignId) {
        return Array.from(this.emailResults.values()).filter((result) => result.campaignId === campaignId);
    }
    async createAiMessage(insertMessage) {
        const id = randomUUID();
        const message = {
            ...insertMessage,
            id,
            isCompliant: insertMessage.isCompliant ?? false,
            createdAt: new Date()
        };
        this.aiMessages.set(id, message);
        return message;
    }
    async getAiMessage(id) {
        return this.aiMessages.get(id);
    }
}
export const storage = new MemStorage();
