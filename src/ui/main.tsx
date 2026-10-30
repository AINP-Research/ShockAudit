import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./six-screen/SixScreenApp";
import "./global.css";
import "./six-screen/six-screen.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("ShockAudit could not find its application root.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
