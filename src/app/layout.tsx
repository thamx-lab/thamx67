import type { Metadata } from "next";
import "./globals.css";
import AuthButton from "@/components/AuthButton";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Label Cropper Tool",
  description: "Extract shipping labels and sort by SKU",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthButton />
        {children}
      </body>
    </html>
  );
}
