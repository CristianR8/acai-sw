import "@/css/satoshi.css";
import "@/css/style.css";

import "flatpickr/dist/flatpickr.min.css";
import "jsvectormap/dist/jsvectormap.css";

import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
import type { PropsWithChildren } from "react";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    template: "%s |  ACAI PARK SOFTWARE",
    default: "ACAI PARK SOFTWARE",
  },
  description:
    "Sistema de administración y punto de venta de Açaí Park.",
  openGraph: {
    title: "AÇAÍ PARK SOFTWARE",
    description: "Sistema de administración y punto de venta de Açaí Park.",
    images: [{ url: "/images/logo/LogoAP.jpg", width: 1200, height: 1200, alt: "Açaí Park" }],
  },
  twitter: {
    card: "summary",
    title: "AÇAÍ PARK SOFTWARE",
    description: "Sistema de administración y punto de venta de Açaí Park.",
    images: ["/images/logo/LogoAP.jpg"],
  },
  icons: {
    icon: "/images/logo/LogoAP.jpg",
    shortcut: "/images/logo/LogoAP.jpg",
    apple: "/images/logo/LogoAP.jpg",
  },
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <NextTopLoader color="text-primary" showSpinner={false} />
          {children}
        </Providers>
      </body>
    </html>
  );
}
