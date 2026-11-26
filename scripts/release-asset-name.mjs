/** GitHub release uploads replace spaces in the uploaded filename with dots. */
export function normalizeAssetName(name) {
  return name.replaceAll(" ", ".");
}
