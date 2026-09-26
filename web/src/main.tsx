import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { bufferAch, bufferPanik } from "./achSound";
import App from "./App";
import "./index.css";

void bufferAch();
void bufferPanik();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
