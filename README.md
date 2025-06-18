# Cosmic Dating: Find Your Celestial Connection

Welcome to Cosmic Dating, where meaningful connections are forged through the alignment of stars, not just superficial glances. This application offers a unique dating experience focused on astrological compatibility, allowing users to discover deep connections based on their cosmic blueprints.

## ✨ Features

*   **Astrological Matching**: Users provide their birth date, time, and place, which our system uses to calculate precise planetary positions and determine astrological compatibility with potential matches.
*   **Personalized Profiles**: Create a detailed profile that highlights your unique cosmic signature and preferences, moving beyond traditional photo-based dating.
*   **Meaningful Conversations**: Engage in rich conversations with your matches, fostering connections that are truly written in the stars.
*   **Secure Authentication**: Seamless and secure user authentication powered by Google OAuth through Supabase.
*   **Responsive Design**: Enjoy a beautiful and intuitive experience across all devices, from mobile to desktop.

## 🚀 Tech Stack

*   **Frontend Framework**: React (with TypeScript)
*   **Build Tool**: Vite
*   **Styling**: Tailwind CSS & shadcn/ui
*   **Routing**: React Router DOM
*   **Backend & Authentication**: Supabase
*   **Data Fetching**: TanStack Query (React Query)
*   **Icons**: Lucide React
*   **Form Management**: React Hook Form with Zod validation
*   **Notifications**: Sonner & `@/components/ui/toast`
*   **Date Handling**: `date-fns` & `react-day-picker`

## 🛠️ Getting Started (Local Development)

To set up the project locally, follow these steps:

1.  **Clone the repository**:
    ```sh
    git clone <YOUR_GIT_URL>
    ```
2.  **Navigate to the project directory**:
    ```sh
    cd <YOUR_PROJECT_NAME>
    ```
3.  **Install dependencies**:
    ```sh
    npm install
    ```
4.  **Set up Supabase Environment Variables**:
    Ensure you have your Supabase project URL and Anon Key configured as environment variables. You'll need to create a `.env` file in the root of your project with the following:
    ```
    VITE_SUPABASE_URL="YOUR_SUPABASE_URL"
    VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
    VITE_GOOGLE_MAPS_API_KEY="YOUR_GOOGLE_MAPS_API_KEY"
    VITE_GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
    ```
    *   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are found in your Supabase project settings (API section).
    *   `VITE_GOOGLE_MAPS_API_KEY` is required for the place search functionality.
    *   `VITE_GEMINI_API_KEY` is required for automated chat responses.
5.  **Start the development server**:
    ```sh
    npm run dev
    ```
    This will start the application, typically accessible at `http://localhost:8080`.

## ☁️ Deployment

This project can be deployed using any standard static site hosting service (e.g., Vercel, Netlify, GitHub Pages).

## 🌐 Custom Domain

Yes, you can! Refer to your chosen hosting provider's documentation for instructions on connecting a custom domain.