# OptiSched

An academic scheduling platform for institutions with fixed block schedules, role-based access, approval workflows, and cross-platform delivery.

## Project Structure

```
optisched/
├── docs/                      # All documentation
│   ├── PRD.md                 # Product Requirements Document
│   ├── BRAND_SYSTEM.md        # Brand guidelines and design system
│   └── ANALYTICS_SETUP.md     # Analytics configuration
├── database/                  # Database configuration and schemas
│   ├── schemas/               # SQL schema files
│   │   ├── database_schema.sql
│   │   └── supabase_avatars.sql
│   └── supabase/              # Supabase migrations and policies
├── mobile/                    # React Native/Expo mobile app
│   ├── App.tsx
│   ├── app.json
│   ├── eas.json
│   ├── src/
│   ├── assets/
│   └── package.json
├── web/                       # Vite + React web application
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── web-static/                # Static web pages
│   ├── about.html
│   ├── privacy.html
│   └── terms.html
├── scripts/                   # Utility scripts
│   ├── replacer.js
│   └── replacer.py
├── .windsurf/                 # Windsurf AI assistant configuration
└── .git/                      # Git configuration
```

## Getting Started

### Web Application

```bash
cd web
npm install
npm run dev
```

### Mobile Application

```bash
cd mobile
npm install
npx expo start
```

## Tech Stack

- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Frontend (Web)**: React, Vite, TypeScript, React Router
- **Frontend (Mobile)**: React Native, Expo, TypeScript
- **Styling**: Custom CSS with design system
- **Icons**: Lucide React

## Documentation

- See `docs/PRD.md` for product requirements
- See `docs/BRAND_SYSTEM.md` for brand guidelines and design system
- See `database/schemas/` for database structure

## License

Built for serious institutions.
