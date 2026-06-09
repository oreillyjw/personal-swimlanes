import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "swimlanes — weekly project tracker",
  description: "Local-first weekly swim-lane roadmap sourced from GitLab & GitHub milestones",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
