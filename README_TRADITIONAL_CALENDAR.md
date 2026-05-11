# Traditional Calendar Style Update

## Updated

- `app/calendar/page.tsx`

## What changed

The calendar page now uses a more traditional monthly calendar layout:

- Saturday to Friday week layout.
- Large month grid.
- Day cells with hearings inside each day.
- Clear month navigation:
  - previous month
  - today
  - next month
- Selected day details panel.
- Agenda view still available.
- Upcoming hearings only.
- Search and filters kept.

## No database changes required.

After replacing files:

```powershell
Remove-Item -Recurse -Force .next
npm run build
npm run dev
```
