import "./styles/layers.css";
import "@mantine/core/styles.layer.css";
import "@mantine/notifications/styles.layer.css";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
