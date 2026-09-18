import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import calculadora from "./calculadoraSlice";

// configureStore ya trae Redux DevTools y los middleware habituales
// (thunk, comprobación de inmutabilidad y de serializabilidad) activados.
export const store = configureStore({
  reducer: { calculadora },
});

// Los tipos se DEDUCEN de la store, no se escriben a mano. Al añadir un slice
// nuevo, RootState lo incluye solo.
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// RTK 2 / react-redux 9: en vez de anotar el genérico en cada uso, se exportan
// hooks ya tipados. `useAppDispatch` entiende de thunks; `useDispatch` pelado
// no, y rechazaría dispatch(resolver(...)).
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
