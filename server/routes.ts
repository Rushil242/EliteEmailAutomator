import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import * as XLSX from "xlsx";
import { insertContactSchema, insertCampaignSchema, insertAiMessageSchema } from "@shared/schema";
import { TransactionalEmailsApi, TransactionalEmailsApiApiKeys } from '@getbrevo/brevo';

const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.'));
    }
  }
});

const brevoApi = process.env.BREVO_API_KEY ? new TransactionalEmailsApi() : null;
if (brevoApi && process.env.BREVO_API_KEY) {
  brevoApi.setApiKey(TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // File upload and contact parsing
  app.post("/api/upload-contacts", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        return res.status(400).json({ error: "File is empty" });
      }

      // Validate required columns
      const firstRow = jsonData[0] as any;
      const hasName = 'Name' in firstRow || 'name' in firstRow;
      const hasEmail = 'Email' in firstRow || 'email' in firstRow;

      if (!hasName || !hasEmail) {
        return res.status(400).json({ 
          error: "Required columns missing. File must contain 'Name' and 'Email' columns." 
        });
      }

      // Parse contacts
      const contactsToInsert = jsonData.map((row: any) => ({
        name: row.Name || row.name || '',
        email: row.Email || row.email || '',
        campaignId: null,
        isValid: false
      }));

      // Create contacts and then validate email addresses
      const createdContacts = await storage.createManyContacts(contactsToInsert);
      const validatedContacts = await storage.validateContacts(createdContacts);

      const validCount = validatedContacts.filter(c => c.isValid).length;
      const invalidCount = validatedContacts.length - validCount;

      res.json({
        contacts: validatedContacts.slice(0, 10), // Return first 10 for preview
        total: validatedContacts.length,
        valid: validCount,
        invalid: invalidCount,
        contactIds: validatedContacts.map(c => c.id)
      });

    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({ error: "Failed to process file" });
    }
  });

  // Create email campaign
  app.post("/api/campaigns", async (req, res) => {
    try {
      const { subject, message, contactIds } = req.body;
      
      const campaignData = insertCampaignSchema.parse({
        subject,
        message,
        totalContacts: contactIds.length,
        sentCount: 0,
        failedCount: 0,
        status: "pending"
      });

      const campaign = await storage.createCampaign(campaignData);

      // Update contacts with campaign ID
      for (const contactId of contactIds) {
        await storage.updateContact(contactId, { 
          campaignId: campaign.id
        });
      }

      res.json(campaign);
    } catch (error) {
      console.error('Campaign creation error:', error);
      res.status(500).json({ error: "Failed to create campaign" });
    }
  });

  // Send email campaign
  app.post("/api/campaigns/:id/send", async (req, res) => {
    try {
      const { id } = req.params;
      const campaign = await storage.getCampaign(id);
      
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      // Update campaign status
      await storage.updateCampaign(id, { status: "sending" });

      const contacts = await storage.getContactsByCampaign(id);
      const validContacts = contacts.filter(c => c.isValid);

      let sentCount = 0;
      let failedCount = 0;

      // Check if Brevo API key is configured
      if (!brevoApi) {
        return res.status(503).json({ 
          error: "Email service not configured. Please add BREVO_API_KEY to environment variables." 
        });
      }

      // Send emails in batches
      for (const contact of validContacts) {
        try {
          const personalizedMessage = campaign.message.replace(/{name}/g, contact.name);
          const personalizedSubject = campaign.subject.replace(/{name}/g, contact.name);
          
          await brevoApi.sendTransacEmail({
            sender: { name: 'Elite IIT', email: 'noreply@eliteiit.com' },
            to: [{ email: contact.email, name: contact.name }],
            subject: personalizedSubject,
            htmlContent: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                ${personalizedMessage.replace(/\n/g, '<br>')}
                <br><br>
                <hr style="border: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #666;">
                  Elite IIT Coaching Institute<br>
                  Yelahanka, Bangalore<br>
                  <a href="mailto:unsubscribe@eliteiit.com">Unsubscribe</a>
                </p>
              </div>
            `,
            textContent: personalizedMessage
          });

          await storage.createEmailResult({
            campaignId: id,
            contactId: contact.id,
            email: contact.email,
            status: "sent",
            error: null
          });

          sentCount++;
        } catch (error) {
          console.error(`Failed to send email to ${contact.email}:`, error);
          
          await storage.createEmailResult({
            campaignId: id,
            contactId: contact.id,
            email: contact.email,
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error"
          });

          failedCount++;
        }

        // Add small delay between emails
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Update campaign with final results
      await storage.updateCampaign(id, { 
        status: "completed",
        sentCount,
        failedCount
      });

      res.json({ sentCount, failedCount, total: validContacts.length });
    } catch (error) {
      console.error('Campaign send error:', error);
      res.status(500).json({ error: "Failed to send campaign" });
    }
  });

  // Get campaign results
  app.get("/api/campaigns/:id/results", async (req, res) => {
    try {
      const { id } = req.params;
      const campaign = await storage.getCampaign(id);
      const results = await storage.getEmailResultsByCampaign(id);

      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      res.json({
        campaign,
        results,
        summary: {
          total: campaign.totalContacts,
          sent: campaign.sentCount,
          failed: campaign.failedCount,
          failedEmails: results.filter(r => r.status === "failed")
        }
      });
    } catch (error) {
      console.error('Campaign results error:', error);
      res.status(500).json({ error: "Failed to get campaign results" });
    }
  });

  // Generate AI message
  app.post("/api/ai-message", async (req, res) => {
    try {
      // Check if OpenRouter API key is configured
      if (!process.env.OPENROUTER_API_KEY) {
        return res.status(503).json({ 
          error: "AI service not configured. Please add OPENROUTER_API_KEY to environment variables." 
        });
      }

      const { messageType, promotionalIdea } = req.body;

      const systemPrompt = `You are an AI assistant for Elite IIT Coaching Institute, Yelahanka, Bangalore. 

INSTITUTE DETAILS:
- Name: Elite IIT Coaching Institute
- Location: Yelahanka, Bangalore
- Experience: 17+ years of coaching excellence
- Students: 35,000+ successful students
- Specializations: IIT-JEE, NEET, CET, GATE, CAT preparations
- Faculty: Expert faculty with 5-15+ years experience
- Classes: Both online and offline available

COMPLIANCE REQUIREMENTS (MANDATORY):
- Must include "Reply STOP to opt out" or similar opt-out instruction
- Must include business name "Elite IIT" or "Elite IIT Coaching Institute"
- Must include location "Yelahanka, Bangalore" 
- Focus on educational value, not pure sales
- Professional tone, avoid spammy language
- Include clear call-to-action with contact information
- Respect timing (suitable for 9 AM - 9 PM IST)

CHARACTER LIMITS:
- SMS: Maximum 160 characters
- WhatsApp: Maximum 200 characters (optimal for engagement)

Generate a compliant ${messageType} marketing message based on this promotional idea: "${promotionalIdea}"

The message should be professional, engaging, and fully compliant with marketing regulations.`;

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000',
          'X-Title': 'Elite IIT Marketing Platform'
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Create a ${messageType} message for: ${promotionalIdea}` }
          ],
          max_tokens: 300,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || response.statusText;
        throw new Error(`OpenRouter API error: ${errorMessage}`);
      }

      const data = await response.json();
      const generatedMessage = data.choices[0]?.message?.content || '';

      // Calculate metrics
      const characterCount = generatedMessage.length;
      const wordCount = generatedMessage.split(/\s+/).filter((word: string) => word.length > 0).length;

      // Check compliance
      const hasOptOut = /stop|opt.?out|unsubscribe/i.test(generatedMessage);
      const hasBusinessName = /elite.?iit/i.test(generatedMessage);
      const hasCTA = /call|contact|visit|reply|click|join/i.test(generatedMessage);
      const withinLimit = messageType === 'sms' ? characterCount <= 160 : characterCount <= 200;
      const hasLocation = /yelahanka|bangalore/i.test(generatedMessage);

      const isCompliant = hasOptOut && hasBusinessName && hasCTA && withinLimit && hasLocation;

      const aiMessage = await storage.createAiMessage({
        messageType,
        promotionalIdea,
        generatedMessage,
        characterCount,
        wordCount,
        isCompliant
      });

      res.json({
        ...aiMessage,
        compliance: {
          hasOptOut,
          hasBusinessName,
          hasCTA,
          withinLimit,
          hasLocation,
          isCompliant
        }
      });

    } catch (error) {
      console.error('AI message generation error:', error);
      res.status(500).json({ error: "Failed to generate AI message" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
