# Reduced Colors Version

## What changed

The whole site color palette is now even more minimal:

- White
- Off-white
- Slate / gray
- Black
- Red only for errors/destructive actions

Most blue/indigo/violet/teal/amber usage has been converted to neutral slate tones.

## Updated key files

- `app/globals.css`
- `lib/theme.ts`
- `components/ui/PageHeader.tsx`
- `components/ui/Badge.tsx`
- `components/ui/StatCard.tsx`
- `components/AppShell.tsx`
- `components/AuthShell.tsx`
- `app/calendar/page.tsx`

## No SQL changes required

After replacing files:

```powershell
Remove-Item -Recurse -Force .next
npm run build
npm run dev
```
