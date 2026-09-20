import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { playAchAfterArrive } from "./achSound";
import App from "./App";
import "./index.css";

playAchAfterArrive();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
