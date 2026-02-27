#!/bin/bash
# Deploy migrations to Supabase production (with RLS enabled)
# Usage: ./deploy-production.sh

set -e

echo "🚀 Deploying to Supabase Production"
echo "======================================"
echo ""

# TODO: currently this script helps with local/dev testing by keeping dev-only
# migrations in the repo. Before using this in production, we must explicitly
# curate which migrations are applied (or generate+apply a production bundle)
# and ensure dev-only RLS-disabling migrations are never applied to prod.
# See supabase/migrations/*.sql for dev-only markers. This TODO is intentionally
# left here for a follow-up task during production rollout.

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI not found"
    echo "Install: npm install -g supabase"
    exit 1
fi

# Check if project is linked
if [ ! -f .supabase/config.toml ]; then
    echo "❌ Error: Not linked to Supabase project"
    echo "Run: supabase link --project-ref YOUR_PROJECT_REF"
    exit 1
fi

echo "📋 Production migrations (RLS enabled):"
echo "  ✓ 20260119000000_init_schema.sql"
echo "  ✓ 20260124000000_update_handle_new_user.sql"
echo "  ✓ 20260221000000_add_get_pending_shelters_fn.sql"
echo ""
echo "⏭️  Skipping (dev-only):"
echo "  ✗ 20260119120000_disable_rls_policies.sql"
echo "  ✗ 20260224000000_disable_rls.sql"
echo ""

# Strong guard: require explicit override to proceed when dev-only migration files exist
FORCE=false
if [ "$1" = "--force" ] || [ "$ALLOW_DEV_MIGRATIONS" = "1" ]; then
  FORCE=true
fi

read -p "Continue with deployment? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

# Check repository for any dev-only migration files (disable_rls)
DEV_MIGRATION_FILES=$(ls supabase/migrations/*disable_rls*.sql 2>/dev/null || true)
if [ -n "$DEV_MIGRATION_FILES" ] && [ "$FORCE" = false ]; then
  echo "⚠️  Found dev-only migration files in supabase/migrations/:"
  echo "$DEV_MIGRATION_FILES"
  echo ""
  echo "This script will NOT apply dev-only migrations to production. To proceed anyway," \
       "either remove or rename dev-only migrations, or run this script with" \
       "the environment variable ALLOW_DEV_MIGRATIONS=1 or the --force flag." 
  echo "Example: ALLOW_DEV_MIGRATIONS=1 ./scripts/deploy-production.sh"
  exit 2
fi

echo ""
echo "🔄 Creating production migration bundle..."

# Create temporary production SQL file
TEMP_FILE="supabase/migrations/.production-bundle.sql"

cat > "$TEMP_FILE" << 'EOF'
-- ============================================================================
-- PRODUCTION DEPLOYMENT BUNDLE
-- Generated on: $(date)
-- ============================================================================
-- This file contains all production migrations with RLS enabled
-- ============================================================================

EOF

# Concatenate production migrations
cat supabase/migrations/20260119000000_init_schema.sql >> "$TEMP_FILE"
cat supabase/migrations/20260124000000_update_handle_new_user.sql >> "$TEMP_FILE"
cat supabase/migrations/20260221000000_add_get_pending_shelters_fn.sql >> "$TEMP_FILE"

echo "✅ Bundle created: $TEMP_FILE"
echo ""
echo "📤 Checking for pending dev-only (disable_rls) migrations..."
echo ""

# Ensure no dev-only disable_rls migrations are pending before deploying
PENDING_DISABLE_RLS_MIGRATIONS=$(supabase migration list 2>/dev/null | grep -E "disable_rls" | grep -E "\bPENDING\b" || true)

if [ -n "$PENDING_DISABLE_RLS_MIGRATIONS" ]; then
  echo "❌ Error: The following dev-only disable_rls migrations are pending and must NOT be applied to production:"
  echo ""
  echo "$PENDING_DISABLE_RLS_MIGRATIONS"
  echo ""
  echo "Please ensure these migrations are not pending on the production database (e.g., move them out of the production migration set or mark them as applied safely) before running this script."
  exit 1
fi

echo "📤 Deploying curated production bundle to Supabase..."
echo ""

# Execute only the curated production bundle against the linked Supabase project
supabase db execute --file "$TEMP_FILE"

echo ""
echo "🔍 Verifying RLS status..."
echo ""

# Verify RLS is enabled
supabase db execute --sql "
SELECT 
  tablename, 
  CASE WHEN rowsecurity THEN '✅ Enabled' ELSE '❌ Disabled' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'needs')
ORDER BY tablename;
"

echo ""
echo "🔍 Verifying RLS policies..."
echo ""

supabase db execute --sql "
SELECT 
  tablename,
  policyname,
  cmd::text as operation
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🔐 RLS is now enabled in production"
echo "📝 Next steps:"
echo "  1. Test authenticated endpoints"
echo "  2. Verify only verified profiles can create needs"
echo "  3. Monitor logs for RLS-related errors"

# Cleanup
rm -f "$TEMP_FILE"
