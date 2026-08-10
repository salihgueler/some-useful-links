import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "@/styles/globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://someusefullinks.com"),
  title: {
    default: "Some Useful Links",
    template: "%s · Some Useful Links",
  },
  description: "A tiny corner of the internet filled with good finds.",
  openGraph: {
    title: "Some Useful Links",
    description: "Good finds, one useful page.",
    url: "https://someusefullinks.com",
    siteName: "Some Useful Links",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Some Useful Links",
    description: "Good finds, one useful page.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
