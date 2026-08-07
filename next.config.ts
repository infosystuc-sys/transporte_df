import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @napi-rs/canvas trae un binario nativo (.node); pdfjs-dist lo usa para
  // renderizar PDFs a imagen (lectura de QR + fallback de Claude en la
  // importación de CPE). Sin esto, el bundler de Server Components intenta
  // empaquetarlo como si fuera JS puro y falla.
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
};

export default nextConfig;
