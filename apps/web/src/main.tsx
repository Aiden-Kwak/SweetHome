import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import PitchLauncher from "./PitchLauncher";
import LanguageSwitcher from "./LanguageSwitcher";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <PitchLauncher />
    <LanguageSwitcher />
  </StrictMode>,
);
