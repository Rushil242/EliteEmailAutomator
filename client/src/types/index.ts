export interface Contact {
  id: string;
  name: string;
  email: string;
  isValid: boolean;
  campaignId?: string | null;
}

export interface Campaign {
  id: string;
  subject: string;
  message: string;
  totalContacts: number;
  sentCount: number;
  failedCount: number;
  status: 'pending' | 'sending' | 'completed' | 'failed';
  createdAt: Date;
}

export interface EmailResult {
  id: string;
  campaignId: string;
  contactId: string;
  email: string;
  status: 'sent' | 'failed';
  error?: string | null;
  sentAt: Date;
}

export interface AiMessage {
  id: string;
  messageType: 'whatsapp' | 'sms';
  promotionalIdea: string;
  generatedMessage: string;
  characterCount: number;
  wordCount: number;
  isCompliant: boolean;
  createdAt: Date;
}

export interface FileUploadResponse {
  contacts: Contact[];
  total: number;
  valid: number;
  invalid: number;
  contactIds: string[];
}

export interface ComplianceCheck {
  hasOptOut: boolean;
  hasBusinessName: boolean;
  hasCTA: boolean;
  withinLimit: boolean;
  hasLocation: boolean;
  isCompliant: boolean;
}
