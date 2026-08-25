import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "gh-stack-tree",
    description: "Render tree-shaped PR stacks on github.com",
    permissions: ["storage"],
    host_permissions: ["https://github.com/*", "https://api.github.com/*"],
    browser_specific_settings: {
      gecko: { id: "gh-stack-tree@maastrich.dev", strict_min_version: "115.0" },
    },
  },
});
