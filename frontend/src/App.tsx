import { Fragment, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "./store/store";
import {
  resolver,
  digitoPulsado,
  borrado,
  signoCambiado,
  limpiado,
} from "./store/calculadoraSlice";
import { formatear, simbolo } from "./formato";
import type { Operacion } from "./api";

const FILAS: readonly (readonly [string, string, string])[] = [
  ["7", "8", "9"],
  ["4", "5", "6"],
  ["1", "2", "3"],
];

/** El operador que acompaña a cada fila de dígitos. */
const OPERADOR_DE_FILA: readonly Operacion[] = ["*", "-", "+"];

export default function App() {
  const dispatch = useAppDispatch();

  // Cada selector suscribe el componente solo a ese trozo del estado.
  const entrada = useAppSelector((s) => s.calculadora.entrada);
  const acumulador = useAppSelector((s) => s.calculadora.acumulador);
  const operacionActiva = useAppSelector((s) => s.calculadora.operacion);
  const error = useAppSelector((s) => s.calculadora.error);
  const cargando = useAppSelector((s) => s.calculadora.peticion === "enviando");

  useEffect(() => {
    function alPulsarTecla(evento: KeyboardEvent) {
      const { key } = evento;

      if (key >= "0" && key <= "9") return void dispatch(digitoPulsado(key));
      if (key === "." || key === ",") return void dispatch(digitoPulsado("."));
      if (key === "+" || key === "-" || key === "*" || key === "/") {
        return void dispatch(resolver(key));
      }
      if (key === "Enter" || key === "=") {
        evento.preventDefault();
        return void dispatch(resolver(null));
      }
      if (key === "Backspace") return void dispatch(borrado());
      if (key === "Escape") return void dispatch(limpiado());
    }

    window.addEventListener("keydown", alPulsarTecla);
    return () => window.removeEventListener("keydown", alPulsarTecla);
    // dispatch de react-redux también tiene identidad estable.
    //
    // Y tampoco hace falta comprobar `cargando`: el `condition` del thunk y el
    // guard de los reducers descartan lo que llegue con algo en vuelo.
  }, [dispatch]);

  const expresion =
    acumulador !== null && operacionActiva !== null
      ? `${formatear(acumulador)} ${simbolo(operacionActiva)}`
      : "";

  return (
    <main className="calculadora">
      <header className="cabecera">
        <span className="etiqueta">Go 1.27</span>
        <span className="flecha" aria-hidden="true">
          ↔
        </span>
        <span className="etiqueta">React + RTK</span>
      </header>

      <section className="pantalla" aria-live="polite">
        <div className="expresion">{expresion}</div>
        <div className="resultado">{entrada}</div>
      </section>

      <p className={`estado ${error ? "hay-error" : ""}`} role="status">
        {error ?? (cargando ? "calculando en el servidor…" : "")}
      </p>

      <div className="teclado">
        <Tecla clase="funcion" etiqueta="C" onClick={() => dispatch(limpiado())} />
        <Tecla clase="funcion" etiqueta="±" onClick={() => dispatch(signoCambiado())} />
        <Tecla clase="funcion" etiqueta="⌫" onClick={() => dispatch(borrado())} />
        <TeclaOperador
          operacion="/"
          activa={operacionActiva === "/"}
          desactivada={cargando}
          onClick={() => void dispatch(resolver("/"))}
        />

        {FILAS.map((fila, indice) => {
          const operacion = OPERADOR_DE_FILA[indice];
          return (
            <Fragment key={fila.join("")}>
              {fila.map((digito) => (
                <Tecla
                  key={digito}
                  etiqueta={digito}
                  onClick={() => dispatch(digitoPulsado(digito))}
                />
              ))}
              {operacion && (
                <TeclaOperador
                  operacion={operacion}
                  activa={operacionActiva === operacion}
                  desactivada={cargando}
                  onClick={() => void dispatch(resolver(operacion))}
                />
              )}
            </Fragment>
          );
        })}

        <Tecla clase="cero" etiqueta="0" onClick={() => dispatch(digitoPulsado("0"))} />
        <Tecla etiqueta="." onClick={() => dispatch(digitoPulsado("."))} />
        <Tecla
          clase="igual"
          etiqueta="="
          desactivada={cargando}
          onClick={() => void dispatch(resolver(null))}
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
