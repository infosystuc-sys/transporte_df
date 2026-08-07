import { extractText, getDocumentProxy } from "unpdf";

/** Extrae el texto plano de la primera página del PDF. "" si falla o no hay capa de texto. */
export async function extraerTextoCpe(buffer: Buffer): Promise<string> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch {
    return "";
  }
}
