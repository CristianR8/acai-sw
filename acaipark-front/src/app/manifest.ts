import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Acai Park - Tarjeta de fidelización",
    short_name: "Acai Park",
    description: "Tarjeta digital de fidelización de Acai Park.",
    start_url: "/loyalty/card",
    display: "standalone",
    background_color: "#0c2823",
    theme_color: "#146b5c",
    icons: [
      {
        src: "/images/logo/LogoAP.jpg",
        sizes: "150x150",
        type: "image/jpeg",
      },
    ],
  };
}
