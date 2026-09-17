package main

import (
	"errors"
	"testing"
)

// Tests "table-driven": un slice de casos y un solo bucle. Es LA convención en
// Go; no hay librería de asertos en la estándar y rara vez se usa una externa.
//
//	go test ./...      -> corre los tests
//	go test -v ./...   -> muestra cada caso
func TestCalcular(t *testing.T) {
	casos := []struct {
		nombre    string
		a, b      float64
		operacion string
		esperado  float64
	}{
		{"suma", 10, 3, "+", 13},
		{"resta", 10, 3, "-", 7},
		{"producto", 10, 3, "*", 30},
		{"division", 10, 4, "/", 2.5},
		{"negativos", -5, -5, "+", -10},
		{"resultado cero", 2, 2, "-", 0},
	}

	for _, c := range casos {
		// t.Run crea un subtest con nombre propio: si falla, sabes cuál.
		t.Run(c.nombre, func(t *testing.T) {
			obtenido, err := calcular(c.a, c.b, c.operacion)
			if err != nil {
				t.Fatalf("no esperaba error, llegó: %v", err)
			}
			if obtenido != c.esperado {
				t.Errorf("calcular(%v, %v, %q) = %v; esperaba %v",
					c.a, c.b, c.operacion, obtenido, c.esperado)
			}
		})
	}
}

func TestCalcularDivisionEntreCero(t *testing.T) {
	_, err := calcular(10, 0, "/")

	// errors.Is compara contra el centinela, no contra el texto del mensaje.
	if !errors.Is(err, ErrDivisionCero) {
		t.Errorf("esperaba ErrDivisionCero, llegó: %v", err)
	}
}

func TestCalcularOperacionInvalida(t *testing.T) {
	if _, err := calcular(1, 2, "%"); err == nil {
		t.Error("esperaba un error para la operación %%, no llegó ninguno")
	}
}
