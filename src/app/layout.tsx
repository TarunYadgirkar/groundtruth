import type { Metadata } from "next";
import { Archivo, Atkinson_Hyperlegible, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const DESCRIPTION = "Which housing laws apply at this address, on any date. Cited to the source text. Not legal advice.";

export const metadata: Metadata = {
  metadataBase: new URL("https://groundtruth-rho.vercel.app"),
  title: "Groundtruth",
  description: DESCRIPTION,
  openGraph: { title: "Groundtruth", description: DESCRIPTION, type: "website", siteName: "Groundtruth" },
  twitter: { card: "summary_large_image", title: "Groundtruth", description: DESCRIPTION },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${atkinson.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
