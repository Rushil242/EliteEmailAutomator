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

// In-memory cache for image generation tasks (lazy initialization pattern)
interface ImageTask {
  originalPrompt: string;
  enhancedPrompt?: string;
  freepikTaskId?: string;
  status: 'CREATED' | 'INITIALIZING' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  imageUrl?: string;
  error?: string;
}

const imageTaskCache = new Map<string, ImageTask>();

// Helper function to generate unique task IDs
function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
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

  // Start image generation (returns task ID immediately - LAZY INITIALIZATION)
  app.post("/api/generate-image/start", async (req, res) => {
    try {
      if (!process.env.FREEPIK_API_KEY) {
        return res.status(503).json({ 
          error: "Image generation service not configured. Please add FREEPIK_API_KEY to environment variables." 
        });
      }

      if (!process.env.OPENROUTER_API_KEY) {
        return res.status(503).json({ 
          error: "AI service not configured. Please add OPENROUTER_API_KEY to environment variables." 
        });
      }

      const { imageDescription } = req.body;

      if (!imageDescription || imageDescription.trim().length === 0) {
        return res.status(400).json({ error: "Image description is required" });
      }

      // Generate task ID and store minimal info - INSTANT RESPONSE
      const taskId = generateTaskId();
      
      imageTaskCache.set(taskId, {
        originalPrompt: imageDescription,
        status: 'CREATED'
      });

      console.log(`Image task created: ${taskId} - Will initialize on first status check`);

      // Return immediately - actual processing happens on first status check
      res.json({
        taskId,
        originalPrompt: imageDescription,
        enhancedPrompt: '', // Will be populated on first status check
        status: 'CREATED'
      });

    } catch (error) {
      console.error('Image generation start error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to start image generation" 
      });
    }
  });

  // Check image generation status (with LAZY INITIALIZATION)
  app.get("/api/generate-image/status/:taskId", async (req, res) => {
    try {
      if (!process.env.FREEPIK_API_KEY) {
        return res.status(503).json({ 
          error: "Image generation service not configured." 
        });
      }

      if (!process.env.OPENROUTER_API_KEY) {
        return res.status(503).json({ 
          error: "AI service not configured." 
        });
      }

      const { taskId } = req.params;

      if (!taskId) {
        return res.status(400).json({ error: "Task ID is required" });
      }

      // Get task from cache
      const task = imageTaskCache.get(taskId);

      if (!task) {
        return res.status(404).json({ 
          status: 'ERROR',
          error: 'Task not found. It may have expired.' 
        });
      }

      // LAZY INITIALIZATION: If task is in CREATED state, initialize it now
      if (task.status === 'CREATED') {
        task.status = 'INITIALIZING';
        console.log(`Initializing task ${taskId}...`);

        try {
          // Step 1: Enhance prompt using OpenRouter
          const promptEnhancementSystemPrompt = `You are an expert AI image prompt engineer specializing in Google Imagen 3. Your task is to transform simple user descriptions into detailed, professional prompts optimized for Google Imagen 3's text-to-image generation.

GOOGLE IMAGEN 3 CHARACTERISTICS:
- Excels at photorealistic imagery and artistic styles
- Strong understanding of composition, lighting, and perspective
- Best with clear, descriptive language and specific visual details
- Supports various aspect ratios and style modifiers

YOUR TRANSFORMATION PROCESS:
1. Analyze the user's simple description
2. Expand it with rich visual details:
   - Specific lighting conditions (golden hour, soft diffused, dramatic shadows)
   - Color palette and mood (warm tones, vibrant, muted pastels)
   - Composition and perspective (wide angle, close-up, rule of thirds)
   - Artistic style if applicable (photorealistic, digital art, illustration)
   - Texture and material details (smooth, glossy, textured)

EDUCATIONAL MARKETING CONTEXT:
- Images are for Elite IIT Coaching Institute marketing
- Target audience: Students (15-25 years), parents, education seekers
- Tone: Professional, inspiring, trustworthy, modern
- Common themes: Education, success, technology, youth, achievement

OUTPUT REQUIREMENTS:
1. Return ONLY the enhanced prompt text
2. NO explanations, NO meta-commentary
3. Keep prompts concise but descriptive (50-150 words)
4. Use natural, flowing language
5. Include relevant marketing context for educational institution

EXAMPLES:
User: "Students studying"
Enhanced: "A diverse group of focused students studying together in a modern, well-lit classroom, warm afternoon sunlight streaming through large windows, creating a motivating and collaborative atmosphere. Contemporary educational setting with clean lines, students engaged with laptops and books, expressions of concentration and determination. Professional photography style, shallow depth of field focusing on students in foreground, soft bokeh background, vibrant yet professional color grading emphasizing blues and warm oranges."

User: "Success celebration"
Enhanced: "Joyful students celebrating academic success, throwing graduation caps in the air against a bright blue sky, golden hour lighting creating a warm, triumphant atmosphere. Wide-angle shot capturing the energy and emotion, diverse group of young achievers in graduation attire, genuine smiles and expressions of achievement. Professional event photography style, sharp focus on celebrating students, dynamic composition with upward movement, vibrant natural colors, inspiring and uplifting mood perfect for educational marketing."

Now, enhance the following user description into a Google Imagen 3 optimized prompt:`;

          const promptResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
                { role: 'system', content: promptEnhancementSystemPrompt },
                { role: 'user', content: task.originalPrompt }
              ],
              temperature: 0.8,
              max_tokens: 300
            })
          });

          if (!promptResponse.ok) {
            const errorText = await promptResponse.text();
            throw new Error(`Prompt enhancement failed: ${promptResponse.statusText} - ${errorText}`);
          }

          const promptData = await promptResponse.json();
          const enhancedPrompt = promptData.choices[0]?.message?.content || task.originalPrompt;
          task.enhancedPrompt = enhancedPrompt;

          // Step 2: Submit to Freepik API
          const imageResponse = await fetch('https://api.freepik.com/v1/ai/text-to-image/imagen3', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'x-freepik-api-key': process.env.FREEPIK_API_KEY
            },
            body: JSON.stringify({
              prompt: enhancedPrompt,
              num_images: 1,
              aspect_ratio: 'widescreen_16_9',
              styling: {
                style: 'photo'
              },
              person_generation: 'allow_adult',
              safety_settings: 'block_medium_and_above'
            })
          });

          if (!imageResponse.ok) {
            const errorText = await imageResponse.text();
            console.error('Freepik API error response:', errorText);
            throw new Error(`Freepik API error: ${imageResponse.status} - ${errorText}`);
          }

          const imageData = await imageResponse.json();
          console.log('Freepik API response:', JSON.stringify(imageData));
          
          const freepikTaskId = imageData.data?.task_id;
          const taskStatus = imageData.data?.status;

          if (!freepikTaskId) {
            console.error('Freepik response structure:', imageData);
            throw new Error(`No task ID received from Freepik API. Response: ${JSON.stringify(imageData)}`);
          }

          task.freepikTaskId = freepikTaskId;
          task.status = taskStatus === 'COMPLETED' ? 'COMPLETED' : 'PENDING';

          console.log(`Task ${taskId} initialized successfully. Freepik task: ${freepikTaskId}, Status: ${taskStatus}`);

        } catch (error) {
          console.error('Task initialization error:', error);
          task.status = 'FAILED';
          task.error = error instanceof Error ? error.message : 'Initialization failed';
          return res.json({
            status: 'FAILED',
            error: task.error
          });
        }
      }

      // If we have a Freepik task ID, check its status
      if (task.freepikTaskId) {
        const statusResponse = await fetch(`https://api.freepik.com/v1/ai/text-to-image/imagen3/${task.freepikTaskId}`, {
          headers: {
            'Accept': 'application/json',
            'x-freepik-api-key': process.env.FREEPIK_API_KEY
          }
        });

        if (!statusResponse.ok) {
          // Handle rate limiting
          if (statusResponse.status === 429) {
            return res.status(429).json({ 
              status: 'RATE_LIMITED',
              error: 'Rate limit exceeded. Please try again in a few moments.',
              retryAfter: statusResponse.headers.get('Retry-After') || '30'
            });
          }
          
          const errorText = await statusResponse.text();
          throw new Error(`Failed to check status: ${statusResponse.status} - ${errorText}`);
        }

        const statusData = await statusResponse.json();
        const status = statusData.data?.status;

        console.log(`Freepik task ${task.freepikTaskId} status: ${status}`);

        if (status === 'COMPLETED') {
          const generatedImages = statusData.data?.generated || [];
          if (generatedImages.length > 0) {
            const imageUrl = generatedImages[0];
            task.imageUrl = imageUrl;
            task.status = 'COMPLETED';

            return res.json({
              status: 'COMPLETED',
              imageUrl,
              enhancedPrompt: task.enhancedPrompt || task.originalPrompt
            });
          } else {
            task.status = 'FAILED';
            task.error = 'Task completed but no images were generated';
            return res.json({
              status: 'FAILED',
              error: task.error
            });
          }
        } else if (status === 'FAILED') {
          const errorMessage = statusData.data?.error?.message 
            || statusData.data?.error 
            || statusData.data?.message 
            || statusData.message
            || 'Image generation failed';
          
          console.error('Freepik task failed:', errorMessage, 'Full response:', JSON.stringify(statusData));
          task.status = 'FAILED';
          task.error = errorMessage;

          return res.json({
            status: 'FAILED',
            error: errorMessage
          });
        } else {
          // Still processing (PENDING, PROCESSING, etc.)
          task.status = status || 'PROCESSING';
          return res.json({
            status: task.status,
            message: 'Image is being generated...'
          });
        }
      }

      // Return current task status
      return res.json({
        status: task.status,
        imageUrl: task.imageUrl,
        error: task.error,
        message: task.status === 'INITIALIZING' ? 'Initializing image generation...' : 'Processing...'
      });

    } catch (error) {
      console.error('Image status check error:', error);
      res.status(500).json({ 
        status: 'ERROR',
        error: error instanceof Error ? error.message : "Failed to check image status" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
