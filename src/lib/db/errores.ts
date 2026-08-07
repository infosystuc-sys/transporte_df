function codigoError(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  // drizzle-orm envuelve el error real de postgres.js en `.cause`.
  if ("cause" in error) return codigoError((error as { cause: unknown }).cause);
  return undefined;
}

/** unique_violation de Postgres. */
export const esErrorDuplicado = (error: unknown) => codigoError(error) === "23505";

/** foreign_key_violation de Postgres (ej. intentar borrar algo referenciado). */
export const esErrorReferenciado = (error: unknown) => codigoError(error) === "23503";
