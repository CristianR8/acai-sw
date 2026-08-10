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
    "Next.js admin dashboard toolkit with 200+ templates, UI components, and integrations for fast dashboard development.",
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
