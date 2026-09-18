import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { calcular } from "../api";
import type { Operacion } from "../api";
import { formatear, mensajeDeError } from "../formato";
import type { RootState } from "./store";

// -----------------------------------------------------------------------------
// Estado
// -----------------------------------------------------------------------------

interface EstadoCalculadora {
  entrada: string;
  acumulador: number | null;
  operacion: Operacion | null;
  reiniciar: boolean;
  /** Operador que quedará activo cuando llegue la respuesta. null = fue "=". */
  operacionSiguiente: Operacion | null;
  peticion: "inactivo" | "enviando";
  error: string | null;
}

const INICIAL: EstadoCalculadora = {
  entrada: "0",
  acumulador: null,
  operacion: null,
  reiniciar: false,
  operacionSiguiente: null,
  peticion: "inactivo",
  error: null,
};

const MAX_DIGITOS = 15;

// -----------------------------------------------------------------------------
// Thunk asíncrono
// -----------------------------------------------------------------------------

/**
 * Resuelve la operación pendiente. El argumento es el operador que quedará
 * activo después; null significa que se pulsó "=".
 *
 * RTK genera tres acciones a partir de esto:
 *   calculadora/resolver/pending · /fulfilled · /rejected
 */
export const resolver = createAsyncThunk<
  number, // lo que devuelve
  Operacion | null, // el argumento
  { state: RootState; rejectValue: string }
>(
  "calculadora/resolver",
  async (siguiente, { getState, rejectWithValue, signal }) => {
    // getState() lee la store AHORA mismo. No es un closure capturado en un
    // render, así que es imposible que esté desactualizado.
    const c = getState().calculadora;

    // Cambiar de operador sin haber tecleado nada nuevo: no hay que ir a Go,
    // el acumulador ya es el valor bueno.
    if (siguiente !== null && c.reiniciar && c.acumulador !== null) {
      return Number(c.entrada);
    }
    // Primer operando: tampoco hay nada que resolver todavía.
    if (c.acumulador === null || c.operacion === null) {
      return Number(c.entrada);
    }

    try {
      // signal lo provee RTK: si el thunk se aborta, se corta el fetch.
      return await calcular(
        { a: c.acumulador, b: Number(c.entrada), operacion: c.operacion },
        signal,
      );
    } catch (err) {
      return rejectWithValue(mensajeDeError(err));
    }
  },
  {
    // El guard contra peticiones solapadas, declarativo: si devuelve false el
    // thunk ni siquiera se despacha, no llega a emitir `pending`.
    condition: (siguiente, { getState }) => {
      const c = getState().calculadora;
      if (c.peticion !== "inactivo") return false;
      // "=" sin ninguna operación pendiente no hace nada.
      if (siguiente === null && c.operacion === null) return false;
      return true;
    },
  },
);

// -----------------------------------------------------------------------------
// Slice
// -----------------------------------------------------------------------------

const slice = createSlice({
  name: "calculadora",
  initialState: INICIAL,
  reducers: {
    digitoPulsado(estado, accion: PayloadAction<string>) {
      // Con createSlice el guard hay que repetirlo: no existe un punto único
      // de entrada como en el reducer escrito a mano.
      if (estado.peticion === "enviando") return;

      const digito = accion.payload;
      let base = estado.reiniciar ? "" : estado.entrada;
      if (base === "0" && digito !== ".") base = "";
      if (digito === "." && base.includes(".")) return;

      const entrada = digito === "." && base === "" ? "0." : base + digito;
      if (entrada.replace(/[-.]/g, "").length > MAX_DIGITOS) return;

      // Esto PARECE mutación, pero RTK usa Immer por debajo: escribes sobre un
      // borrador y él produce el objeto nuevo inmutable.
      estado.entrada = entrada;
      estado.reiniciar = false;
      estado.error = null;
    },

    borrado(estado) {
      if (estado.peticion === "enviando") return;

      if (estado.reiniciar) {
        estado.entrada = "0";
        estado.reiniciar = false;
      } else {
        const entrada = estado.entrada.slice(0, -1);
        estado.entrada = entrada === "" || entrada === "-" ? "0" : entrada;
      }
      estado.error = null;
    },

    signoCambiado(estado) {
      if (estado.peticion === "enviando") return;
      if (estado.entrada === "0") return;

      estado.entrada = estado.entrada.startsWith("-")
        ? estado.entrada.slice(1)
        : "-" + estado.entrada;
      estado.error = null;
    },

    // Devolver un objeto en vez de mutar reemplaza el estado entero.
    limpiado: () => INICIAL,
  },

  // Aquí se atienden las acciones que genera el thunk, que no pertenecen
  // al slice y por eso no van en `reducers`.
  extraReducers: (builder) => {
    builder
      .addCase(resolver.pending, (estado, accion) => {
        estado.peticion = "enviando";
        estado.operacionSiguiente = accion.meta.arg; // el argumento del thunk
        estado.error = null;
      })
      .addCase(resolver.fulfilled, (estado, accion) => {
        estado.entrada = formatear(accion.payload);
        estado.acumulador = accion.payload;
        estado.operacion = estado.operacionSiguiente; // null si venía de "="
        estado.operacionSiguiente = null;
        estado.peticion = "inactivo";
        estado.reiniciar = true;
      })
      .addCase(resolver.rejected, (estado, accion) => {
        // El acumulador y la operación se conservan: pulsar "=" reintenta.
        estado.peticion = "inactivo";
        estado.operacionSiguiente = null;
        estado.error = accion.payload ?? "error desconocido";
      });
  },
});

export const { digitoPulsado, borrado, signoCambiado, limpiado } = slice.actions;
export default slice.reducer;
