import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Posture Pet",
  description: "A quiet companion for your time at the desk.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
