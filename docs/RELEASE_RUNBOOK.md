# OptiSched Release Runbook

This document outlines the process for releasing new versions of OptiSched.

## Pre-Release Checklist

### 1. Code Quality
- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] ESLint warnings addressed (or documented as acceptable)
- [ ] No console errors in browser
- [ ] Accessibility audit passes (keyboard navigation, screen readers)

### 2. Database Changes
- [ ] All SQL migrations written and tested
- [ ] Migrations follow the naming convention: `YYYYMMDD_description.sql`
- [ ] Migrations are idempotent (safe to re-run)
- [ ] RLS policies reviewed and tested
- [ ] Backup created before applying migrations

### 3. Documentation
- [ ] CHANGELOG.md updated with version notes
- [ ] Role matrix updated if new capabilities added
- [ ] Any new features documented
- [ ] Breaking changes documented

### 4. Security Review
- [ ] No hardcoded secrets
- [ ] API keys in environment variables
- [ ] RLS policies cover all new tables
- [ ] Audit logging enabled for sensitive operations

## Release Process

### 1. Prepare the Release
```bash
# Create a release branch
git checkout -b release/v1.X.Y

# Update version in package.json
# Update CHANGELOG.md
```

### 2. Apply Database Migrations
1. Review all pending SQL migrations in `database/supabase/`
2. Test migrations in a staging environment first
3. Apply migrations to production via Supabase SQL editor
4. Verify migration success
5. Create a backup before migration (if not done recently)

### 3. Deploy Frontend
```bash
# Build the application
cd web
npm run build

# Test the production build locally
npm run preview

# Deploy to hosting (Vercel, Netlify, etc.)
npm run deploy
```

### 4. Smoke Testing
After deployment, perform smoke tests:
- [ ] Login works for all roles
- [ ] Dashboard loads without errors
- [ ] Schedule views display correctly
- [ ] Admin pages accessible with proper permissions
- [ ] No console errors in browser dev tools
- [ ] Toast notifications appear correctly

### 5. Post-Release Monitoring
- Monitor error logs via Health page (`/admin/health`)
- Check `client_error_logs` table for new errors
- Monitor backup jobs status
- Verify feature flags are working as expected

## Rollback Procedure

If a critical issue is discovered:

### Frontend Rollback
```bash
# Revert to previous deployment
# Most hosting platforms support instant rollbacks
```

### Database Rollback
1. Identify the problematic migration
2. Create a rollback SQL file: `YYYYMMDD_rollback_description.sql`
3. Execute the rollback in Supabase SQL editor
4. Verify data integrity

### Emergency Overrides
Use the Admin Override page (`/admin/override`) to:
- Enable maintenance mode
- Override rate limits if needed
- Disable problematic feature flags

## Versioning

OptiSched follows semantic versioning:
- **MAJOR**: Breaking changes
- **MINOR**: New features, backwards compatible
- **PATCH**: Bug fixes, minor improvements

Example: `v1.2.3` → `v1.3.0` (new features), `v1.2.4` (bug fix)

## Communication

After release:
1. Update internal stakeholders
2. Notify users of new features via Announcements page
3. Document any breaking changes
4. Update support documentation if needed
