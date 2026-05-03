# Local Development Setup

## Quick Fix for Login Issues

If you're seeing "Failed to fetch" errors when trying to log in, you need to configure your Supabase credentials.

### Step 1: Get Your Supabase Credentials

1. Go to [supabase.com](https://supabase.com) and log in
2. Go to your project dashboard
3. Navigate to **Settings** → **API**
4. Copy these values:
   - **Project URL**: Looks like `https://xxxxxxxxxxxx.supabase.co`
   - **anon public key**: A long string starting with `eyJ...`

### Step 2: Create .env.local File

In the `web` directory, create a file named `.env.local` with your credentials:

```bash
# Copy this to web/.env.local
VITE_SUPABASE_URL=https://your-actual-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here
VITE_API_URL=http://localhost:3000
VITE_LOG_LEVEL=debug
VITE_ENABLE_OPTIBOT=true
VITE_ENABLE_ANALYTICS=false
```

### Step 3: Restart the Dev Server

Stop the current dev server (Ctrl+C) and restart it:

```bash
npm run dev
```

### Step 4: Test Login

Now try logging in again. It should work with your actual Supabase credentials.

## Full Local Development Setup

### Prerequisites

- Node.js 18+ installed
- Supabase project created
- Git installed (optional)

### Installation

1. Install dependencies:
```bash
cd web
npm install
```

2. Configure environment variables (see above)

3. Start development server:
```bash
npm run dev
```

4. Open browser to `http://localhost:5173`

## Database Setup

If you need to set up the database locally:

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Link to your Supabase project:
```bash
cd supabase
supabase link
```

3. Push migrations:
```bash
supabase db push
```

## Troubleshooting

### "Failed to fetch" on login
- Check that `.env.local` exists in the `web` directory
- Verify Supabase URL and anon key are correct
- Restart the dev server after changing env vars

### Build errors
- Run `npm install` to ensure dependencies are up to date
- Check that Node.js version is 18 or higher
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

### Database connection errors
- Verify Supabase project is active
- Check that RLS policies are configured
- Run the database verification scripts
