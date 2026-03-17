import { render } from "solid-js/web";

import { App } from "./App";
import "./styles.css";

const root = document.getElementById("app");

if (!root) {
  throw new Error("Landing page root element was not found.");
}

render(() => <App />, root);
