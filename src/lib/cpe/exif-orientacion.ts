/**
 * Las fotos que salen de un celular casi siempre se guardan en la
 * orientación "natural" del sensor (apaisada) más una etiqueta EXIF que
 * dice cómo rotarla para verse bien — la mayoría de los visores respetan
 * esa etiqueta, pero @napi-rs/canvas (como casi cualquier librería que
 * trabaja con los píxeles crudos) no lo hace: decodifica tal cual viene el
 * sensor. El resultado es que una CPE fotografiada en vertical le llega a
 * Claude de costado, y ahí no hay IA que la lea. Esto lee esa etiqueta a
 * mano (nadie la expone en @napi-rs/canvas) para poder corregirla antes de
 * mandar la imagen.
 */

/** Valor EXIF Orientation (tag 0x0112), 1 si no se encuentra o no es JPEG. */
export function leerOrientacionExif(buffer: Buffer): number {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return 1;

  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marcador = buffer[offset + 1];

    // SOS: arranca el stream de la imagen, no hay más metadata después.
    if (marcador === 0xda) break;
    // Marcadores sin segmento de longitud (relleno, RST, SOI).
    if (marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd9)) {
      offset += 2;
      continue;
    }

    const largoSegmento = buffer.readUInt16BE(offset + 2);

    if (marcador === 0xe1) {
      const inicioSegmento = offset + 4;
      if (buffer.toString("ascii", inicioSegmento, inicioSegmento + 4) === "Exif") {
        const orientacion = leerOrientacionDesdeTiff(buffer, inicioSegmento + 6);
        if (orientacion != null) return orientacion;
      }
    }

    offset += 2 + largoSegmento;
  }
  return 1;
}

function leerOrientacionDesdeTiff(buffer: Buffer, inicioTiff: number): number | null {
  if (inicioTiff + 8 > buffer.length) return null;
  const little = buffer.toString("ascii", inicioTiff, inicioTiff + 2) === "II";
  const leerU16 = (o: number) => (little ? buffer.readUInt16LE(o) : buffer.readUInt16BE(o));
  const leerU32 = (o: number) => (little ? buffer.readUInt32LE(o) : buffer.readUInt32BE(o));

  const offsetIfd0 = leerU32(inicioTiff + 4);
  const inicioIfd0 = inicioTiff + offsetIfd0;
  if (inicioIfd0 + 2 > buffer.length) return null;

  const cantidadEntradas = leerU16(inicioIfd0);
  for (let i = 0; i < cantidadEntradas; i++) {
    const inicioEntrada = inicioIfd0 + 2 + i * 12;
    if (inicioEntrada + 12 > buffer.length) break;
    const tag = leerU16(inicioEntrada);
    if (tag === 0x0112) {
      return leerU16(inicioEntrada + 8);
    }
  }
  return null;
}

/** true para las 4 orientaciones que rotan 90°/270° (ancho y alto se invierten). */
export function orientacionRotada(orientacion: number): boolean {
  return orientacion >= 5 && orientacion <= 8;
}

/**
 * Aplica al contexto la transformación que corresponde para que, dibujando
 * la imagen sin más en (0,0), quede orientada como corresponde. `ancho` y
 * `alto` son las dimensiones NATURALES de la imagen decodificada (antes de
 * corregir), tal como las reporta loadImage.
 */
export function aplicarTransformExif(
  contexto: { transform: (a: number, b: number, c: number, d: number, e: number, f: number) => void },
  orientacion: number,
  ancho: number,
  alto: number
) {
  switch (orientacion) {
    case 2:
      contexto.transform(-1, 0, 0, 1, ancho, 0);
      break;
    case 3:
      contexto.transform(-1, 0, 0, -1, ancho, alto);
      break;
    case 4:
      contexto.transform(1, 0, 0, -1, 0, alto);
      break;
    case 5:
      contexto.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      contexto.transform(0, 1, -1, 0, alto, 0);
      break;
    case 7:
      contexto.transform(0, -1, -1, 0, alto, ancho);
      break;
    case 8:
      contexto.transform(0, -1, 1, 0, 0, ancho);
      break;
    default:
      break; // 1: normal, sin transformar.
  }
}
