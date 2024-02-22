import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.tsx";
import "./index.css";
import "@radix-ui/themes/styles.css";

import { Theme, ThemePanel } from "@radix-ui/themes";

import { enableMapSet } from "immer";

enableMapSet();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Theme>
      <App />
      {/* <ThemePanel /> */}
    </Theme>
  </React.StrictMode>
);
