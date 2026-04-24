import type { Metadata } from "next";
import { Epilogue, Manrope, Cormorant_Garamond, Space_Mono, Bebas_Neue, Playfair_Display, Dancing_Script } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const epilogue = Epilogue({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-booking-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-booking-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const bebasNeue = Bebas_Neue({
  variable: "--font-booking-display",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-booking-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const dancingScript = Dancing_Script({
  variable: "--font-booking-script",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FlashBooker",
  description: "A booking management app designed for tattoo artists for faster, simpler appointments",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const accentTheme = cookieStore.get("accent_theme")?.value ?? "crimson";

  return (
    <html lang="en" data-theme={accentTheme} className={`${epilogue.variable} ${manrope.variable} ${cormorant.variable} ${spaceMono.variable} ${bebasNeue.variable} ${playfair.variable} ${dancingScript.variable} antialiased`}>
      <body className="min-h-screen flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
