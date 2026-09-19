// Calculadora: API HTTP en Go que además sirve el frontend en TypeScript.
//
//	go run .              -> http://localhost:8080
//	go run . -puerto 9000 -> otro puerto
package main

import (
	"encoding/json"
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"example/calculator/internal/calculator"
)

// -----------------------------------------------------------------------------
// Contrato de la API
// -----------------------------------------------------------------------------

// Peticion es el cuerpo JSON que manda el navegador.
// Las etiquetas `json:"..."` son las que mapean el campo Go (mayúscula, público)
// con la clave JSON (minúscula). Sin la etiqueta, Go serializaría "A" y "B".
type Peticion struct {
	A         float64 `json:"a"`
	B         float64 `json:"b"`
	Operacion string  `json:"operacion"`
}

// Two separate structs rather than one with omitempty, on purpose: with
// omitempty on the result field, the response for 2-2 would lose the field,
// because omitempty cannot tell zero from absent.
type RespuestaOK struct {
	Resultado float64 `json:"resultado"`
}

type RespuestaError struct {
	Error string `json:"error"`
}

// -----------------------------------------------------------------------------
// Bridge to the calculator domain
// -----------------------------------------------------------------------------

var arithmetic = calculator.New()

// operationNames translates the symbols of this API into the operation names
// the calculator package understands. Temporary: it goes away when the
// transport layer speaks operation names itself.
var operationNames = map[string]string{
	"+": "add",
	"-": "subtract",
	"*": "multiply",
	"/": "divide",
}

// -----------------------------------------------------------------------------
// Handlers HTTP
// -----------------------------------------------------------------------------

func manejarCalculo(w http.ResponseWriter, r *http.Request) {
	var p Peticion

	// Decode lee del body y rellena el struct. Si el JSON no encaja, error.
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		escribirError(w, http.StatusBadRequest, "JSON inválido: "+err.Error())
		return
	}

	// An unknown symbol is passed through as is, so the domain reports it.
	operationName, known := operationNames[p.Operacion]
	if !known {
		operationName = p.Operacion
	}

	result, err := arithmetic.Compute(operationName, []float64{p.A, p.B})
	if err != nil {
		escribirError(w, http.StatusBadRequest, err.Error())
		return
	}

	escribirJSON(w, http.StatusOK, RespuestaOK{Resultado: result})
}

// -----------------------------------------------------------------------------
// Utilidades de respuesta
// -----------------------------------------------------------------------------

// `any` es alias de interface{} desde Go 1.18: acepta cualquier tipo.
func escribirJSON(w http.ResponseWriter, codigo int, cuerpo any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	// Ojo al orden: las cabeceras se fijan ANTES de WriteHeader, y WriteHeader
	// antes de escribir el cuerpo. Al revés, Go ignora el cambio.
	w.WriteHeader(codigo)
	if err := json.NewEncoder(w).Encode(cuerpo); err != nil {
		log.Printf("error escribiendo la respuesta: %v", err)
	}
}

func escribirError(w http.ResponseWriter, codigo int, mensaje string) {
	escribirJSON(w, codigo, RespuestaError{Error: mensaje})
}

// -----------------------------------------------------------------------------
// Arranque
// -----------------------------------------------------------------------------

func main() {
	puerto := flag.String("puerto", "8080", "puerto HTTP donde escuchar")
	web := flag.String("web", filepath.Join("..", "frontend", "dist"), "carpeta del frontend compilado")
	flag.Parse()

	if _, err := os.Stat(filepath.Join(*web, "index.html")); err != nil {
		log.Fatalf("no encuentro el frontend compilado en %q.\n"+
			"Compílalo primero:  cd ../frontend && npm install && npm run build", *web)
	}

	mux := http.NewServeMux()

	// Desde Go 1.22 el router estándar entiende método + ruta, sin librerías.
	mux.HandleFunc("POST /api/calcular", manejarCalculo)

	// Todo lo demás son los archivos que generó Vite: index.html y assets/.
	//
	// Ojo con este comodín: normalmente un GET a /api/calcular daría 405
	// (método no permitido), pero al existir "/" el router considera que esa
	// ruta sí tiene quien la atienda, se la pasa al FileServer y acaba en 404.
	// El comodín se traga los 405 de toda la API.
	mux.Handle("/", http.FileServer(http.Dir(*web)))

	direccion := ":" + *puerto
	servidor := &http.Server{
		Addr:              direccion,
		Handler:           registrarPeticiones(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("calculadora escuchando en http://localhost%s", direccion)
	if err := servidor.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("el servidor se detuvo: %v", err)
	}
}

// registrarPeticiones es un middleware: recibe un handler y devuelve otro que
// lo envuelve. Así se encadena funcionalidad en Go, sin herencia ni decoradores.
func registrarPeticiones(siguiente http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		inicio := time.Now()
		siguiente.ServeHTTP(w, r)
		log.Printf("%s %s (%s)", r.Method, r.URL.Path, time.Since(inicio))
	})
}
