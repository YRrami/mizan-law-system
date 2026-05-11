# Mizan Enhanced System — Roles + Tasks

This ZIP contains all project files with the same existing paths and names, plus the new Tasks page.

## What changed

- Added `app/tasks/page.tsx`.
- Updated `app/dashboard/page.tsx` so regular users no longer trigger payments/RLS errors.
- Updated `lib/types.ts` and `lib/labels.ts` with task types/labels.
- Updated `supabase/2026_05_04_roles_permissions_SAFE_V2.sql` to create and protect the `tasks` table.
- Kept `components/AppShell.tsx` with Tasks link and admin-only Payments/Admin Users links.

## Tasks permissions

- Admin sees all tasks.
- Admin can assign tasks to regular users from a dropdown list loaded from registered profiles.
- Assigned regular user sees only their own tasks.
- Assigned regular user can update task status and completion notes only.
- Admin can edit/delete tasks.

## Install

1. Backup your project.
2. Copy all files from this ZIP into your project, preserving paths.
3. Run this SQL in Supabase:
   `supabase/2026_05_04_roles_permissions_SAFE_V2.sql`
4. Make yourself admin:

```sql
update public.profiles
set role = 'admin'
where email = 'YOUR_EMAIL_HERE';
```

5. Run:

```powershell
npm install exceljs
Remove-Item -Recurse -Force .next
npm run build
npm run dev
```

## Notes

Do not put real Supabase keys in the ZIP. Keep your keys in `.env.local` locally and Vercel Environment Variables in production.
