import { fileURLToPath } from "url";

import path from "path";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  turbopack: {
    root: dirname, // Turbopackのroot誤検出を防ぐ
  },
};

export default nextConfig;
