// wraps all of the app's own css (tailwind included) in a native cascade layer.
// unlayered css always beats layered css, so theme packs can override anything
// without fighting tailwind's specificity (see THEMES.md)
module.exports = () => ({
  postcssPlugin: "app-layer",
  OnceExit(root, { AtRule }) {
    if (!root.nodes.length) return;
    // @font-face / @import / @charset have to stay top level
    const keep = new Set(["charset", "import", "font-face", "layer"]);
    const layer = new AtRule({ name: "layer", params: "bc-app" });
    for (const node of [...root.nodes]) {
      if (node.type === "atrule" && keep.has(node.name)) continue;
      layer.append(node);
    }
    if (layer.nodes.length) root.append(layer);
  },
});
module.exports.postcss = true;
