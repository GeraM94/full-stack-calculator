// Contrato con la API de Go. Este archivo es el espejo en TypeScript de los
// structs Peticion / RespuestaOK / RespuestaError de backend/main.go.

/** Union literal: solo estos cuatro strings son válidos. El compilador
 *  rechaza calcular({ ..., operacion: "%" }) antes de ejecutar nada. */
export type Operacion = "+" | "-" | "*" | "/";

export interface PeticionCalculo {
  a: number;
  b: number;
  operacion: Operacion;
}

interface RespuestaOK {
  resultado: number;
}

interface RespuestaError {
  error: string;
}

/** Union discriminada: la respuesta es una cosa o la otra, nunca ambas. */
type RespuestaCalculo = RespuestaOK | RespuestaError;

/** Type guard. El `r is RespuestaError` del retorno le dice a TypeScript que,
 *  dentro del if, `r` es exactamente RespuestaError y puede leer `r.error`.
 *  Es el equivalente en TS al `if err != nil` de Go. */
function esError(r: RespuestaCalculo): r is RespuestaError {
  return "error" in r;
}

export async function calcular(
  peticion: PeticionCalculo,
  signal?: AbortSignal,
): Promise<number> {
  const respuesta = await fetch("/api/calcular", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(peticion),
    // Permite cancelar la petición desde fuera: lo usa la limpieza del efecto.
    signal,
  });

  let cuerpo: RespuestaCalculo;
  try {
    // `as` es una aserción, no una validación: en runtime nadie comprueba que
    // el JSON tenga esta forma. Para una API propia es asumible; contra una
    // ajena se usaría zod o similar.
    cuerpo = (await respuesta.json()) as RespuestaCalculo;
  } catch {
    throw new Error(`respuesta ilegible del servidor (HTTP ${respuesta.status})`);
  }

  if (esError(cuerpo)) {
    throw new Error(cuerpo.error);
  }
  return cuerpo.resultado;
}
