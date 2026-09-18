import type { Operacion } from "./api";

/** 10/3 llega del servidor como 3.3333333333333335. Recortamos la basura de
 *  coma flotante sin arrastrar ceros: 2.5 sigue siendo "2.5". */
export function formatear(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(10)));
}

/** Los símbolos que ve el usuario no son los que entiende la API. */
export function simbolo(operacion: Operacion): string {
  switch (operacion) {
    case "+":
      return "+";
    case "-":
      return "−";
    case "*":
      return "×";
    case "/":
      return "÷";
  }
}

export function mensajeDeError(err: unknown): string {
  // fetch lanza TypeError cuando ni siquiera logra conectar.
  if (err instanceof TypeError) return "sin conexión con el servidor Go";
  return err instanceof Error ? err.message : "error desconocido";
}
