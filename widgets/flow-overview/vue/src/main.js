import "./assets/main.css";

import { createApp } from "vue";
import App from "./App.vue";

window.onHomeyReady = function (Homey) {
  Homey.ready({height: 572});

  createApp(App, { Homey }).mount("#app");
};
