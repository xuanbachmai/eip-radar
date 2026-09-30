import type { NextConfig } from "next";

const config: NextConfig = {
  // Snapshot + change log are read from disk at runtime; make sure they ship with every function.
  outputFileTracingIncludes: { "/**": ["./data/**"] },
  eslint: { ignoreDuringBuilds: true }, // `pnpm lint` runs separately
  poweredByHeader: false,
};

export default config;
