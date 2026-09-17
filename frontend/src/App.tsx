import { Fragment, useEffect } from "react";
import { useCalculadora, simbolo } from "./useCalculadora";
import type { Operacion } from "./api";

const FILAS: readonly (readonly [string, string, string])[] = [
  ["7", "8", "9"],
  ["4", "5", "6"],
  ["1", "2", "3"],
];

/** El operador que acompaña a cada fila de dígitos. */
const OPERADOR_DE_FILA: readonly Operacion[] = ["*", "-", "+"];

export default function App() {
  const { pantalla, expresion, operacionActiva, error, cargando, dispatch } = useCalculadora();

  useEffect(() => {
    function alPulsarTecla(evento: KeyboardEvent) {
      const { key } = evento;

      if (key >= "0" && key <= "9") return dispatch({ tipo: "digito", digito: key });
      if (key === "." || key === ",") return dispatch({ tipo: "digito", digito: "." });
      if (key === "+" || key === "-" || key === "*" || key === "/") {
        return dispatch({ tipo: "operacion", operacion: key });
      }
      if (key === "Enter" || key === "=") {
        evento.preventDefault();
        return dispatch({ tipo: "igual" });
      }
      if (key === "Backspace") return dispatch({ tipo: "borrar" });
      if (key === "Escape") return dispatch({ tipo: "limpiar" });
    }

    window.addEventListener("keydown", alPulsarTecla);
    return () => window.removeEventListener("keydown", alPulsarTecla);
    // dispatch nunca cambia de identidad, así que este efecto se ejecuta UNA
    // vez. Antes dependía del objeto del hook, que era nuevo en cada render.
    //
    // Tampoco hace falta comprobar `cargando` aquí: el reducer ignora las
    // acciones mientras hay una petición en vuelo, así que el teclado ya no
    // puede saltarse los botones deshabilitados.
  }, [dispatch]);

  return (
    <main className="calculadora">
      <header className="cabecera">
        <span className="etiqueta">Go 1.27</span>
        <span className="flecha" aria-hidden="true">
          ↔
        </span>
        <span className="etiqueta">React + TS</span>
      </header>

      <section className="pantalla" aria-live="polite">
        <div className="expresion">{expresion}</div>
        <div className="resultado">{pantalla}</div>
      </section>

      <p className={`estado ${error ? "hay-error" : ""}`} role="status">
        {error ?? (cargando ? "calculando en el servidor…" : "")}
      </p>

      <div className="teclado">
        <Tecla clase="funcion" etiqueta="C" onClick={() => dispatch({ tipo: "limpiar" })} />
        <Tecla clase="funcion" etiqueta="±" onClick={() => dispatch({ tipo: "signo" })} />
        <Tecla clase="funcion" etiqueta="⌫" onClick={() => dispatch({ tipo: "borrar" })} />
        <TeclaOperador
          operacion="/"
          activa={operacionActiva === "/"}
          desactivada={cargando}
          onClick={() => dispatch({ tipo: "operacion", operacion: "/" })}
        />

        {FILAS.map((fila, indice) => {
          const operacion = OPERADOR_DE_FILA[indice];
          return (
            <Fragment key={fila.join("")}>
              {fila.map((digito) => (
                <Tecla
                  key={digito}
                  etiqueta={digito}
                  onClick={() => dispatch({ tipo: "digito", digito })}
                />
              ))}
              {operacion && (
                <TeclaOperador
                  operacion={operacion}
                  activa={operacionActiva === operacion}
                  desactivada={cargando}
                  onClick={() => dispatch({ tipo: "operacion", operacion })}
                />
              )}
            </Fragment>
          );
        })}

        <Tecla
          clase="cero"
          etiqueta="0"
          onClick={() => dispatch({ tipo: "digito", digito: "0" })}
        />
        <Tecla etiqueta="." onClick={() => dispatch({ tipo: "digito", digito: "." })} />
        <Tecla
          clase="igual"
          etiqueta="="
          desactivada={cargando}
          onClick={() => dispatch({ tipo: "igual" })}
        />
      </div>

      <footer className="pie">
        cada operación viaja a <code>POST /api/calcular</code>
      </footer>
    </main>
  );
}

interface PropsTecla {
  etiqueta: string;
  onClick: () => void;
  clase?: string;
  desactivada?: boolean;
}

function Tecla({ etiqueta, onClick, clase = "", desactivada = false }: PropsTecla) {
  return (
    <button type="button" className={`tecla ${clase}`} onClick={onClick} disabled={desactivada}>
      {etiqueta}
    </button>
  );
}

function TeclaOperador({
  operacion,
  activa,
  desactivada,
  onClick,
}: {
  operacion: Operacion;
  activa: boolean;
  desactivada: boolean;
  onClick: () => void;
}) {
  return (
    <Tecla
      clase={`operador ${activa ? "activo" : ""}`}
      etiqueta={simbolo(operacion)}
      desactivada={desactivada}
      onClick={onClick}
    />
  );
}
