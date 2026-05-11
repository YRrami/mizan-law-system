# Logo update

تم تحديث النظام لاستخدام اللوجو بدل حرف "ي" في:

- `components/AppShell.tsx`
- `components/AuthShell.tsx`
- `app/loading.tsx`
- `app/layout.tsx` كـ favicon/icon

## مهم جدًا

ضع ملف اللوجو داخل مجلد `public` بهذا الاسم بالضبط:

```txt
public/logo.png
```

في Next.js أي ملف داخل `public` يظهر من جذر الموقع، لذلك الكود يستخدم:

```txt
/logo.png
```

لو اللوجو عندك حاليًا في Root المشروع باسم `logo.png`، انقله أو انسخه إلى:

```txt
public/logo.png
```
