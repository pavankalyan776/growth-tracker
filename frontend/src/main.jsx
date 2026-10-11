import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/big-shoulders-display";
import "@fontsource-variable/instrument-sans";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/views.css";
import "./styles/viz.css";
import App from "./App.jsx";
import { applyMode, getModePref } from "./theme";

applyMode(getModePref());

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
