import * as React from "react";
import { render } from "react-dom";
import { BrowserRouter } from "react-router-dom";
import { createGlobalStyle } from "styled-components";

import { App } from "./App";
import "./styles/main.less";

const GlobalStyle = createGlobalStyle`
  html, body, #app {
    margin: 0;
    min-height: 100vh;
  }

  * {
    box-sizing: border-box;
    font-family: "Open Sans";
  }
`;

render(
  <BrowserRouter>
    <GlobalStyle />
    <App />
  </BrowserRouter>,
  document.getElementById("app"),
);
