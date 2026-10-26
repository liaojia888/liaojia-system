import { spawnSync } from "node:child_process";
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

function gitRevision(): string {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" });
  return result.stdout?.trim() || "development";
}

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [{ url: "/~offline", revision: gitRevision() }],
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {};

export default withSerwist(nextConfig);
