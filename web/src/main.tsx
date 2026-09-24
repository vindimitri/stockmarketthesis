import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { bufferAch } from "./achSound";
import App from "./App";
import "./index.css";

void bufferAch();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
