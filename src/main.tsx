import "@mantine/core/styles.css";

import { createTheme, MantineProvider } from "@mantine/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";

import App from "./App";
import { store } from "./app/store";
import "./styles.css";

const accent = [
	"#e7fffb",
	"#c7fff7",
	"#99f8ed",
	"#66efdf",
	"#2de2ce",
	"#00d4bb",
	"#00b5a0",
	"#009080",
	"#00685c",
	"#004238",
] as const;

const ember = [
	"#fff7e2",
	"#feedc4",
	"#f9db8f",
	"#f1c95b",
	"#ecbe40",
	"#d6a12a",
	"#b1801c",
	"#8b6112",
	"#654508",
	"#412b03",
] as const;

const theme = createTheme({
	fontFamily: "Inter, system-ui, sans-serif",
	primaryColor: "accent",
	primaryShade: 5,
	colors: {
		accent,
		ember,
	},
	defaultRadius: "xl",
});

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<Provider store={store}>
			<MantineProvider defaultColorScheme="dark" theme={theme}>
				<App />
			</MantineProvider>
		</Provider>
	</StrictMode>,
);
