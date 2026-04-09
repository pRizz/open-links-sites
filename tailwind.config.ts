import { withMysticUI } from "mystic-ui/tailwind/setup";
import type { Config } from "tailwindcss";

export default withMysticUI({
  content: ["./landing.html", "./src/**/*.{ts,tsx}"],
}) satisfies Config;
