import localFont from "next/font/local";

// UI font — Inter variable (arquivo local, do handoff)
export const inter = localFont({
  src: "./fonts/Inter.ttf",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
});

// Display font — títulos uppercase, pesos 500–900. Arquivo local (OFL, google/fonts
// ofl/bigshoulders, licença em ./fonts/BigShoulders-OFL.txt): variável em wght, com opsz fixo em 72
// (o mesmo corte que o Google Fonts servia), para o build não depender de rede.
export const bigShoulders = localFont({
  src: "./fonts/BigShoulders.woff2",
  variable: "--font-big-shoulders",
  display: "swap",
  weight: "100 900",
});
