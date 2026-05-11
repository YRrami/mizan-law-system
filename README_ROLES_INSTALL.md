# Mizan Roles Update — Safe Install

## What changed

This package keeps your existing file names and adds the new roles system files.

### Admin can:
- See/add/edit/delete everything.
- See payments/fees.
- Manage users from `/admin/users`.

### Regular user can:
- Add/view own clients, cases, hearings, and documents.
- Cannot access `/payments`.
- Cannot edit/delete records at database level.
- Payment/fee links are hidden from the app shell.

---

## Required SQL

Run this file in Supabase SQL Editor:

```txt
supabase/2026_05_04_roles_permissions_SAFE_V2.sql
```

Then make yourself admin:

```sql
update public.profiles
set role = 'admin'
where email = 'YOUR_EMAIL_HERE';
```

---

## Environment variables

I did not include your real Supabase keys in the output for safety.
Use these values locally and in Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Important: the Supabase URL must NOT end with `/rest/v1`.

---

## Payments page

`app/payments/page.tsx` is now protected by:

```tsx
<RequireRole allowedRoles={["admin"]}>
```

Regular users who open `/payments` manually will be redirected to `/unauthorized`.

---

## AppShell

`components/AppShell.tsx` now hides:
- Payments link from regular users.
- Admin users link from regular users.

---

## Test

```powershell
npm install exceljs
Remove-Item -Recurse -Force .next
npm run build
npm run dev
```

If `.next` does not exist:

```powershell
npm run build
npm run dev
```

## Added in enhanced tasks update

- `app/tasks/page.tsx` was added.
- `supabase/2026_05_04_roles_permissions_SAFE_V2.sql` now also creates the `tasks` table and RLS policies.
- Run the SQL again even if you ran the previous roles SQL before.
- Admins can assign tasks by user email.
- Regular users only see tasks assigned to their own account.
