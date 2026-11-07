import {
  HAIR_COLORS,
  OPTION_COUNTS,
  SHIRTS,
  SKINS,
  cleanAvatar,
  drawAvatar,
  randomAvatar,
  type Avatar,
  type Feature,
} from "../shared/avatar";

// The "Make your player" screen. The phone keeps its player in localStorage,
// so next time it opens already filled in.

const KEY = "lagoon-profile";
const PREVIEW = 136;

const ROWS: [Feature, string][] = [
  ["face", "Face"],
  ["skin", "Skin"],
  ["hair", "Hair"],
  ["hairColor", "Hair colour"],
  ["eyes", "Eyes"],
  ["brows", "Brows"],
  ["mouth", "Mouth"],
  ["shirt", "Shirt"],
];

const SWATCHES: Partial<Record<Feature, string[]>> = { skin: SKINS, hairColor: HAIR_COLORS, shirt: SHIRTS };

const screen = document.getElementById("setup")!;
const canvas = document.getElementById("preview") as HTMLCanvasElement;
const nameInput = document.getElementById("name") as HTMLInputElement;
const pickers = document.getElementById("pickers")!;
const shuffleBtn = document.getElementById("shuffle")!;
const readyBtn = document.getElementById("ready")!;

export function savedProfile(): Avatar | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? cleanAvatar(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function closeSetup() {
  screen.classList.add("hidden");
}

export function openSetup(start: Avatar | null, onReady: (a: Avatar) => void) {
  let a: Avatar = start ? { ...start } : randomAvatar();
  const outputs = new Map<Feature, HTMLOutputElement>();

  const dpr = window.devicePixelRatio || 1;
  canvas.width = PREVIEW * dpr;
  canvas.height = PREVIEW * dpr;
  const ctx = canvas.getContext("2d")!;

  const refresh = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, PREVIEW, PREVIEW);
    drawAvatar(ctx, a, PREVIEW / 2, PREVIEW * 0.44, PREVIEW * 0.52, { body: true });
    for (const [feature, out] of outputs) {
      const colors = SWATCHES[feature];
      if (colors) {
        out.innerHTML = "";
        const dot = document.createElement("span");
        dot.className = "swatch";
        dot.style.background = colors[a[feature]];
        out.append(dot);
      } else {
        out.textContent = `${a[feature] + 1} / ${OPTION_COUNTS[feature]}`;
      }
    }
  };

  pickers.replaceChildren(
    ...ROWS.map(([feature, label]) => {
      const row = document.createElement("div");
      row.className = "picker";
      const name = document.createElement("span");
      name.textContent = label;
      const out = document.createElement("output");
      outputs.set(feature, out);
      const step = (by: number, text: string, aria: string) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = text;
        b.setAttribute("aria-label", `${aria} ${label.toLowerCase()}`);
        b.addEventListener("click", () => {
          const n = OPTION_COUNTS[feature];
          a[feature] = (a[feature] + by + n) % n;
          navigator.vibrate?.(6);
          refresh();
        });
        return b;
      };
      row.append(name, step(-1, "‹", "Previous"), out, step(1, "›", "Next"));
      return row;
    }),
  );

  nameInput.value = a.name;
  nameInput.oninput = () => (a.name = nameInput.value);

  shuffleBtn.onclick = () => {
    a = { ...randomAvatar(), name: a.name };
    navigator.vibrate?.(15);
    refresh();
  };

  readyBtn.onclick = () => {
    a = cleanAvatar(a);
    nameInput.blur();
    try {
      localStorage.setItem(KEY, JSON.stringify(a));
    } catch {}
    closeSetup();
    onReady(a);
  };

  refresh();
  screen.classList.remove("hidden");
}
