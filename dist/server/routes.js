import { createServer } from "http";
import { storage } from "./storage.js";
import multer from "multer";
import * as XLSX from "xlsx";
import { insertCampaignSchema } from "../shared/schema.js";
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
        }
        else {
            cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.'));
        }
    }
});
const brevoApi = process.env.BREVO_API_KEY ? new TransactionalEmailsApi() : null;
if (brevoApi && process.env.BREVO_API_KEY) {
    brevoApi.setApiKey(TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
}
export async function registerRoutes(app) {
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
            const firstRow = jsonData[0];
            const hasName = 'Name' in firstRow || 'name' in firstRow;
            const hasEmail = 'Email' in firstRow || 'email' in firstRow;
            if (!hasName || !hasEmail) {
                return res.status(400).json({
                    error: "Required columns missing. File must contain 'Name' and 'Email' columns."
                });
            }
            // Parse contacts
            const contactsToInsert = jsonData.map((row) => ({
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
        }
        catch (error) {
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
        }
        catch (error) {
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
                }
                catch (error) {
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
        }
        catch (error) {
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
        }
        catch (error) {
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
            const wordCount = generatedMessage.split(/\s+/).filter((word) => word.length > 0).length;
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
        }
        catch (error) {
            console.error('AI message generation error:', error);
            res.status(500).json({ error: "Failed to generate AI message" });
        }
    });
    // Generate AI image
    app.post("/api/generate-image", async (req, res) => {
        try {
            // Check if API keys are configured
            if (!process.env.OPENROUTER_API_KEY) {
                return res.status(503).json({
                    error: "AI service not configured. Please add OPENROUTER_API_KEY to environment variables."
                });
            }
            if (!process.env.FREEPIK_API_KEY) {
                return res.status(503).json({
                    error: "Image service not configured. Please add FREEPIK_API_KEY to environment variables."
                });
            }
            const { imageDescription } = req.body;
            if (!imageDescription || imageDescription.trim().length === 0) {
                return res.status(400).json({ error: "Image description is required" });
            }
            // Step 1: Enhance prompt using DeepSeek
            const enhancementSystemPrompt = `You are an expert prompt engineer specializing in Google Imagen 3 image generation. Transform simple image ideas into detailed, high-quality prompts that produce professional marketing visuals for Elite IIT Coaching Institute.

ENHANCEMENT GUIDELINES:
- Add specific visual details (lighting, composition, colors, style)
- Include professional photography terms (shallow depth of field, golden hour, etc.)
- Specify image quality (high resolution, sharp focus, professional photography)
- Add relevant educational context when appropriate
- Keep prompts under 200 words for optimal Imagen 3 performance
- Focus on clean, modern, inspiring visuals suitable for educational marketing

Transform this simple idea into a detailed Imagen 3 prompt: ${imageDescription}`;
            const enhanceResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
                        { role: 'system', content: enhancementSystemPrompt },
                        { role: 'user', content: imageDescription }
                    ],
                    max_tokens: 500,
                    temperature: 0.8
                })
            });
            if (!enhanceResponse.ok) {
                const errorData = await enhanceResponse.json().catch(() => ({}));
                const errorMessage = errorData.error?.message || enhanceResponse.statusText;
                throw new Error(`Prompt enhancement error: ${errorMessage}`);
            }
            const enhanceData = await enhanceResponse.json();
            const enhancedPrompt = enhanceData.choices[0]?.message?.content || imageDescription;
            // Step 2: Generate image using Freepik API with Google Imagen 3
            const imageResponse = await fetch('https://api.freepik.com/v1/ai/text-to-image/imagen3', {
                method: 'POST',
                headers: {
                    'x-freepik-api-key': process.env.FREEPIK_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: enhancedPrompt,
                    num_images: 1,
                    aspect_ratio: 'widescreen_16_9'
                })
            });
            if (!imageResponse.ok) {
                const errorData = await imageResponse.json().catch(() => ({}));
                const errorMessage = errorData.message || imageResponse.statusText;
                throw new Error(`Image generation error: ${errorMessage}`);
            }
            const imageData = await imageResponse.json();
            const taskId = imageData.data?.task_id || imageData.task_id;
            if (!taskId) {
                throw new Error('No task ID returned from Freepik API');
            }
            // Poll for task completion
            let imageUrl = '';
            let attempts = 0;
            const maxAttempts = 60; // 60 attempts * 2 seconds = 2 minutes max
            while (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between polls
                const statusResponse = await fetch(`https://api.freepik.com/v1/ai/text-to-image/imagen3/${taskId}`, {
                    method: 'GET',
                    headers: {
                        'x-freepik-api-key': process.env.FREEPIK_API_KEY
                    }
                });
                if (!statusResponse.ok) {
                    throw new Error(`Failed to check task status: ${statusResponse.statusText}`);
                }
                const statusData = await statusResponse.json();
                const status = statusData.data?.status;
                if (status === 'COMPLETED') {
                    const generatedImages = statusData.data?.generated || [];
                    if (generatedImages.length > 0) {
                        imageUrl = generatedImages[0];
                        break;
                    }
                    else {
                        throw new Error('Task completed but no images were generated');
                    }
                }
                else if (status === 'FAILED') {
                    throw new Error('Image generation task failed');
                }
                attempts++;
            }
            if (!imageUrl) {
                throw new Error('Image generation timed out after 2 minutes');
            }
            res.json({
                originalPrompt: imageDescription,
                enhancedPrompt,
                imageUrl
            });
        }
        catch (error) {
            console.error('Image generation error:', error);
            res.status(500).json({
                error: error instanceof Error ? error.message : "Failed to generate image"
            });
        }
    });
    const httpServer = createServer(app);
    return httpServer;
}
