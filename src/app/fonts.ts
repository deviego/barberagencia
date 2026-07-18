import localFont from "next/font/local";
import { Big_Shoulders } from "next/font/google";

// UI font — Inter variable (arquivo local, do handoff)
export const inter = localFont({
  src: "./fonts/Inter.ttf",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
});

// Display font — títulos uppercase, pesos 500–900
export const bigShoulders = Big_Shoulders({
  subsets: ["latin"],
  variable: "--font-big-shoulders",
  display: "swap",
  weight: ["500", "600", "700", "800", "900"],
});
