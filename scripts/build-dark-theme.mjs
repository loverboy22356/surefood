#!/usr/bin/env node
/**
 * Builds app/theme-dark.css from the site's light stylesheets.
 *
 * The light theme is white cards, pale lilac panels and dark ink. Dark mode is
 * the same structure with the luminance flipped: near-white surfaces become
 * deep violet panels, dark ink becomes light ink, light borders become faint
 * white lines, and saturated pastel tints keep their hue so status colours
 * (green success, amber notice, red error) still read correctly.
 *
 * Every generated selector is scoped to html[data-theme="dark"], so light mode
 * is untouched. Run `npm run theme:dark` after editing any imported stylesheet.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, "app/theme-dark.css");

const SOURCES = [
  "app/globals.css",
  "app/home.css",
  "app/browse.css",
  "app/requests.css",
  "app/account/account.css",
  "app/affiliate/affiliate.css",
  "app/vendor/vendor.css",
  "app/components/human-check.css",
  "app/motion.css",
];

const PREFIX = 'html[data-theme="dark"]';

/* ------------------------------------------------------------------ colors */

const NAMED = {
  white: [255, 255, 255],
  black: [0, 0, 0],
  gainsboro: [220, 220, 220],
  whitesmoke: [245, 245, 245],
  snow: [255, 250, 250],
  ivory: [255, 255, 240],
  beige: [245, 245, 220],
};

function parseColor(token) {
  const value = token.trim().toLowerCase();
  if (value === "transparent" || value === "inherit" || value === "currentcolor") return null;
  if (NAMED[value]) return { ...rgbTuple(NAMED[value]), a: 1, raw: token };

  if (value.startsWith("#")) {
    const hex = value.slice(1);
    const expand = (chunk) => parseInt(chunk.length === 1 ? chunk + chunk : chunk, 16);
    if (hex.length === 3 || hex.length === 4) {
      const [r, g, b] = [
        expand(hex[0]),
        expand(hex[1]),
        expand(hex[2]),
      ];
      const a = hex.length === 4 ? expand(hex[3]) / 255 : 1;
      return { r, g, b, a, raw: token };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a, raw: token };
    }
    return null;
  }

  const fn = value.match(/^rgba?\(([^)]+)\)$/);
  if (fn) {
    const parts = fn[1].split(/[,\s/]+/).filter(Boolean);
    const channel = (part) => (part.endsWith("%") ? (parseFloat(part) / 100) * 255 : parseFloat(part));
    const r = channel(parts[0] ?? "0");
    const g = channel(parts[1] ?? "0");
    const b = channel(parts[2] ?? "0");
    const a = parts[3] === undefined ? 1 : parseFloat(parts[3].endsWith("%") ? parts[3] : parts[3]);
    if ([r, g, b].some((n) => !Number.isFinite(n))) return null;
    return { r, g, b, a: Number.isFinite(a) ? a : 1, raw: token };
  }

  return null;
}

function rgbTuple([r, g, b]) {
  return { r, g, b };
}

function linear(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance({ r, g, b }) {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function toHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;
  if (!delta) return { h: 0, s: 0, l };
  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let h;
  if (max === rn) h = ((gn - bn) / delta) % 6;
  else if (max === gn) h = (bn - rn) / delta + 2;
  else h = (rn - gn) / delta + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let [r, g, b] = [0, 0, 0];
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  const hex = (v) =>
    Math.max(0, Math.min(255, Math.round((v + m) * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

const CARD = "#1c1230";
const PAGE = "#171027";
const INK = "#ece6f8";
const MUTED = "#b3a4c8";

/** How colourful a colour looks, independent of how light it is (0–1). */
function chroma({ r, g, b }) {
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

/** Backgrounds, gradient stops and pale tints. */
function mapSurface(color) {
  const { a } = color;
  const lum = luminance(color);
  const { h } = toHsl(color);
  const spread = chroma(color);

  if (a < 0.985) {
    // Faint white washes on the purple header are already correct in dark mode.
    if (lum < 0.55 || a < 0.5) return null;
    // Frosted panels become translucent panels.
    return `rgba(28, 18, 48, ${a.toFixed(2)})`;
  }

  const tint = hslToHex(h, Math.min(0.5, Math.max(0.18, spread * 1.5)), lum >= 0.95 ? 0.16 : 0.19);

  if (lum >= 0.95) return spread < 0.08 ? CARD : tint;
  if (lum >= 0.86) return spread < 0.08 ? PAGE : tint;
  if (lum >= 0.55) return spread < 0.08 ? PAGE : hslToHex(h, Math.min(0.5, spread * 1.5), 0.23);
  return null;
}

/** Text, icons and SVG paint. */
function mapInk(color) {
  const { a } = color;
  const lum = luminance(color);
  const { h, s } = toHsl(color);

  const spread = chroma(color);

  if (a < 0.985) {
    if (lum > 0.5) return null;
    return `rgba(236, 230, 248, ${Math.min(1, Math.max(0.35, a)).toFixed(2)})`;
  }
  if (lum > 0.5) return null;
  if (spread < 0.2) return lum < 0.16 ? INK : MUTED;
  return hslToHex(h, Math.min(s, 0.85), lum < 0.16 ? 0.76 : 0.72);
}

/** Borders, outlines and dividers. */
function mapBorder(color) {
  const lum = luminance(color);
  const spread = chroma(color);
  // Faint translucent rings and dividers are already designed for dark grounds.
  if (color.a < 0.6) return null;
  if (lum >= 0.72) {
    return spread <= 0.1 ? "rgba(255, 255, 255, 0.12)" : "rgba(196, 165, 255, 0.26)";
  }
  if (lum >= 0.5) return spread <= 0.1 ? "rgba(255, 255, 255, 0.18)" : "rgba(196, 165, 255, 0.34)";
  return null;
}

const COLOR_TOKEN = /(#[0-9a-fA-F]{3,8}\b|\brgba?\([^()]*\)|\b(?:white|black|whitesmoke|gainsboro|snow|ivory|beige)\b)/g;

/** Every `--token: colour` definition in the app, so var() paints can be themed too. */
const TOKENS = new Map();

function collectTokens(css) {
  const definition = /--([a-z0-9-]+)\s*:\s*([^;}]+)/gi;
  let match;
  while ((match = definition.exec(css))) {
    const value = match[2].trim().replace(/!important$/i, "").trim();
    if (!TOKENS.has(match[1])) TOKENS.set(match[1], value);
  }
}

/** Resolves `var(--x)` to its palette colour; unknown tokens are left alone. */
function resolveVars(value) {
  let next = value;
  for (let pass = 0; pass < 4 && next.includes("var("); pass += 1) {
    next = next.replace(/var\(\s*--([a-z0-9-]+)\s*\)/gi, (whole, name) => {
      const token = TOKENS.get(name);
      if (!token || token.includes("var(")) return whole;
      return token;
    });
  }
  return next;
}

function mapDeclaration(property, value) {
  if (value.includes("url(")) {
    // Keep the paint layer; only recolor a gradient sitting next to it.
    if (!value.includes("gradient(")) return null;
  }
  const mapper = pickMapper(property);
  if (!mapper) return null;

  let changed = false;
  const next = value.replace(COLOR_TOKEN, (token) => {
    const color = parseColor(token);
    if (!color) return token;
    const mapped = mapper(color);
    if (!mapped) return token;
    if (mapped.toLowerCase() === token.toLowerCase()) return token;
    changed = true;
    return mapped;
  });
  return changed ? next : null;
}

function pickMapper(property) {
  if (property === "background" || property === "background-color" || property === "background-image") return mapSurface;
  if (property === "fill" || property === "stroke") return mapInk;
  if (
    property === "color" ||
    property === "caret-color" ||
    property === "-webkit-text-fill-color" ||
    property === "-webkit-text-stroke-color"
  ) {
    return mapInk;
  }
  if (property === "border" || property === "border-color" || property === "outline" || property === "outline-color") {
    return mapBorder;
  }
  if (/^border-(top|right|bottom|left|block|inline)(-(color|start|end))?$/.test(property)) return mapBorder;
  if (property === "text-decoration-color" || property === "column-rule-color") return mapBorder;
  return null;
}

/* ------------------------------------------------------------------ parsing */

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function splitTopLevel(value, separator) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    else if (ch === separator && depth === 0) {
      parts.push(value.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
}

function parseRules(css, media, out) {
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open === -1) break;
    const prelude = css.slice(i, open).trim();

    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth += 1;
      else if (css[j] === "}") depth -= 1;
      j += 1;
    }
    const body = css.slice(open + 1, j - 1);

    if (/^@(media|supports|layer|container)\b/.test(prelude)) {
      if (prelude.startsWith("@media")) parseRules(body, prelude, out);
      else parseRules(body, media, out);
    } else if (!prelude.startsWith("@")) {
      out.push({ media, selector: prelude, body });
    }

    i = j;
  }
  return out;
}

function convertRule({ selector, body }) {
  const declarations = splitTopLevel(body, ";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const colon = declaration.indexOf(":");
      if (colon === -1) return null;
      const property = declaration.slice(0, colon).trim().toLowerCase();
      // Palette definitions stay untouched: a solid brand button keeps its colour,
      // while text that merely references the token is lightened per-property below.
      if (property.startsWith("--")) return null;
      const rawValue = declaration.slice(colon + 1).trim();
      const important = /!important$/i.test(rawValue);
      const value = important ? rawValue.replace(/!important$/i, "").trim() : rawValue;

      const resolved = resolveVars(value);
      const mapped = mapDeclaration(property, resolved);
      if (!mapped) return null;
      return `${property}: ${mapped}${important ? " !important" : ""};`;
    })
    .filter(Boolean);

  if (!declarations.length) return null;

  const selectors = selector
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (/\[data-theme/.test(part)) return null;
      if (part === ":root" || part === "html" || part === "*") return null;
      if (part.startsWith("html ") || part.startsWith("html>")) return null;
      return `${PREFIX} ${part}`;
    })
    .filter(Boolean);

  if (!selectors.length) return null;
  return { selectors, declarations };
}

/* ------------------------------------------------------------------- output */

const rules = [];
const sources = [];
for (const source of SOURCES) {
  const file = path.join(ROOT, source);
  if (!fs.existsSync(file)) {
    console.warn(`skip ${source} (not found)`);
    continue;
  }
  sources.push(stripComments(fs.readFileSync(file, "utf8")));
}
for (const css of sources) collectTokens(css);
for (const css of sources) parseRules(css, null, rules);

const buckets = new Map();
let converted = 0;
for (const rule of rules) {
  const result = convertRule(rule);
  if (!result) continue;
  converted += 1;
  const key = rule.media ?? "";
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push(`${result.selectors.join(", ")} { ${result.declarations.join(" ")} }`);
}

const header = `/* Dark theme — generated by scripts/build-dark-theme.mjs. Do not edit by hand.
   Every rule is scoped to html[data-theme="dark"], so light mode is unchanged.
   Run \`npm run theme:dark\` after changing any imported stylesheet. */\n\n`;

let out = header;
for (const [media, lines] of buckets) {
  if (!media) out += `${lines.join("\n")}\n\n`;
}
for (const [media, lines] of buckets) {
  if (!media) continue;
  out += `${media} {\n${lines.map((line) => `  ${line}`).join("\n")}\n}\n\n`;
}

fs.writeFileSync(OUTPUT, out);
console.log(`theme-dark.css: ${converted} rules converted → ${(out.length / 1024).toFixed(1)} KB`);
