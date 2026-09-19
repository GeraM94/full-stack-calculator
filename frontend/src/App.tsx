import { useEffect } from "react";
import { useCalculadora, simbolo } from "./useCalculadora";
import type { Operacion } from "./api";

const OPERACIONES: readonly Operacion[] = ["/", "*", "-", "+"];

export default function App() {
  const calc = useCalculadora();

  // Soporte de teclado físico. El array de dependencias lleva todo lo que el
  // listener usa: si falta algo, el handler se queda con valores viejos.
  useEffect(() => {
    function alPulsarTecla(evento: KeyboardEvent) {
      const { key } = evento;

      if (key >= "0" && key <= "9") return calc.pulsarDigito(key);
      if (key === "." || key === ",") return calc.pulsarDigito(".");
      if (key === "+" || key === "-" || key === "*" || key === "/") {
        return void calc.pulsarOperacion(key);
      }
      if (key === "Enter" || key === "=") {
        evento.preventDefault();
        return void calc.pulsarIgual();
      }
      if (key === "Backspace") return calc.borrar();
      if (key === "Escape") return calc.limpiar();
    }

    window.addEventListener("keydown", alPulsarTecla);
    // La función devuelta es la limpieza: React la ejecuta antes del siguiente
    // efecto y al desmontar. Sin esto acumularías un listener por render.
    return () => window.removeEventListener("keydown", alPulsarTecla);
  }, [calc]);

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
        <div className="expresion">{calc.expresion}</div>
        <div className="resultado">{calc.pantalla}</div>
      </section>

      <p className={`estado ${calc.error ? "hay-error" : ""}`} role="status">
        {calc.error ?? (calc.cargando ? "calculando en el servidor…" : "")}
      </p>

      <div className="teclado">
        <Tecla clase="funcion" onClick={calc.limpiar} etiqueta="C" />
        <Tecla clase="funcion" onClick={calc.cambiarSigno} etiqueta="±" />
        <Tecla clase="funcion" onClick={calc.borrar} etiqueta="⌫" />
        <Tecla
          clase={`operador ${calc.operacionActiva === "/" ? "activo" : ""}`}
          onClick={() => void calc.pulsarOperacion("/")}
          etiqueta="÷"
          desactivada={calc.cargando}
        />

        {/* Los dígitos y los operadores se intercalan en una rejilla de 4
            columnas, así que se generan fila por fila. */}
        {[
          ["7", "8", "9"],
          ["4", "5", "6"],
          ["1", "2", "3"],
        ].map((fila, indice) => (
          <Fila
            key={fila.join("")}
            digitos={fila}
            operacion={OPERACIONES[indice + 1]}
            calc={calc}
          />
        ))}

        <Tecla clase="cero" onClick={() => calc.pulsarDigito("0")} etiqueta="0" />
        <Tecla onClick={() => calc.pulsarDigito(".")} etiqueta="." />
        <Tecla
          clase="igual"
          onClick={() => void calc.pulsarIgual()}
          etiqueta="="
          desactivada={calc.cargando}
        />
      </div>

      <footer className="pie">
        cada operación viaja a <code>POST /api/calcular</code>
      </footer>
    </main>
  );
}

/** El operador de la primera fila (÷) va suelto arriba porque comparte fila
 *  con las teclas de función; el resto se emparejan con sus dígitos. */
function Fila({
  digitos,
  operacion,
  calc,
}: {
  digitos: string[];
  operacion: Operacion | undefined;
  calc: ReturnType<typeof useCalculadora>;
}) {
  return (
    <>
      {digitos.map((d) => (
        <Tecla key={d} onClick={() => calc.pulsarDigito(d)} etiqueta={d} />
      ))}
      {operacion && (
        <Tecla
          clase={`operador ${calc.operacionActiva === operacion ? "activo" : ""}`}
          onClick={() => void calc.pulsarOperacion(operacion)}
          etiqueta={simbolo(operacion)}
          desactivada={calc.cargando}
        />
      )}
    </>
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
