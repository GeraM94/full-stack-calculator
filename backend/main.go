// Calculadora: API HTTP en Go que además sirve el frontend en TypeScript.
//
//	go run .              -> http://localhost:8080
//	go run . -puerto 9000 -> otro puerto
package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"time"
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

// Usamos dos structs distintos en lugar de uno con `omitempty` a propósito:
// con `Resultado float64 \`json:"resultado,omitempty"\`` la respuesta de 2-2
// se quedaría sin el campo, porque omitempty no distingue "cero" de "vacío".
type RespuestaOK struct {
	Resultado float64 `json:"resultado"`
}

type RespuestaError struct {
	Error string `json:"error"`
}

// -----------------------------------------------------------------------------
// Lógica de negocio
// -----------------------------------------------------------------------------

// ErrDivisionCero es un error centinela: se compara con errors.Is() en vez de
// mirar el texto del mensaje. Es el patrón idiomático en Go.
var ErrDivisionCero = errors.New("no se puede dividir entre cero")

// calcular devuelve (resultado, error). Esta firma doble es el corazón de Go:
// no hay excepciones, el error es un valor más que el llamador debe revisar.
func calcular(a, b float64, operacion string) (float64, error) {
	switch operacion {
	case "+":
		return a + b, nil
	case "-":
		return a - b, nil
	case "*":
		return a * b, nil
	case "/":
		if b == 0 {
			// El primer valor es el "cero" del tipo: nunca se usa si hay error.
			return 0, ErrDivisionCero
		}
		return a / b, nil
	default:
		return 0, fmt.Errorf("operación no soportada: %q", operacion)
	}
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

	resultado, err := calcular(p.A, p.B, p.Operacion)
	if err != nil {
		escribirError(w, http.StatusBadRequest, err.Error())
		return
	}

	// JSON no sabe representar Infinity ni NaN: 1e308 * 10 reventaría el
	// encoder. Lo cortamos aquí y devolvemos un error legible.
	if math.IsInf(resultado, 0) || math.IsNaN(resultado) {
		escribirError(w, http.StatusBadRequest, "el resultado excede el rango representable")
		return
	}

	escribirJSON(w, http.StatusOK, RespuestaOK{Resultado: resultado})
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
