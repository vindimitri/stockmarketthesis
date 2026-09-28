import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { bufferAch, bufferPanik } from "./lib/achSound";
import App from "./App";
import "./index.css";

// Warm media cache only — do not unlock AudioContext here (needs a gesture).
void bufferAch();
void bufferPanik();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
