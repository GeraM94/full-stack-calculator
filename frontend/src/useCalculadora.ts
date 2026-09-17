import { useEffect, useReducer } from "react";
import { calcular } from "./api";
import type { Operacion, PeticionCalculo } from "./api";

// -----------------------------------------------------------------------------
// Estado
// -----------------------------------------------------------------------------

interface Estado {
  /** Lo que se está tecleando ahora mismo, como texto ("12.5", "-3"). */
  entrada: string;
  /** Resultado parcial acumulado, o null si aún no hay ninguno. */
  acumulador: number | null;
  /** Operación esperando al segundo operando. */
  operacion: Operacion | null;
  /** El siguiente dígito empieza un número nuevo en vez de añadirse. */
  reiniciar: boolean;

  /** Petición que hay que enviarle a Go, o null si no hay ninguna en vuelo.
   *  Sustituye al antiguo estado `cargando`: una sola fuente de verdad. */
  peticion: PeticionCalculo | null;
  /** Operador que quedará activo cuando llegue la respuesta. Al pulsar "×" hay
   *  que resolver lo anterior Y recordar el "×". null significa que fue "=". */
  operacionSiguiente: Operacion | null;
  error: string | null;
}

const INICIAL: Estado = {
  entrada: "0",
  acumulador: null,
  operacion: null,
  reiniciar: false,
  peticion: null,
  operacionSiguiente: null,
  error: null,
};

const MAX_DIGITOS = 15;

// -----------------------------------------------------------------------------
// Acciones
// -----------------------------------------------------------------------------

/** Unión discriminada: TypeScript sabe que `accion.digito` solo existe en la
 *  rama "digito". Fuera de ella, leerlo es error de compilación. */
type Accion =
  | { tipo: "digito"; digito: string }
  | { tipo: "operacion"; operacion: Operacion }
  | { tipo: "igual" }
  | { tipo: "borrar" }
  | { tipo: "signo" }
  | { tipo: "limpiar" }
  | { tipo: "respuesta"; valor: number }
  | { tipo: "fallo"; mensaje: string };

// -----------------------------------------------------------------------------
// Reducer: función pura. Nada de fetch aquí dentro.
// -----------------------------------------------------------------------------

function reducir(estado: Estado, accion: Accion): Estado {
  // Guard central contra peticiones solapadas. React llama a esta función con
  // el estado MÁS RECIENTE, así que a diferencia de un `if (cargando) return`
  // dentro de un handler, esto no se puede esquivar con un closure viejo ni
  // saltándose los botones deshabilitados (p. ej. desde el teclado físico).
  if (
    estado.peticion !== null &&
    accion.tipo !== "respuesta" &&
    accion.tipo !== "fallo" &&
    accion.tipo !== "limpiar"
  ) {
    return estado;
  }

  switch (accion.tipo) {
    case "digito": {
      let base = estado.reiniciar ? "" : estado.entrada;
      if (base === "0" && accion.digito !== ".") base = "";
      if (accion.digito === "." && base.includes(".")) return estado;

      const entrada = accion.digito === "." && base === "" ? "0." : base + accion.digito;
      if (entrada.replace(/[-.]/g, "").length > MAX_DIGITOS) return estado;

      return { ...estado, entrada, reiniciar: false, error: null };
    }

    case "operacion": {
      // Cambiar de operador sin haber tecleado nada nuevo: solo se sustituye.
      if (estado.reiniciar && estado.acumulador !== null) {
        return { ...estado, operacion: accion.operacion, error: null };
      }
      // Primer operando: todavía no hay nada que resolver.
      if (estado.acumulador === null || estado.operacion === null) {
        return {
          ...estado,
          acumulador: Number(estado.entrada),
          operacion: accion.operacion,
          reiniciar: true,
          error: null,
        };
      }
      // Hay operación pendiente: se DESCRIBE la petición y se sale.
      // Quien la ejecuta es el efecto, no el reducer.
      return {
        ...estado,
        error: null,
        peticion: { a: estado.acumulador, b: Number(estado.entrada), operacion: estado.operacion },
        operacionSiguiente: accion.operacion,
      };
    }

    case "igual": {
      if (estado.acumulador === null || estado.operacion === null) return estado;
      return {
        ...estado,
        error: null,
        peticion: { a: estado.acumulador, b: Number(estado.entrada), operacion: estado.operacion },
        operacionSiguiente: null,
      };
    }

    case "respuesta":
      return {
        ...estado,
        entrada: formatear(accion.valor),
        acumulador: accion.valor,
        operacion: estado.operacionSiguiente, // null si la acción venía de "="
        operacionSiguiente: null,
        peticion: null,
        reiniciar: true,
        error: null,
      };

    case "fallo":
      // El acumulador y la operación se conservan: pulsar "=" reintenta.
      return { ...estado, peticion: null, operacionSiguiente: null, error: accion.mensaje };

    case "borrar": {
      if (estado.reiniciar) return { ...estado, entrada: "0", reiniciar: false, error: null };
      const entrada = estado.entrada.slice(0, -1);
      return {
        ...estado,
        entrada: entrada === "" || entrada === "-" ? "0" : entrada,
        error: null,
      };
    }

    case "signo": {
      if (estado.entrada === "0") return estado;
      const entrada = estado.entrada.startsWith("-")
        ? estado.entrada.slice(1)
        : "-" + estado.entrada;
      return { ...estado, entrada, error: null };
    }

    case "limpiar":
      return INICIAL;
  }
  // Sin `default`: el switch cubre toda la unión. Si mañana añades una acción
  // y olvidas su case, TypeScript marca error aquí porque la función dejaría
  // de devolver siempre un Estado.
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useCalculadora() {
  const [estado, dispatch] = useReducer(reducir, INICIAL);

  // Único punto de todo el hook que habla con Go. Se dispara cuando el reducer
  // deja una petición en el estado, y devuelve el resultado como otra acción.
  useEffect(() => {
    const peticion = estado.peticion;
    if (peticion === null) return;

    const abortador = new AbortController();

    calcular(peticion, abortador.signal)
      .then((valor) => dispatch({ tipo: "respuesta", valor }))
      .catch((err: unknown) => {
        // En desarrollo <StrictMode> monta cada efecto dos veces a propósito.
        // Sin este abort verías dos peticiones a Go por cada "=".
        if (err instanceof Error && err.name === "AbortError") return;
        dispatch({ tipo: "fallo", mensaje: mensajeDeError(err) });
      });

    return () => abortador.abort();
  }, [estado.peticion]);

  /** Línea superior de la pantalla: "12 ×" mientras esperas el segundo operando. */
  const expresion =
    estado.acumulador !== null && estado.operacion !== null
      ? `${formatear(estado.acumulador)} ${simbolo(estado.operacion)}`
      : "";

  return {
    pantalla: estado.entrada,
    expresion,
    operacionActiva: estado.operacion,
    error: estado.error,
    cargando: estado.peticion !== null,
    /** dispatch tiene identidad estable: React garantiza que es la misma
     *  referencia en todos los renders. Por eso puede ir en un array de
     *  dependencias sin provocar re-suscripciones. */
    dispatch,
  };
}

// -----------------------------------------------------------------------------
// Utilidades
// -----------------------------------------------------------------------------

/** 10/3 llega del servidor como 3.3333333333333335. Recortamos la basura de
 *  coma flotante sin arrastrar ceros: 2.5 sigue siendo "2.5". */
export function formatear(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(10)));
}

function mensajeDeError(err: unknown): string {
  // fetch lanza TypeError cuando ni siquiera logra conectar.
  if (err instanceof TypeError) return "sin conexión con el servidor Go";
  return err instanceof Error ? err.message : "error desconocido";
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
