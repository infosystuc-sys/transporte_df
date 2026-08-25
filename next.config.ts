import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @napi-rs/canvas trae un binario nativo (.node); pdfjs-dist lo usa para
  // renderizar PDFs a imagen (lectura de QR + fallback de Claude en la
  // importación de CPE). heic-convert (fotos HEIC de iPhone) carga
  // libheif-js, que es un binario WASM. Sin esto, el bundler de Server
  // Components intenta empaquetarlos como si fueran JS puro: en local
  // `next build` no se nota, pero en el serverless de Vercel la función
  // rompe al primer uso con un 500 sin más detalle.
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist", "heic-convert", "heic-decode", "libheif-js"],
  experimental: {
    // Server Actions limitan el body a 1MB por defecto. Un PDF de CPE
    // escaneado (en vez de generado digitalmente) o una foto de celular
    // de alta resolución (los modos de 48-200MP superan fácil los
    // 10-15MB, sobre todo si el archivo es HEIC) pueden superar eso.
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
