import { useEffect, useState } from "react";
import { LOCALE_KEY, savedLocale, translateCopy, type Locale } from "./i18n";
import "./language-switcher.css";

type OriginalText = { ko: string; en: string };
const texts = new WeakMap<Text, OriginalText>();
const attributes = new WeakMap<Element, Map<string, OriginalText>>();
const translatedAttributes = ["aria-label", "placeholder", "title"];

function updateText(node: Text, locale: Locale) {
  if (node.parentElement?.closest("[data-i18n-ignore], script, style, textarea, [contenteditable]")) return;
  const current = node.nodeValue ?? "";
  const previous = texts.get(node);
  if (locale === "ko") {
    if (previous && current === previous.en) node.nodeValue = previous.ko;
    return;
  }
  if (previous?.en === current) return;
  const translated = translateCopy(current);
  if (translated !== current) {
    texts.set(node, { ko: current, en: translated });
    node.nodeValue = translated;
  }
}

function updateElement(element: Element, locale: Locale) {
  if (element.closest("[data-i18n-ignore]")) return;
  let entries = attributes.get(element);
  if (!entries) { entries = new Map(); attributes.set(element, entries); }
  for (const name of translatedAttributes) {
    const current = element.getAttribute(name);
    if (current === null) continue;
    const previous = entries.get(name);
    if (locale === "ko") {
      if (previous && current === previous.en) element.setAttribute(name, previous.ko);
    } else if (current !== previous?.en) {
      const translated = translateCopy(current);
      if (translated !== current) {
        entries.set(name, { ko: current, en: translated });
        element.setAttribute(name, translated);
      }
    }
  }
}

function localize(root: Node, locale: Locale) {
  if (root.nodeType === Node.TEXT_NODE) { updateText(root as Text, locale); return; }
  if (!(root instanceof Element)) return;
  updateElement(root, locale);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (walker.currentNode.nodeType === Node.TEXT_NODE) updateText(walker.currentNode as Text, locale);
    else updateElement(walker.currentNode as Element, locale);
  }
}

export default function LanguageSwitcher() {
  const [locale, setLocale] = useState<Locale>(savedLocale);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === LOCALE_KEY) setLocale(savedLocale());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = locale === "en" ? "SweetHome | Before changing policy" : "SweetHome | 정책을 바꾸기 전에";
    // Tooltips and dialogs can be portaled outside #root.
    const root = document.body;
    localize(root, locale);
    const observer = new MutationObserver(records => {
      observer.disconnect();
      for (const record of records) {
        if (record.type === "characterData") localize(record.target, locale);
        else if (record.type === "attributes") localize(record.target, locale);
        else for (const node of record.addedNodes) localize(node, locale);
      }
      observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: translatedAttributes });
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: translatedAttributes });
    return () => observer.disconnect();
  }, [locale]);

  function choose(next: Locale) {
    try { localStorage.setItem(LOCALE_KEY, next); } catch { /* private browsing still supports this session */ }
    window.dispatchEvent(new CustomEvent("sweethome:locale", { detail: next }));
    setLocale(next);
  }

  return <div className="language-switcher" data-i18n-ignore role="group" aria-label="Language / 언어">
    <button type="button" aria-pressed={locale === "en"} onClick={() => choose("en")}>EN</button>
    <button type="button" aria-pressed={locale === "ko"} onClick={() => choose("ko")}>한국어</button>
  </div>;
}
