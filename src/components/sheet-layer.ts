let isolationCount = 0;
let isolatedRoot: HTMLElement | null = null;
let rootWasInert = false;
let rootAriaHidden: string | null = null;

export interface ActiveSheet {
  id: symbol;
  layer: number;
  overlay: HTMLDivElement;
  panel: HTMLDivElement;
}

const activeSheets = new Map<symbol, ActiveSheet>();

function getTopSheet() {
  let topSheet: ActiveSheet | null = null;

  for (const sheet of activeSheets.values()) {
    if (!sheet.overlay.isConnected) continue;
    if (!topSheet || sheet.layer > topSheet.layer) {
      topSheet = sheet;
      continue;
    }
    if (sheet.layer !== topSheet.layer) continue;

    const position = topSheet.overlay.compareDocumentPosition(sheet.overlay);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) topSheet = sheet;
  }

  return topSheet;
}

function syncSheetIsolation() {
  const topSheet = getTopSheet();
  for (const sheet of activeSheets.values()) {
    const isTop = sheet.id === topSheet?.id;
    sheet.overlay.inert = !isTop;
    if (isTop) sheet.overlay.removeAttribute("aria-hidden");
    else sheet.overlay.setAttribute("aria-hidden", "true");
  }
}

export function registerActiveSheet(sheet: ActiveSheet) {
  activeSheets.set(sheet.id, sheet);
  syncSheetIsolation();

  return () => {
    if (!activeSheets.has(sheet.id)) {
      return { wasTopSheet: false, nextTopSheet: getTopSheet() };
    }
    const wasTopSheet = getTopSheet()?.id === sheet.id;
    sheet.overlay.inert = true;
    sheet.overlay.setAttribute("aria-hidden", "true");
    activeSheets.delete(sheet.id);
    syncSheetIsolation();
    return { wasTopSheet, nextTopSheet: getTopSheet() };
  };
}

export function isTopSheet(id: symbol) {
  return getTopSheet()?.id === id;
}

export function isolateApplication() {
  const root = document.getElementById("root");
  if (!root) return () => {};

  if (isolationCount === 0) {
    isolatedRoot = root;
    rootWasInert = root.inert;
    rootAriaHidden = root.getAttribute("aria-hidden");
    root.inert = true;
    root.setAttribute("aria-hidden", "true");
  }
  isolationCount += 1;

  return () => {
    isolationCount = Math.max(0, isolationCount - 1);
    if (isolationCount !== 0 || !isolatedRoot) return;
    isolatedRoot.inert = rootWasInert;
    if (rootAriaHidden === null) isolatedRoot.removeAttribute("aria-hidden");
    else isolatedRoot.setAttribute("aria-hidden", rootAriaHidden);
    isolatedRoot = null;
    rootAriaHidden = null;
  };
}
