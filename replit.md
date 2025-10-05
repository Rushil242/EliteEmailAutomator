# Overview

This is a marketing automation demonstration application for Elite IIT Coaching Institute. The application provides three main features: bulk email marketing, AI-powered message generation for WhatsApp/SMS campaigns, and AI-powered image generation for marketing visuals. Built as a full-stack Node.js application, it showcases automated marketing capabilities using modern web technologies and third-party AI/email services.

The application allows users to upload contact lists (Excel/CSV), validate email addresses, compose personalized email campaigns, generate compliant marketing messages for WhatsApp and SMS using AI, and create professional marketing images through a two-step AI enhancement process.

**Authentication**: The application now includes Supabase authentication with secure login/logout functionality. All marketing features are protected and require user authentication. The system supports up to 6 users (1 admin + 5 team members) with persistent sessions across browser sessions.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool and development server.

**UI Components**: Implements shadcn/ui component library (Radix UI primitives) with Tailwind CSS for styling. The design system uses a "new-york" style with CSS variables for theming and a neutral color palette.

**State Management**: Uses @tanstack/react-query for server state management with custom query client configuration. Local component state is managed with React hooks.

**Routing**: Implements wouter for client-side routing (lightweight React Router alternative).

**File Structure**: Components are organized by feature (email-marketing, ai-message-creator, message-generator, etc.) with reusable UI components in the ui/ directory.

## Backend Architecture

**Runtime**: Node.js with Express.js server framework using ESM modules.

**Development**: Uses tsx for TypeScript execution in development and esbuild for production builds.

**File Upload**: Implements multer middleware for handling multipart/form-data file uploads with in-memory storage.

**Data Parsing**: Uses XLSX library to parse Excel (.xlsx, .xls) and CSV files for contact extraction.

**Storage Strategy**: Currently uses in-memory storage (MemStorage class) for demo purposes. The storage layer is abstracted through an IStorage interface, allowing easy migration to persistent database storage.

**Database Schema**: Drizzle ORM is configured with PostgreSQL dialect, with schema defined in shared/schema.ts. Tables include contacts, campaigns, emailResults, and aiMessages. The application is prepared for Neon Database serverless PostgreSQL but currently operates without persistent database.

## External Dependencies

**Email Service**: Brevo API integration for bulk email delivery using @getbrevo/brevo npm package. Email personalization supports {name} placeholder replacement. Configured with TransactionalEmailsApi for sending transactional emails.

**AI Service**: OpenRouter API for AI message generation and image prompt enhancement using DeepSeek V3 model (free tier). Generates compliant WhatsApp and SMS marketing messages based on promotional ideas. Also enhances simple image descriptions into detailed, professional prompts optimized for Google Imagen 3.

**Image Generation Service**: Freepik API integration for AI-powered image generation using Google Imagen 3 model. Accepts enhanced prompts and generates high-quality marketing visuals in widescreen 16:9 aspect ratio. Requires FREEPIK_API_KEY environment variable.

**Database**: Drizzle ORM configured for @neondatabase/serverless PostgreSQL. Schema includes UUID primary keys, timestamps, and relationship fields. Database migrations stored in ./migrations directory.

**Authentication**: Supabase authentication with @supabase/supabase-js for secure user login/logout. Features include:
- Persistent sessions using localStorage with automatic token refresh
- Protected routes that redirect unauthenticated users to login
- AuthContext provider for app-wide authentication state management
- Type-safe error handling with Supabase AuthError types
- User email display and logout functionality in app header
- Backend middleware for API route protection using JWT token validation

**Session Management**: Uses connect-pg-simple for PostgreSQL-based session storage (configured but not actively used as Supabase handles sessions).

**Development Tools**: 
- Replit-specific plugins for runtime error overlay, cartographer, and dev banner
- React Dev Tools support through Vite configuration

**Form Management**: @hookform/resolvers with Zod for schema validation using drizzle-zod for type-safe form handling.

**File Processing**: 
- react-dropzone for drag-and-drop file upload UI
- XLSX for spreadsheet parsing
- multer for server-side file handling

**Validation**: 
- Email validation performed on parsed contacts
- Compliance checking for WhatsApp/SMS messages (opt-out instructions, character limits, business name, CTA, location)

**API Design**: RESTful endpoints under /api prefix:
- POST /api/upload-contacts - File upload and contact parsing
- POST /api/campaigns - Campaign creation
- POST /api/campaigns/:id/send - Campaign execution
- GET /api/campaigns/:id/results - Campaign results
- POST /api/ai-message - AI message generation
- POST /api/generate-image - Two-step AI image generation (prompt enhancement + image creation)