import { Mountains_of_Christmas } from "next/font/google";

/** Christmas display font for Jul headings only; self-hosted by next/font at build. */
export const julFont = Mountains_of_Christmas({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-jul",
});
