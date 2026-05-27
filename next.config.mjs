/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  devIndicators: false,
  // CAREERFLOW: keep the resume text-extraction parsers as runtime externals
  // (not bundled) so the standalone build resolves them from node_modules.
  serverExternalPackages: ["unpdf", "mammoth"],
  // CAREERFLOW: the draft generators read vendor/humanizer/SKILL.md at runtime
  // (see src/lib/ai/prompts/humanizer). Force the standalone build to include
  // the vendored skill so it's present in production, not just in dev.
  outputFileTracingIncludes: {
    "/api/drafts/**": ["./vendor/humanizer/**"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
