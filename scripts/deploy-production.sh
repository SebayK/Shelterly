#!/bin/bash
# Deploy migrations to Supabase production (with RLS enabled)
# Usage: ./deploy-production.sh

set -e

echo "🚀 Deploying to Supabase Production"
echo "======================================"
echo ""

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

read -p "Continue with deployment? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
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
echo "📤 Deploying to production..."
echo ""

# Push to production (will prompt for confirmation)
supabase db push

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
