# Shelterly

A web application that aggregates verified animal shelter needs across Poland, connecting compassionate donors with shelters that need help.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Project Scope](#project-scope)
- [Project Status](#project-status)
- [License](#license)

## Overview

### The Problem

Animal shelters across Poland often face shortages of essential resources (food, blankets, cleaning supplies). Information about their current needs is scattered across various channels—social media, websites, and flyers—making it difficult for potential donors to understand what's actually needed and where.

### The Solution

Shelterly provides a centralized platform where:

- **Donors** can quickly find verified shelters in their area and understand specific needs via an interactive map
- **Shelters** can easily manage and update their resource requests
- **Administrators** can verify shelter authenticity and maintain platform integrity

### Target Users

1. **Donors** - Individuals wanting to help locally, without creating an account
2. **Shelters** - Verified facilities managing donation requests
3. **Super Admin** - Internal team verifying shelter legitimacy

## Tech Stack

### Frontend

- **Astro 5** - Modern static site builder with minimal JavaScript overhead
- **React 19** - Interactive components (Islands Architecture) for dynamic features
- **TypeScript 5** - Static typing for improved code quality and IDE support
- **Tailwind CSS 4** - Utility-first styling framework
- **Shadcn/ui** - High-quality, accessible component library
- **React-Leaflet** - Interactive mapping functionality
- **Lucide React** - Icon library

### Backend

- **Supabase** - Complete backend-as-a-service solution
  - PostgreSQL database
  - Email/Password authentication
  - File storage with RLS policies for document verification
- **Astro Node Adapter** - Serverless API endpoints

### AI & External Services

- **OpenRouter.ai** - Access to multiple AI models for text generation and search query construction

### Infrastructure & Deployment

- **Vercel** - Serverless hosting with automatic Git integration
- **GitHub Actions** - CI/CD pipeline for testing and linting
- **Supabase Cloud** - Managed database and authentication

## Getting Started

### Prerequisites

- Node.js **22.14.0** or higher (see [.nvmrc](.nvmrc))
- npm or yarn package manager
- Git

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/SebayK/Shelterly.git
   cd Shelterly
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Setup**

   Create a `.env.local` file in the root directory with your Supabase credentials:

   ```env
   PUBLIC_SUPABASE_URL=your_supabase_url
   PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   OPENROUTER_API_KEY=your_openrouter_key
   ```

4. **Start Development Server**

   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:3000`

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the development server with hot reload |
| `npm run build` | Build the project for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint to check code quality |
| `npm run lint:fix` | Automatically fix linting issues |
| `npm run format` | Format code with Prettier |
| `npm run astro` | Run Astro CLI commands directly |

## Project Scope

### MVP Features

#### For Shelters

- **Registration & Verification** - Submit facility information and verification documents (NIP/KRS)
- **Profile Management** - Update shelter information and contact details
- **Need Management** - Add, edit, and archive resource requests with categories, quantities, and units
- **Progress Tracking** - Monitor donation progress toward collection goals

#### For Donors

- **Interactive Map** - Discover nearby verified shelters with clustering
- **Need Discovery** - Browse specific resource requests with progress indicators
- **Smart Recommendations** - Algorithm-based shelter suggestions based on proximity and urgency
- **Donation Logging** - Record donations to track community impact

#### For Administrators

- **Verification Dashboard** - Review shelter applications and supporting documents
- **Shelter Moderation** - Approve or reject registrations based on verification
- **System Management** - Oversee platform operations and resolve issues

### Technical Implementation

- Interactive map with React-Leaflet for shelter discovery
- Zod validation for all API requests and responses
- Row-Level Security (RLS) policies for data protection
- AI-generated descriptions for needs (cached to reduce costs)
- Serverless API architecture for scalability
- Responsive design with Tailwind CSS and Shadcn/ui components

## Project Status

**Version:** 1.0 (MVP)  
**Status:** Approved for Implementation  
**Last Updated:** January 8, 2026

### Implementation Roadmap

1. ✅ Project setup and repository initialization
2. ⏳ Database schema and Supabase configuration
3. ⏳ Authentication system implementation
4. ⏳ API endpoints (CRUD operations)
5. ⏳ Frontend core (landing page, map, shelter view)
6. ⏳ Shelter dashboard (need management)
7. ⏳ Admin interface (verification)
8. ⏳ Testing and quality assurance
9. ⏳ Deployment and CI/CD pipeline

## Project Structure

```
.
├── src/
│   ├── components/        # React and Astro components
│   │   └── ui/           # Shadcn/ui component library
│   ├── layouts/          # Astro layout templates
│   ├── lib/              # Services and utility functions
│   ├── pages/            # Astro routes and API endpoints
│   │   └── api/          # API routes
│   ├── db/               # Supabase clients and types
│   ├── types.ts          # Shared TypeScript types
│   ├── middleware/       # Astro middleware
│   ├── styles/           # Global styles
│   └── assets/           # Static internal assets
├── public/               # Public static files
├── package.json
├── tsconfig.json
├── astro.config.mjs
├── tailwind.config.js
├── eslint.config.js
└── README.md
```

## Contributing

This project follows modern development practices:

- **Code Quality** - ESLint and Prettier enforce consistent code style
- **Git Hooks** - Husky and lint-staged automatically check code before commits
- **Type Safety** - TypeScript ensures type correctness across the codebase
- **Accessibility** - Shadcn/ui components and ARIA best practices ensure inclusive design

## Support & Documentation

For more detailed information about the project vision and implementation approach, see:

- [Product Requirements Document](https://github.com/SebayK/Shelterly/blob/main/.ai/prd.md)
- [Technology Stack Details](https://github.com/SebayK/Shelterly/blob/main/.ai/tech-stack.md)

## License

MIT License - See LICENSE file for details

---

**Made with ❤️ for animal shelters in Poland**


## AI Development Support

This project is configured with AI development tools to enhance the development experience, providing guidelines for:

- Project structure
- Coding practices
- Frontend development
- Styling with Tailwind
- Accessibility best practices
- Astro and React guidelines

### Cursor IDE

The project includes AI rules in `.cursor/rules/` directory that help Cursor IDE understand the project structure and provide better code suggestions.

### GitHub Copilot

AI instructions for GitHub Copilot are available in `.github/copilot-instructions.md`

### Windsurf

The `.windsurfrules` file contains AI configuration for Windsurf.

## Contributing

Please follow the AI guidelines and coding practices defined in the AI configuration files when contributing to this project.

## License

MIT
