import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nitro Rush — Car & Bike Racing",
  description: "Race a friend live or run a solo time trial. Dodge cones, switch lanes, and fire your nitro.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="antialiased">{children}</body></html>;
}
