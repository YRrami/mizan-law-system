# Mizan Unified Palette + Better Calendar

## Updated

- `app/calendar/page.tsx`
- `app/globals.css`
- `components/AppShell.tsx`
- `components/AuthShell.tsx`
- `components/ui/PageHeader.tsx`
- `components/ui/Badge.tsx`
- `components/ui/StatCard.tsx`
- `components/ui/Field.tsx`
- `components/ui/SelectField.tsx`
- `components/ui/TextareaField.tsx`
- `components/ui/LoadingCard.tsx`
- `components/ui/EmptyState.tsx`

## Added

- `lib/theme.ts`

## Palette

The whole UI is now based on one restrained palette:

- Midnight slate
- Soft white surfaces
- Indigo accent
- Zinc/slate neutral borders
- Limited warning/danger colors only where needed

## Calendar improvements

- Cleaner full-width month calendar.
- No To-Do column.
- Better selected-day interaction.
- Better event colors.
- Better stats area.
- Unified colors with the rest of the app.

## No SQL changes required.

After replacing files:

```powershell
Remove-Item -Recurse -Force .next
npm run build
npm run dev
```
