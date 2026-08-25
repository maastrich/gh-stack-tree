import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "gh-stack-tree",
    description: "Render tree-shaped PR stacks on github.com",
    permissions: ["storage"],
    host_permissions: ["https://github.com/*"],
  },
});
