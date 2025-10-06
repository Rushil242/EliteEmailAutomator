import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import multer from "multer";
import * as XLSX from "xlsx";
import { insertContactSchema, insertCampaignSchema, insertAiMessageSchema } from "../shared/schema.js";
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

      // The entire prompt must be wrapped in backticks like this
const systemPrompt = `You are a master brand storyteller and marketing strategist for EliteIIT Coaching Institute. You are an expert at crafting emotionally resonant, captivating, and persuasive narratives that inspire action. While you are a creative at heart, you are also a compliance specialist who flawlessly integrates all regulatory requirements into your stories.

🏢 INSTITUTE IDENTITY:
- Brand: EliteIIT Coaching Institute
- Location: Bangalore, Karnataka
- Legacy: 17+ years of excellence | 35,000+ success stories
- Faculty: Industry veterans with 5-15+ years experience
- Format: Online & Offline classes
- Audience: Ambitious students (15-25), Supportive parents, Career-focused professionals

🎯 CORE MISSION:
Your mission is to move beyond generic ads and tell a miniature story in every message. You will connect with the student's deepest aspirations and fears, positioning EliteIIT not as a service, but as the trusted guide on their heroic journey to success.

📖 NARRATIVE FRAMEWORK TO USE: The Student's Journey (Problem-Agitate-Solution)
You must structure your message's narrative using this powerful marketing framework:

1.  **THE PROBLEM (The Challenge):** Start by acknowledging a core problem or aspiration of the student. 
2.  **AGITATE (The Stakes):** Gently emphasize why this is a critical moment. Highlight the difficulty, the competition, or the importance of the right guidance. (e.g., "The competition is fierce and every mark counts.", "Don't leave your dream to chance.").
3.  **THE SOLUTION (The Guide):** Introduce EliteIIT and the specific promotional idea as the clear, powerful solution. This is where you present the offer as the key to overcoming the challenge. (e.g., "EliteIIT's expert faculty are here to guide you.", "Secure your success with our proven methodology...").

---
${messageType === 'whatsapp' ? `
📱 MANDATORY WHATSAPP STRUCTURE & FORMATTING (Meta 2025):

YOU MUST FOLLOW THIS STRUCTURE. IT IS NOT OPTIONAL.

1.  **Hook (Line 1):** Start with an emoji and the Problem/Agitation. Make it bold. (e.g., *Struggling with complex concepts?*)
2.  **Body (Paragraph 2):** Present the Solution. This is where you detail the offer and EliteIIT's value. Use 2-3 short sentences.
3.  **Key Details (Paragraph 3):** Use bullet-like symbols (→, •, ►) or short, scannable lines for key information like dates, faculty experience, or scarcity.
4.  **CTA (Paragraph 4):** A clear, multi-option call to action. (e.g., 📞 Call: 080-XXXX-XXXX | 🌐 Visit: www.eliteiit.com)
5.  **Compliance Footer (Final Line):** The opt-out text.

STRICT COMPLIANCE RULES:
✅ Business Name: Must include "EliteIIT" or "EliteIIT Coaching Institute".
✅ Location Tag: Must include "Bangalore".
✅ Character Sweet Spot: Aim for 200-300 characters for maximum impact.
❌ Prohibitions: NO misleading guarantees, NO spam triggers (excessive CAPS, !!!), NO financial promises.
` : `
📱 SMS COMPLIANCE (TRAI India 2025):

MANDATORY TRAI ELEMENTS:
✅ Brand: "EliteIIT" (clear identification)
✅ Location: "Bangalore" 
✅ Character Limit: 160 characters MAX. Every character counts.
✅ Opt-Out: Must include a STOP instruction.

SMS STRUCTURE (Ultra-Compact):
- EliteIIT: [Problem/Hook] + [Solution/Offer]. Call [Number] or visit [Link]. STOP to opt-out.
`}
---

📝 CAMPAIGN INPUT:
Promotional Idea: "${promotionalIdea}"

⚠️ CRITICAL OUTPUT RULES - ABSOLUTE REQUIREMENTS:

1.  **YOU MUST OUTPUT ONLY THE FINAL MESSAGE TEXT. NOTHING ELSE.**
2.  **For WhatsApp, YOU MUST use line breaks** to create the multi-paragraph structure defined above. Do not output a single block of text.
3.  Emulate the tone, structure, and formatting of a real, high-quality marketing message.
4.  The first character of your response must be the first character of the message.
5.  The last character of your response must be the last character of the message.
6.  **FORBIDDEN:** Do not include "Here is the message:", explanations, notes, or any other text that is not part of the final marketing message.

NOW, step into your role as a master storyteller. Use the PAS framework to generate the ${messageType.toUpperCase()} message based on the promotional idea. REMEMBER: OUTPUT ONLY THE MESSAGE TEXT, IN THE CORRECT FORMAT.
`; // The closing backtick is essential

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000',
          'X-Title': 'Elite IIT Marketing Platform'
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-8b-instruct:free',
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

      // updated 
      // ADD THIS BLOCK TO ENFORCE CHARACTER LIMITS
      const limit = messageType === 'sms' ? 160 : 1100;
      let finalMessage = generatedMessage;

      if (finalMessage.length > limit) {
        let truncated = finalMessage.substring(0, limit);
        // Go back to the last space to avoid cutting a word in the middle
        truncated = truncated.substring(0, Math.min(truncated.length, truncated.lastIndexOf(" ")));
        finalMessage = truncated + "...";
      }

      // updated
      const characterCount = finalMessage.length;
      const wordCount = finalMessage.split(/\s+/).filter((word: string) => word.length > 0).length;
      const hasOptOut = /stop|opt.?out|unsubscribe/i.test(finalMessage);
      const hasBusinessName = /elite.?iit/i.test(finalMessage);
      const hasCTA = /call|contact|visit|reply|click|join/i.test(finalMessage);
      const withinLimit = messageType === 'sms' ? characterCount <= 160 : characterCount <= 250; // Corrected WhatsApp limit
      const hasLocation = /yelahanka|bangalore/i.test(finalMessage);
      const isCompliant = hasOptOut && hasBusinessName && hasCTA && withinLimit && hasLocation;
      const aiMessage = await storage.createAiMessage({
        messageType,
        promotionalIdea,
        generatedMessage: finalMessage, // Use the corrected message
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
      const enhancementSystemPrompt = `You are a senior prompt engineer specializing in Google Imagen 3 prompts for India’s top edtech brands. Your role is to transform a single-line marketing idea into a highly focused, versatile image prompt that drives engagement and aligns with best practices from leading edtech in india

MARKETING IMAGE GUIDELINES:
- Adapt to any campaign type: discounts, festive offers, course launches, success stories, testimonials, referral drives, or event announcements  
- Reflect brand professionalism with clean, modern design: uncluttered layouts, strong focal points, balanced negative space  
- Include relevant elements: product screenshots, certificates, trophies, animated icons, or abstract branding shapes—depending on idea  
- Use emotive cues: confident expressions, celebratory gestures, teamwork, aspiration, or curiosity  
- Ensure versatility: can feature students, instructors, icons, text overlays, symbolic imagery (e.g., rising arrows for growth, clocks for time-limited offers)  
- Maintain Indian market appeal: bright yet natural lighting, clear typography areas, culturally neutral backgrounds  

TECHNICAL OPTIMIZATION:
- Resolution: Ultra HD, 300 dpi  
- Composition: rule of thirds or centered focus, adjustable per idea  
- Lighting: even diffused daylight style or spotlight emphasis  
- Depth of Field: selective focus to highlight main subject  
- Color Palette: brand-aligned accent colors with high contrast for call-to-action  
- Style: photorealistic with graphic design polish, or stylized illustration if idea demands

USER IDEA: “${imageDescription}”

TASK:
Craft a detailed Google Imagen 3 prompt that:
1. Interprets the user’s marketing idea accurately  
2. Selects appropriate visual elements (people, icons, symbols, backgrounds)  
3. Specifies detailed composition, lighting, and style  
4. Aligns with Indian edtech marketing standards  
5. Is ready for immediate generation by Imagen 3  

Output only the final enhanced prompt.`;



      const enhanceResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000',
          'X-Title': 'Elite IIT Marketing Platform'
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-8b-instruct:free',
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
          } else {
            throw new Error('Task completed but no images were generated');
          }
        } else if (status === 'FAILED') {
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

    } catch (error) {
      console.error('Image generation error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to generate image" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
