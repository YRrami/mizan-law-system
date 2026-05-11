# Calendar Page + Remove Loading Screen

## Added

- `app/calendar/page.tsx`
- Sidebar link: `التقويم`

## Calendar features

- Shows upcoming hearings only.
- Month calendar view.
- List view.
- Search by case, client, court, circuit, required action.
- Filters:
  - all upcoming hearings
  - today
  - next 7 days
  - current month
- Selected day panel.
- Links to:
  - hearings page
  - cases page
  - client file

## Removed loading screen

Updated:

- `app/layout.tsx`
- `app/loading.tsx`

The 4-second `LoadingGate` is no longer used.

## After replacing files

Run:

```powershell
Remove-Item -Recurse -Force .next
npm run build
npm run dev
```

No new database update is required.
