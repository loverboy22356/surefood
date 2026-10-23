"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "./locale-provider";

const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA",
  "SVG", "CANVAS", "IFRAME", "VIDEO", "AUDIO", "OBJECT", "TEMPLATE",
]);
const TRANSLATE_ATTRIBUTES = ["placeholder", "aria-label", "title", "alt"] as const;
const PRICE_PATTERN = /(?:₦|NGN)\s?\d[\d.,]*/i;
const PRICE_PATTERN_GLOBAL = /(?:₦|NGN)\s?(\d[\d.,]*)/gi;
const HAS_LETTERS = /[A-Za-zÀ-ÿ\u0600-\u06ff\u0400-\u04ff\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/;
const NEVER_TRANSLATE = ".brand, .brand-mark, .account-brand, .auth-logo, .locale-switcher, [data-no-translate], [translate=\"no\"]";

type TextRecord = { original: string; applied: string };
type AttrRecord = { original: string; applied: string };
type Job =
  | { kind: "text"; node: Text; original: string; text: string }
  | { kind: "attr"; element: Element; attribute: string; original: string; text: string };

function skippedForText(element: Element | null) {
  let current: Element | null = element;
  while (current) {
    if (SKIP_TAGS.has(current.tagName)) return true;
    if (current.matches(NEVER_TRANSLATE)) return true;
    current = current.parentElement;
  }
  return false;
}

function skippedForAttribute(element: Element) {
  if (element.closest(NEVER_TRANSLATE)) return true;
  let current: Element | null = element.parentElement;
  while (current) {
    if (SKIP_TAGS.has(current.tagName)) return true;
    if (current.matches(NEVER_TRANSLATE)) return true;
    current = current.parentElement;
  }
  return false;
}

function parseAmount(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const amount = Number.parseFloat(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

export function AutoLocalize() {
  const { language, currency, rates, formatAmount } = useLocale();
  const textRecords = useRef(new WeakMap<Text, TextRecord>());
  const attrRecords = useRef(new WeakMap<Element, Map<string, AttrRecord>>());
  const trackedTexts = useRef(new Set<Text>());
  const trackedAttributes = useRef(new Set<Element>());
  const translationCache = useRef(new Map<string, string>());
  const queue = useRef<Job[]>([]);
  const flushing = useRef(false);
  const writing = useRef(false);
  const scanTimer = useRef<number | null>(null);
  const flushTimer = useRef<number | null>(null);

  useEffect(() => {
    const canConvertPrices = currency !== "NGN" && Boolean(rates?.[currency]);
    if ((language === "en" || language === "") && !canConvertPrices) return;

    const textMap = textRecords.current;
    const attrMap = attrRecords.current;
    const nodes = trackedTexts.current;
    const elements = trackedAttributes.current;

    function restoreAll() {
      writing.current = true;
      for (const node of nodes) {
        const record = textMap.get(node);
        if (!record) continue;
        if (node.nodeValue === record.applied) node.nodeValue = record.original;
        textMap.delete(node);
        if (!node.isConnected) nodes.delete(node);
      }
      for (const element of elements) {
        const records = attrMap.get(element);
        if (!records) continue;
        for (const [attribute, record] of records) {
          if (element.getAttribute(attribute) === record.applied) element.setAttribute(attribute, record.original);
        }
        attrMap.delete(element);
        if (!element.isConnected) elements.delete(element);
      }
      queue.current = [];
      window.setTimeout(() => { writing.current = false; }, 60);
    }

    function apply(job: Job, translated: string) {
      if (job.kind === "text") {
        if (!job.node.isConnected || job.node.nodeValue !== job.original) return;
        const lead = job.original.match(/^\s*/)?.[0] ?? "";
        const tail = job.original.match(/\s*$/)?.[0] ?? "";
        const value = `${lead}${translated}${tail}`;
        job.node.nodeValue = value;
        textMap.set(job.node, { original: job.original, applied: value });
        nodes.add(job.node);
      } else {
        if (!job.element.isConnected || job.element.getAttribute(job.attribute) !== job.original) return;
        job.element.setAttribute(job.attribute, translated);
        const records = attrMap.get(job.element) ?? new Map<string, AttrRecord>();
        records.set(job.attribute, { original: job.original, applied: translated });
        attrMap.set(job.element, records);
        elements.add(job.element);
      }
    }

    async function flush() {
      if (flushing.current) return;
      const jobs = queue.current.filter((job) => job.text.length <= 600);
      queue.current = [];
      if (!jobs.length || language === "en" || language === "") return;
      flushing.current = true;
      writing.current = true;

      const batches: Job[][] = [];
      let current: Job[] = [];
      let size = 0;
      for (const job of jobs) {
        const addition = job.text.length + 4;
        if (current.length && (current.length >= 80 || size + addition > 4_500)) {
          batches.push(current);
          current = [];
          size = 0;
        }
        current.push(job);
        size += addition;
      }
      if (current.length) batches.push(current);

      async function translateBatch(batch: Job[]) {
        const texts = [...new Set(batch.map((job) => job.text))];
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ target: language, texts }),
        });
        if (!response.ok) return;
        const result = await response.json() as { translations?: string[] };
        const translations = Array.isArray(result.translations) ? result.translations : [];
        const byText = new Map<string, string>();
        texts.forEach((text, index) => {
          const translated = translations[index];
          if (typeof translated === "string" && translated) {
            byText.set(text, translated);
            translationCache.current.set(`${language}|${text}`, translated);
          }
        });
        for (const job of batch) {
          const translated = byText.get(job.text);
          if (translated && translated !== job.text) apply(job, translated);
        }
      }

      try {
        let next = 0;
        const workers = Array.from({ length: Math.min(3, batches.length) }, async () => {
          while (next < batches.length) {
            const batch = batches[next++];
            try {
              await translateBatch(batch);
            } catch (error) {
              console.error("Could not translate a batch of this page.", error);
            }
          }
        });
        await Promise.all(workers);
      } catch (error) {
        console.error("Could not translate this page.", error);
      } finally {
        flushing.current = false;
        window.setTimeout(() => { writing.current = false; }, 40);
        if (queue.current.length) scheduleFlush(120);
      }
    }

    function scheduleFlush(delay = 260) {
      if (flushTimer.current) window.clearTimeout(flushTimer.current);
      flushTimer.current = window.setTimeout(() => {
        flushTimer.current = null;
        void flush();
      }, delay);
    }

    function scheduleScan(delay = 280) {
      if (scanTimer.current) window.clearTimeout(scanTimer.current);
      scanTimer.current = window.setTimeout(() => {
        scanTimer.current = null;
        scan(document.body);
        if (queue.current.length) scheduleFlush(120);
      }, delay);
    }

    function enqueueText(node: Text) {
      const parent = node.parentElement;
      if (!parent || skippedForText(parent)) return;
      const text = (node.nodeValue ?? "").trim();
      if (text.length < 2 || !HAS_LETTERS.test(text)) return;

      const record = textMap.get(node);
      const currentValue = node.nodeValue ?? "";
      if (record) {
        if (currentValue === record.applied) return;
        if (currentValue !== record.original) {
          record.original = currentValue;
          record.applied = "";
        }
      }

      const core = currentValue.trim();
      if (core.length < 2) return;
      if (language !== "en") {
        const cached = translationCache.current.get(`${language}|${core}`);
        if (cached) {
          apply({ kind: "text", node, original: currentValue, text: core }, cached);
          return;
        }
        queue.current.push({ kind: "text", node, original: currentValue, text: core });
      }
    }

    function localizePriceNode(node: Text) {
      const parent = node.parentElement;
      if (!parent || !parent.closest("[data-local-currency]")) return false;
      const raw = node.nodeValue ?? "";
      if (!PRICE_PATTERN.test(raw)) return false;
      if (!canConvertPrices) return false;
      const record = textMap.get(node);
      if (record && raw === record.applied) return true;
      const source = record && raw !== record.applied ? record.original : raw;
      const converted = source.replace(PRICE_PATTERN_GLOBAL, (match: string, amountText: string) => {
        const amount = parseAmount(amountText);
        if (amount === null || amount <= 0) return match;
        return formatAmount(amount) ?? match;
      });
      if (converted === source) return false;
      node.nodeValue = converted;
      textMap.set(node, { original: source, applied: converted });
      nodes.add(node);
      return true;
    }

    function enqueueAttribute(element: Element) {
      if (skippedForAttribute(element)) return;
      for (const attribute of TRANSLATE_ATTRIBUTES) {
        const value = element.getAttribute(attribute);
        if (!value || value.length < 2 || !HAS_LETTERS.test(value) || PRICE_PATTERN.test(value)) continue;
        const records = attrMap.get(element);
        const record = records?.get(attribute);
        if (record && value === record.applied) continue;
        if (record && value !== record.original) {
          record.original = value;
          record.applied = "";
        }
        if (language === "en") continue;
        const cached = translationCache.current.get(`${language}|${value}`);
        if (cached) {
          apply({ kind: "attr", element, attribute, original: value, text: value }, cached);
          continue;
        }
        queue.current.push({ kind: "attr", element, attribute, original: value, text: value });
      }
    }

    function scan(root: ParentNode) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode() as Text | null;
      while (node) {
        if (!localizePriceNode(node)) enqueueText(node);
        node = walker.nextNode() as Text | null;
      }
      const selector = TRANSLATE_ATTRIBUTES.map((attribute) => `[${attribute}]`).join(",");
      const scope = root instanceof Element ? root : document.body;
      if (scope.matches(selector)) enqueueAttribute(scope);
      for (const element of scope.querySelectorAll(selector)) enqueueAttribute(element);
    }

    restoreAll();
    const start = window.setTimeout(() => {
      scan(document.body);
      if (queue.current.length) scheduleFlush(150);
    }, 120);

    const observer = new MutationObserver(() => {
      scheduleScan(writing.current ? 500 : 250);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATE_ATTRIBUTES],
    });

    return () => {
      observer.disconnect();
      if (scanTimer.current) window.clearTimeout(scanTimer.current);
      if (flushTimer.current) window.clearTimeout(flushTimer.current);
      scanTimer.current = null;
      flushTimer.current = null;
      window.clearTimeout(start);
      restoreAll();
    };
  }, [language, currency, rates, formatAmount]);

  return null;
}
