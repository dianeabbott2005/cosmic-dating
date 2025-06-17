# AI Development Rules for Zodiac Heart Sync

This document outlines the core technologies used in the project and provides clear guidelines on which libraries to use for specific functionalities. Adhering to these rules ensures consistency, maintainability, and optimal performance.

## Tech Stack Overview

*   **Frontend Framework**: React (with TypeScript) for building interactive user interfaces.
*   **Build Tool**: Vite for a fast development experience and optimized builds.
*   **Language**: TypeScript for type safety and improved code quality.
*   **Styling**: Tailwind CSS for utility-first CSS, enabling rapid and consistent UI development.
*   **UI Components**: shadcn/ui for pre-built, accessible, and customizable UI components.
*   **Routing**: React Router DOM for declarative navigation within the application.
*   **Backend & Authentication**: Supabase for database, authentication, and serverless functions.
*   **Data Fetching**: TanStack Query (React Query) for efficient server state management and data synchronization.
*   **Icons**: Lucide React for a comprehensive set of customizable SVG icons.
*   **Form Management**: React Hook Form for robust form handling, integrated with Zod for schema validation.
*   **Notifications**: Sonner for toast notifications and `@/components/ui/toast` for specific UI toasts.

## Library Usage Guidelines

To maintain a consistent and efficient codebase, please follow these rules when implementing new features or modifying existing ones:

*   **UI Components**:
    *   **Always** prioritize using components from `shadcn/ui`.
    *   If a required component is not available in `shadcn/ui` or needs significant customization, create a **new component file** in `src/components/`. **Do not modify** the source files of `shadcn/ui` components directly.
*   **Styling**:
    *   **Exclusively** use Tailwind CSS utility classes for all styling. Avoid custom CSS files or inline styles unless absolutely necessary for dynamic properties.
    *   Utilize `clsx` and `tailwind-merge` (via `cn` utility) for conditionally applying and merging Tailwind classes.
*   **Routing**:
    *   Use `react-router-dom` for all client-side routing.
    *   All main application routes should be defined in `src/App.tsx`.
*   **State Management & Data Fetching**:
    *   For managing server state and fetching data from Supabase, use `useQuery` and `useMutation` hooks from `@tanstack/react-query`.
    *   For local component state, use React's `useState` and `useReducer`.
*   **Authentication & Database Interactions**:
    *   All interactions with the backend (authentication, database queries, function calls) must use the `supabase` client from `src/integrations/supabase/client.ts`.
    *   Use the `useAuth` hook (`src/hooks/useAuth.tsx`) for accessing the current user's authentication status and profile.
*   **Icons**:
    *   Use icons from the `lucide-react` library.
*   **Forms & Validation**:
    *   Implement forms using `react-hook-form`.
    *   Define form schemas and perform validation using `zod`, integrated with `react-hook-form` via `@hookform/resolvers`.
*   **Notifications**:
    *   For general, non-blocking notifications, use `sonner`.
    *   For more interactive or dismissible toasts, use the `useToast` hook from `src/components/ui/use-toast.ts`.
*   **Date Handling**:
    *   Use `date-fns` for date manipulation and formatting.
    *   For date pickers, use `react-day-picker`.
*   **File Structure**:
    *   Place main application pages in `src/pages/`.
    *   Place reusable UI components in `src/components/`.
    *   Place custom React hooks in `src/hooks/`.
    *   Place utility functions in `src/utils/`.
    *   **Always create a new file for every new component or hook**, no matter how small. Do not add new components to existing files.
*   **Responsiveness**:
    *   All designs must be responsive and adapt well to different screen sizes using Tailwind's responsive utility classes.
*   **Error Handling**:
    *   Do not use `try/catch` blocks for API calls unless specifically requested or if it's for immediate UI feedback (e.g., displaying a toast). Let errors bubble up for centralized handling and debugging.
*   **Simplicity**:
    *   Prioritize simple and elegant solutions. Avoid over-engineering. Focus on the user's request and make the minimum necessary changes to achieve the desired functionality.