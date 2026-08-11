import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @napi-rs/canvas trae un binario nativo (.node); pdfjs-dist lo usa para
  // renderizar PDFs a imagen (lectura de QR + fallback de Claude en la
  // importación de CPE). Sin esto, el bundler de Server Components intenta
  // empaquetarlo como si fuera JS puro y falla.
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  experimental: {
    // Server Actions limitan el body a 1MB por defecto. Un PDF de CPE
    // escaneado (en vez de generado digitalmente) puede superar eso.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
