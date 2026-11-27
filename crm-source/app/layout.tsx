import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Helz-One CRM",
  description: "Gestión privada de clientes, seguimiento y caja para Helz-One Personal Training.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
