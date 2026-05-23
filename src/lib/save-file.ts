import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

export async function saveFileDialog(
  defaultName: string,
  content: string,
  filters: { name: string; extensions: string[] }[] = [{ name: "JSON", extensions: ["json"] }],
): Promise<boolean> {
  const path = await save({ defaultPath: defaultName, filters });
  if (!path) return false;
  await writeTextFile(path, content);
  return true;
}
