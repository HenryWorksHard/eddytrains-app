# Unified Portal Migration

## Overview

This branch (`feature/unified-portal`) merges the admin portal (eddytrains-admin) into the client app (eddytrains-app), creating a single unified application with role-based permissions.

## What Changed

### Directory Structure
- Migrated from `app/` to `src/app/` structure
- Added `src/components/` for shared admin components
- Added `src/hooks/` for shared hooks
- Added `src/data/` for static data files

### Role-Based Architecture

After login, users are routed based on their `profiles.role` value:

| Role | Access | Experience |
|------|--------|------------|
| `super_admin` | Full platform control | Desktop with Sidebar, `/platform` routes |
| `company_admin` | Organization management | Desktop with Sidebar |
| `trainer` | Client management | Desktop with Sidebar |
| `client` | Personal workouts only | Mobile with BottomNav |

### Key Files

#### Middleware (`src/middleware.ts`)
- Unified authentication
- Role-based route protection
- Trial/subscription status checks
- Password change enforcement

#### Dashboard (`src/app/dashboard/`)
- `page.tsx` - Role-aware router
- `AdminDashboard.tsx` - Trainer/admin view with stats
- `ClientDashboard.tsx` - Client view with workouts

#### Programs (`src/app/programs/`)
- `page.tsx` - Role-aware router
- `AdminPrograms.tsx` - Program management for trainers
- `ClientPrograms.tsx` - Assigned programs for clients

### New Admin Routes

- `/users` - Client management
- `/users/new` - Add new client
- `/users/[id]` - Client detail/coaching
- `/programs/new` - Create program
- `/billing` - Subscription management
- `/organisation` - Organization settings
- `/platform` - Super admin dashboard (Louis only)
- `/alerts` - Client activity notifications
- `/schedules` - Schedule management
- `/settings` - Account settings

### New API Routes

- `/api/users/*` - User CRUD operations
- `/api/stripe/*` - Subscription/payment handling
- `/api/organizations` - Multi-tenant support
- `/api/impersonate` - Super admin impersonation
- `/api/platform-activity` - Platform analytics
- `/api/trainers/*` - Trainer management

### Dependencies Added

```json
{
  "@dnd-kit/core": "^6.3.1",
  "@dnd-kit/sortable": "^10.0.0",
  "@dnd-kit/utilities": "^3.2.2",
  "@stripe/react-stripe-js": "^5.6.0",
  "@stripe/stripe-js": "^8.7.0",
  "jspdf": "^4.1.0",
  "jspdf-autotable": "^5.0.7",
  "recharts": "^3.7.0",
  "stripe": "^20.3.0"
}
```

### Environment Variables Required

```env
# Existing
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

# Added for admin features
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
KLAVIYO_API_KEY
KLAVIYO_LIST_ID
KLAVIYO_INACTIVE_LIST_ID
```

## How to Test

1. **Install dependencies:**
   ```bash
   cd eddytrains-app
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Test different roles:**
   - Login as a client → Should see mobile dashboard with workouts
   - Login as a trainer → Should see admin dashboard with sidebar
   - Login as super_admin → Should see platform dashboard

4. **Test key flows:**
   - Client: View dashboard → Start workout → Complete workout
   - Trainer: View clients → Create program → Assign to client
   - Admin: Manage organization → View billing

## What Still Works

- All existing client functionality (workouts, progress, nutrition)
- PWA capabilities
- Mobile-optimized client experience
- All existing API routes

## What Needs Review Before Deploy

1. **Vercel Environment Variables** - Need to add the new env vars from admin
2. **Stripe Webhook** - May need to update webhook endpoint
3. **Domain/URL Config** - `NEXT_PUBLIC_APP_URL` should point to correct domain
4. **RLS Policies** - Verify all database policies work with unified app
5. **Test Edge Cases:**
   - User with no organization
   - Expired trial flow
   - Password reset flow

## Rollback Plan

If issues arise, the original apps are still intact:
- Client app: main branch of eddytrains-app
- Admin app: eddytrains-admin repo (unchanged)

## Files Not Migrated

Some admin features were intentionally not migrated yet:
- `/nutrition/[id]` - Individual nutrition plan editing
- Complex coaching flows that need more testing

## Notes for Louis

- The admin repo (eddytrains-admin) was NOT deleted
- Production deployment should wait until full testing
- Consider testing with a preview deployment first
