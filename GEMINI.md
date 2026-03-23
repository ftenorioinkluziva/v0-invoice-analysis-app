# Gemini Project Context: v0-invoice-analysis-app

This document provides context for the `v0-invoice-analysis-app` project to be used in future Gemini interactions.

## Project Overview

This is a full-stack web application built with [Next.js](https://nextjs.org) and [TypeScript](https://www.typescriptlang.org/). The application allows users to upload PDF invoices, extracts relevant data, and provides analytics and visualizations based on the extracted information.

The project was initially bootstrapped using [v0.dev](https://v0.app) and seems to be set up for automated deployments from the `main` branch.

### Key Technologies

*   **Framework:** Next.js (App Router)
*   **Language:** TypeScript
*   **UI:** React, Shadcn UI, Radix UI, Tailwind CSS
*   **Styling:** Tailwind CSS
*   **Authentication:** `better-auth` for email/password and Google social login.
*   **Database:** Serverless PostgreSQL (likely Neon, based on `@neondatabase/serverless` dependency).
*   **PDF Processing:** `pdf-parse` on the server-side.
*   **AI/LLM:** The `@ai-sdk/google` package is included, suggesting that Google's AI (Gemini) is used for data extraction or analysis from the invoices.
*   **Testing:**
    *   Unit/Integration: Vitest
    *   End-to-End: Playwright

## Getting Started

### Prerequisites

*   Node.js (v22+ recommended)
*   npm (v11+ recommended)
*   A PostgreSQL database and the connection string.

### Environment Setup

1.  Create a `.env.local` file by copying the `.env.example`.
2.  Fill in the required environment variables, especially:
    *   `DATABASE_URL`: The connection string for your PostgreSQL database.
    *   `BETTER_AUTH_SECRET`: A secret key for signing authentication tokens.
    *   `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: For Google OAuth.

### Installation

```bash
npm install
```

## Development

### Running the Development Server

To run the app in development mode, execute:

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### Key Commands

*   `npm run dev`: Starts the development server.
*   `npm run build`: Creates a production build of the application.
*   `npm run start`: Starts the production server.
*   `npm run lint`: Lints the codebase using ESLint.
*   `npm run test`: Runs unit and integration tests with Vitest.
*   `npm run test:e2e`: Runs end-to-end tests with Playwright.

## Project Structure

*   `app/`: Main application code using the Next.js App Router.
    *   `app/api/`: API routes for backend functionality like authentication and data extraction.
    *   `app/(auth)/`: Authentication-related pages (sign-in, sign-up).
    *   `app/page.tsx`: The main dashboard/landing page.
*   `components/`: Shared React components.
    *   `components/ui/`: Components from Shadcn UI.
*   `lib/`: Core logic, utilities, and third-party service integrations.
    *   `lib/auth.ts`: Configuration for the `better-auth` library.
    *   `lib/db.ts`: Database connection setup.
    *   `lib/invoice-utils.ts`: Utility functions related to invoice processing.
*   `scripts/`: Contains SQL migration files and scripts to run them.
*   `e2e/`: End-to-end tests written with Playwright.

## Development Conventions

*   **Styling:** Utility-first CSS with Tailwind CSS is the standard.
*   **Components:** Build and use modular components. Leverage Shadcn UI for UI elements where possible.
*   **Testing:**
    *   Write unit tests for utility functions and complex logic in `lib/` and place them in a `__tests__` subdirectory.
    *   Write E2E tests for user-facing features and flows and place them in the `e2e/` directory.
*   **Database:** Database schema changes are managed via SQL files in the `scripts/` directory.
