import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Poker ♠️ Night",
  description: "מערכת חכמה לניהול שולחן פוקר",
  icons: {
    // קישור ישיר לאייקון של צ'יפים של פוקר - יופיע אוטומטית בלשונית של הדפדפן
    icon: "https://cdn-icons-png.flaticon.com/512/1368/1368087.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}