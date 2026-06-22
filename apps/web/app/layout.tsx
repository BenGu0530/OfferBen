import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OfferBen — AI Resume Copilot",
  description:
    "Turn one profile into a tailored resume, cover letter, recruiter email, and referral note for any job.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-bg min-h-screen">{children}</div>
      </body>
    </html>
  );
}
