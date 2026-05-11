# Logo + 4 Second Loading Screen Update

## What changed

- Logo size is slightly bigger across:
  - `components/AppShell.tsx`
  - `components/AuthShell.tsx`
  - `components/LogoMark.tsx`

- Added:
  - `components/LoadingGate.tsx`

- Updated:
  - `app/loading.tsx`
  - `app/layout.tsx`

## Important

Next.js serves static images from the `public` folder.

Make sure your logo is here:

```txt
public/logo.png
```

If your logo is currently in the project root as:

```txt
logo.png
```

move/copy it into:

```txt
public/logo.png
```

## Loading duration

`LoadingGate` shows a full-screen organized loading overlay for 4 seconds on app load.

Then it fades out smoothly.

## After replacing files

Run:

```powershell
Remove-Item -Recurse -Force .next
npm run build
npm run dev
```
