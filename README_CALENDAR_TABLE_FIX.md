Calendar fixed again:
- Rebuilt app/calendar/page.tsx from scratch
- Uses a real HTML table instead of a complex grid
- Horizontal monthly layout
- Simple notes sidebar
- Much simpler and less likely to break

After replacing files:
Remove-Item -Recurse -Force .next
npm run build
npm run dev
