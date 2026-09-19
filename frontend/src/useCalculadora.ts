import { useCallback, useState } from "react";
import { calcular } from "./api";
import type { Operacion } from "./api";

/** Todo el estado de la máquina en un solo objeto, para que cada transición
 *  sea explícita y no queden combinaciones imposibles repartidas en 4 useState. */
interface Estado {
  /** Lo que se está tecleando ahora mismo, como texto ("12.5", "-3"). */
  entrada: string;
  /** Resultado parcial acumulado, o null si aún no hay ninguno. */
  acumulador: number | null;
  /** Operación esperando al segundo operando. */
  operacion: Operacion | null;
  /** El siguiente dígito empieza un número nuevo en vez de añadirse. */
  reiniciar: boolean;
}

const INICIAL: Estado = {
  entrada: "0",
  acumulador: null,
  operacion: null,
  reiniciar: false,
};

const MAX_DIGITOS = 15;

/** 10/3 llega del servidor como 3.3333333333333335. Recortamos la basura de
 *  coma flotante sin arrastrar ceros: 2.5 sigue siendo "2.5", no "2.5000000000". */
export function formatear(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(10)));
}

function mensajeDeError(err: unknown): string {
  // fetch lanza TypeError cuando ni siquiera logra conectar.
  if (err instanceof TypeError) return "sin conexión con el servidor Go";
  return err instanceof Error ? err.message : "error desconocido";
}

export function useCalculadora() {
  const [estado, setEstado] = useState<Estado>(INICIAL);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  /** Resuelve la operación pendiente llamando al backend.
   *  Si no hay ninguna, el valor actual ya es el resultado. */
  const resolver = useCallback(async (e: Estado): Promise<number> => {
    const actual = Number(e.entrada);
    if (e.acumulador === null || e.operacion === null) return actual;
    return calcular({ a: e.acumulador, b: actual, operacion: e.operacion });
  }, []);

  const pulsarDigito = useCallback((digito: string) => {
    setError(null);
    setEstado((e) => {
      let base = e.reiniciar ? "" : e.entrada;
      if (base === "0" && digito !== ".") base = "";
      if (digito === "." && base.includes(".")) return e;

      const entrada = digito === "." && base === "" ? "0." : base + digito;
      if (entrada.replace(/[-.]/g, "").length > MAX_DIGITOS) return e;

      return { ...e, entrada, reiniciar: false };
    });
  }, []);

  const pulsarOperacion = useCallback(
    async (operacion: Operacion) => {
      setError(null);

      // Cambiar de operador sin haber tecleado nada nuevo solo sustituye el
      // operador; no tiene sentido ir al servidor.
      if (estado.reiniciar && estado.acumulador !== null) {
        setEstado((e) => ({ ...e, operacion }));
        return;
      }

      setCargando(true);
      try {
        const valor = await resolver(estado);
        setEstado({
          entrada: formatear(valor),
          acumulador: valor,
          operacion,
          reiniciar: true,
        });
      } catch (err) {
        setError(mensajeDeError(err));
      } finally {
        setCargando(false);
      }
    },
    [estado, resolver],
  );

  const pulsarIgual = useCallback(async () => {
    if (estado.operacion === null || estado.acumulador === null) return;

    setError(null);
    setCargando(true);
    try {
      const valor = await resolver(estado);
      setEstado({
        entrada: formatear(valor),
        acumulador: null,
        operacion: null,
        reiniciar: true,
      });
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  }, [estado, resolver]);

  const limpiar = useCallback(() => {
    setError(null);
    setEstado(INICIAL);
  }, []);

  const borrar = useCallback(() => {
    setError(null);
    setEstado((e) => {
      if (e.reiniciar) return { ...e, entrada: "0", reiniciar: false };
      const entrada = e.entrada.slice(0, -1);
      return { ...e, entrada: entrada === "" || entrada === "-" ? "0" : entrada };
    });
  }, []);

  const cambiarSigno = useCallback(() => {
    setError(null);
    setEstado((e) => {
      if (e.entrada === "0") return e;
      const entrada = e.entrada.startsWith("-") ? e.entrada.slice(1) : "-" + e.entrada;
      return { ...e, entrada };
    });
  }, []);

  /** Línea superior de la pantalla: "12 ×" mientras esperas el segundo operando. */
  const expresion =
    estado.acumulador !== null && estado.operacion !== null
      ? `${formatear(estado.acumulador)} ${simbolo(estado.operacion)}`
      : "";

  return {
    pantalla: estado.entrada,
    expresion,
    operacionActiva: estado.operacion,
    error,
    cargando,
    pulsarDigito,
    pulsarOperacion,
    pulsarIgual,
    limpiar,
    borrar,
    cambiarSigno,
  };
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
  // Sin default: si mañana añades "^" a Operacion, TypeScript marca error aquí
  // porque la función dejaría de devolver siempre un string.
}
