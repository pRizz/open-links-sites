import { render } from "solid-js/web";

import { App } from "./App";
import "./styles.css";
import { initializeTheme } from "./theme";

const root = document.getElementById("app");

if (!root) {
  throw new Error("Landing page root element was not found.");
}

initializeTheme();

render(() => <App />, root);
