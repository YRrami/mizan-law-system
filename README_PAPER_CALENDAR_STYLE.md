# Paper Planner Calendar Style

## Updated file
- `app/calendar/page.tsx`

## What changed
- Calendar page now looks more like a traditional paper monthly planner.
- Large month title in English uppercase.
- Classic Sunday -> Saturday header row.
- Monthly day grid with hearing items inside each day.
- Right sidebar contains:
  - TO-DO & NOTES area
  - selected day summary
  - previous month mini calendar
  - next month mini calendar
- Detailed hearing cards remain below.

## No database changes required.

After replacing files:
```powershell
Remove-Item -Recurse -Force .next
npm run build
npm run dev
```
