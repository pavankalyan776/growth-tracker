import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/fredoka";
import "@fontsource-variable/nunito";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/app.css";
import "./styles/viz.css";
import "./styles/admin.css";
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
