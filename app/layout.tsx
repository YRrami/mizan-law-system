import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "مؤسسة ياسر الرفاعي للمحاماة",
  description: "نظام إدارة العمل القانوني",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
