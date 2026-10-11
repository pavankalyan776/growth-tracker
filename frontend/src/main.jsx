import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/big-shoulders-display";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/lexend";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/views.css";
import "./styles/viz.css";
import "./styles/features.css";
import "./styles/calm.css";
import App from "./App.jsx";
import { applyMode, applySize, applyStyle, getModePref, getSizePref, getStylePref } from "./theme";

applyMode(getModePref());
applyStyle(getStylePref());
applySize(getSizePref());

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
