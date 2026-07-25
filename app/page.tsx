"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";

type Currency = "USD" | "EUR" | "GBP" | "TRY";
type Priority = "high" | "medium" | "low";
type Analysis = {
  title: string; translatedSummary: string; originalPrice: string; originalCurrency: string; convertedPrice: string; preferredCurrency: Currency; exchangeRateTimestamp: string | null;
  location: string; distance: string; estimatedTravelTime: string; sellerType: string; recommendation: "BUY" | "INVESTIGATE" | "NEGOTIATE" | "PASS"; recommendationHeadline: string; recommendationReason: string; nextBestAction: string;
  purchaseType: string; pickupRequired: string; deliveryMentioned: string; likelyVehicleNeeded: string; likelyPeopleNeeded: string; paymentTerms: string; specialRequirements: string; logisticsConfidence: number;
  keyDetails: string[]; redFlags: string[]; sellerQuestions: { question: string; reason: string; priority: Priority; turkish: string }[]; overallConfidence: number; confidenceReasons: { label: string; status: "confirmed" | "warning" | "unavailable"; explanation: string }[]; accessWarning: string; screenshotsAnalyzed: number; missingInformation: string[]; sourceCompleteness: string;
};

type SelectedScreenshot = { id: string; name: string; size: number; dataUrl: string };

const MAX_SCREENSHOTS = 8;
const MAX_SCREENSHOT_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_SCREENSHOT_SIZE = 30 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/heic"];

const currencies: Currency[] = ["USD", "EUR", "GBP", "TRY"];
const recommendationCopy: Record<Analysis["recommendation"], { label: string; tone: string }> = {
  BUY: { label: "Worth pursuing", tone: "bg-[#e7f3e8] text-[#2f6b3c]" },
  INVESTIGATE: { label: "Proceed carefully", tone: "bg-[#fff5dc] text-[#88641a]" },
  NEGOTIATE: { label: "Negotiate first", tone: "bg-[#e9f0f6] text-[#3b617f]" },
  PASS: { label: "Pass on this listing", tone: "bg-[#fff0ec] text-[#9b5146]" },
};

function valueOr(value: string | null | undefined, fallback: string) { return value && value.trim() ? value : fallback; }
function localeCurrency(): Currency { if (typeof navigator === "undefined") return "USD"; const locale = navigator.language.toUpperCase(); if (locale.includes("TR")) return "TRY"; if (locale.includes("GB")) return "GBP"; if (locale.includes("DE") || locale.includes("FR") || locale.includes("ES") || locale.includes("IT")) return "EUR"; return "USD"; }

export default function Home() {
  const [marketplaceLink, setMarketplaceLink] = useState("");
  const [pageText, setPageText] = useState("");
  const [screenshots, setScreenshots] = useState<SelectedScreenshot[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [preferredCurrency, setPreferredCurrency] = useState<Currency>("USD");
  const [startCity, setStartCity] = useState("");
  const [startCoordinates, setStartCoordinates] = useState<{ latitude: number; longitude: number }>();
  const [locationStatus, setLocationStatus] = useState("");
  const resultsRef = useRef<HTMLElement>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => setPreferredCurrency(localeCurrency()), []);

  function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    let availableBytes = MAX_TOTAL_SCREENSHOT_SIZE - screenshots.reduce((total, screenshot) => total + screenshot.size, 0);
    if (screenshots.length + files.length > MAX_SCREENSHOTS) { setError(`You can analyze up to ${MAX_SCREENSHOTS} screenshots at once.`); }
    files.slice(0, Math.max(0, MAX_SCREENSHOTS - screenshots.length)).forEach((file) => {
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) { setError(`${file.name} is not supported. Upload a JPEG, PNG, WebP, or HEIC image.`); return; }
      if (file.size > MAX_SCREENSHOT_SIZE) { setError(`${file.name} is larger than 10 MB. Choose a smaller image.`); return; }
      if (file.size > availableBytes) { setError("The screenshots are larger than 30 MB together. Remove one or choose smaller images."); return; }
      availableBytes -= file.size;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        if (dataUrl) setScreenshots((current) => current.length >= MAX_SCREENSHOTS ? current : [...current, { id: `${file.name}-${file.lastModified}-${Math.random()}`, name: file.name, size: file.size, dataUrl }]);
      };
      reader.readAsDataURL(file);
    });
  }
  function handleDrop(event: DragEvent<HTMLLabelElement>) { event.preventDefault(); setIsDragging(false); handleFiles(event.dataTransfer.files); }
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) { if (event.target.files) handleFiles(event.target.files); event.target.value = ""; }
  function useMyLocation() {
    if (!navigator.geolocation) { setLocationStatus("Location is unavailable in this browser. Enter a starting city instead."); return; }
    setLocationStatus("Requesting your location...");
    navigator.geolocation.getCurrentPosition((position) => { setStartCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude }); setStartCity(""); setLocationStatus("Location ready for an approximate travel estimate."); }, () => setLocationStatus("We could not access your location. Enter a starting city instead."), { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
  }
  async function analyzeListing() {
    if (!marketplaceLink.trim() && !pageText.trim() && !screenshots.length) { setError("Add a marketplace link, paste listing text, or upload a screenshot first."); return; }
    setIsLoading(true); setError(""); setAnalysis(null);
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marketplaceLink, pageText, imageDataUrls: screenshots.map((screenshot) => screenshot.dataUrl), preferredCurrency, startCity, startCoordinates }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Analysis failed. Check the listing and try again.");
      setAnalysis(result as Analysis);
      requestAnimationFrame(() => { resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); window.setTimeout(() => resultsHeadingRef.current?.focus(), 450); });
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Analysis failed. Try again."); }
    finally { setIsLoading(false); }
  }
  function retry() { setError(""); analyzeListing(); }

  return (
    <main className="min-h-screen overflow-hidden px-5 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-[1380px] flex-col rounded-[28px] border border-white/70 bg-[#f8f7f3]/90 shadow-[0_20px_80px_rgba(44,52,42,0.08)] backdrop-blur sm:min-h-[calc(100vh-4rem)]">
        <header className="flex items-center justify-between border-b border-[#d9ddd4] px-6 py-5 sm:px-10"><a className="flex items-center gap-3" href="#top" aria-label="FlipLens home"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e8f1e6] text-lg font-bold text-[#315b3c]">F</span><span className="font-display text-xl font-semibold tracking-[-0.03em] text-[#26342a]">FlipLens</span></a><span className="hidden items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[#7b887d] sm:flex"><span className="h-2 w-2 rounded-full bg-[#72a17c]" /> Marketplace intelligence</span></header>
        <section id="top" className="grid flex-1 content-center gap-14 px-6 py-16 sm:px-14 lg:grid-cols-[minmax(0,1fr)_460px] lg:gap-20 lg:px-24 lg:py-20">
          <div className="max-w-[650px] self-center"><p className="mb-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#66846d]"><span className="h-px w-8 bg-[#66846d]" /> Your secondhand sidekick</p><h1 className="font-display max-w-2xl text-[clamp(3.6rem,8vw,7.5rem)] font-semibold leading-[0.88] tracking-[-0.075em] text-[#26342a]">FlipLens<span className="text-[#7eaa84]">.</span></h1><p className="mt-8 max-w-lg text-xl leading-relaxed text-[#647066] sm:text-2xl">Understand any marketplace listing instantly.</p></div>
          <div className="relative self-center"><div className="absolute -inset-5 -z-10 rounded-[40px] bg-[#e4eee1]/70 blur-2xl" /><div className="rounded-[24px] border border-[#dfe5dc] bg-white/80 p-5 shadow-[0_16px_45px_rgba(54,70,54,0.09)] sm:p-7">
            <div className="mb-7 flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829083]">Start an analysis</p><h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.04em] text-[#26342a]">What are you looking at?</h2></div><span className="rounded-full bg-[#f0f5ed] px-3 py-1 text-[11px] font-medium text-[#66846d]">Beta</span></div>
            <fieldset disabled={isLoading} className="min-w-0 border-0 p-0 disabled:opacity-70"><label className="block text-sm font-semibold text-[#3a493d]" htmlFor="marketplace-link">Paste Marketplace Link<div className="mt-2 flex items-center rounded-xl border border-[#d6ded4] bg-[#fbfcfa] focus-within:border-[#78a87f] focus-within:ring-4 focus-within:ring-[#e8f1e6]"><span className="pl-4 text-[#8b988d]">↗</span><input id="marketplace-link" type="url" value={marketplaceLink} onChange={(event) => setMarketplaceLink(event.target.value)} placeholder="https://marketplace.com/listing..." className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-sm text-[#26342a] outline-none placeholder:text-[#a7b1a8]" /></div><span className="mt-2 block text-[11px] font-normal text-[#99a49a]">Optional: paste visible page text if the marketplace is behind a login.</span><textarea aria-label="Optional marketplace page text" value={pageText} onChange={(event) => setPageText(event.target.value)} placeholder="Optional listing text..." rows={2} className="mt-2 w-full resize-none rounded-xl border border-[#d6ded4] bg-[#fbfcfa] px-4 py-3 text-sm font-normal text-[#26342a] outline-none placeholder:text-[#a7b1a8]" /></label>
              <div className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a2aca3]"><span className="h-px flex-1 bg-[#e4e9e2]" /> or <span className="h-px flex-1 bg-[#e4e9e2]" /></div>
              <label htmlFor="listing-screenshot" onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} className={`block cursor-pointer rounded-xl border border-dashed p-6 text-center ${isDragging ? "border-[#5f9369] bg-[#eef6eb]" : "border-[#cbd8c9] bg-[#f7faf5] hover:border-[#82aa88]"}`}><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl text-[#6c9772] shadow-sm">↑</span><span className="mt-3 block text-sm font-semibold text-[#425345]">Upload Screenshots</span><span className="mt-1 block text-xs text-[#89968b]">Drop images here, or browse · JPEG, PNG, WebP, HEIC · max 10 MB each / 30 MB total</span><input id="listing-screenshot" type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" onChange={handleFileChange} /></label>
              {screenshots.length > 0 && <div className="mt-3"><p className="text-xs font-semibold text-[#54715b]">{screenshots.length} screenshot{screenshots.length === 1 ? "" : "s"} selected</p><div className="mt-2 grid grid-cols-4 gap-2">{screenshots.map((screenshot, index) => <div key={screenshot.id} className="relative aspect-square overflow-hidden rounded-lg border border-[#d6ded4] bg-[#f1f5ef]"><img src={screenshot.dataUrl} alt={`Listing screenshot ${index + 1}: ${screenshot.name}`} className="h-full w-full object-cover" /><button type="button" aria-label={`Remove ${screenshot.name}`} onClick={() => setScreenshots((current) => current.filter((item) => item.id !== screenshot.id))} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#26342a]/80 text-sm text-white hover:bg-[#26342a]">×</button><span className="absolute bottom-1 left-1 rounded bg-[#26342a]/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">{index + 1}</span></div>)}</div></div>}
              <div className="mt-5 grid grid-cols-[1fr_auto] gap-2"><label className="text-xs font-semibold text-[#3a493d]">Preferred currency<select value={preferredCurrency} onChange={(event) => setPreferredCurrency(event.target.value as Currency)} className="mt-2 block w-full rounded-xl border border-[#d6ded4] bg-[#fbfcfa] px-3 py-3 text-sm font-normal outline-none">{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label><div className="flex items-end"><button type="button" onClick={useMyLocation} className="rounded-xl border border-[#cbd8c9] px-3 py-3 text-xs font-semibold text-[#54715b] hover:bg-[#eef6eb]">Use my location</button></div></div>
              <label className="mt-4 block text-xs font-semibold text-[#3a493d]">Starting city <input value={startCity} onChange={(event) => { setStartCity(event.target.value); setStartCoordinates(undefined); }} placeholder="Optional, e.g. Istanbul" className="mt-2 block w-full rounded-xl border border-[#d6ded4] bg-[#fbfcfa] px-4 py-3 text-sm font-normal outline-none" /></label>{locationStatus && <p className="mt-2 text-[11px] text-[#7b887d]">{locationStatus}</p>}
              <button type="button" onClick={analyzeListing} disabled={isLoading} className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-[#376c45] px-5 py-4 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(55,108,69,0.2)] hover:bg-[#2d5d3a] disabled:cursor-wait disabled:opacity-70">{isLoading ? (screenshots.length > 0 ? `Analyzing ${screenshots.length} screenshot${screenshots.length === 1 ? "" : "s"}…` : "Reading listing…") : "Analyze Listing"}{isLoading ? <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <span aria-hidden="true" className="text-lg">→</span>}</button>
            </fieldset><p className="mt-4 text-center text-[11px] text-[#a0aaa1]">No account needed · Inputs are processed by Google Gemini and mapping providers</p>
          </div></div>
        </section>

        {error && <section className="px-6 pb-8 sm:px-14 lg:px-24"><div role="alert" className="rounded-2xl border border-[#ecd5cb] bg-[#fff5f1] p-5 text-sm text-[#925348]"><p className="font-semibold">We could not complete that analysis.</p><p className="mt-1 leading-relaxed">{error}</p><button type="button" onClick={retry} className="mt-4 rounded-lg bg-[#925348] px-4 py-2 text-xs font-semibold text-white">Try again</button></div></section>}

        {analysis && <Results analysis={analysis} resultsRef={resultsRef} headingRef={resultsHeadingRef} onBackToTop={() => document.getElementById("top")?.scrollIntoView({ behavior: "smooth" })} />}
        <footer className="flex flex-col gap-2 border-t border-[#d9ddd4] px-6 py-5 text-xs text-[#8a968c] sm:flex-row sm:items-center sm:justify-between sm:px-10"><span>Make the next good deal a little clearer. Location data © <a className="underline hover:text-[#536155]" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>.</span><span className="font-medium text-[#6c7b6e]">FlipLens © 2026</span></footer>
      </div>
    </main>
  );
}

function Results({ analysis, resultsRef, headingRef, onBackToTop }: { analysis: Analysis; resultsRef: React.RefObject<HTMLElement | null>; headingRef: React.RefObject<HTMLHeadingElement | null>; onBackToTop: () => void }) {
  const recommendation = recommendationCopy[analysis.recommendation];
  const highQuestions = [...analysis.sellerQuestions].sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - ({ high: 0, medium: 1, low: 2 }[b.priority])));
  return <section ref={resultsRef} aria-live="polite" className="scroll-mt-6 border-t border-[#d9ddd4] px-6 py-14 sm:px-14 lg:px-24">
    <div role="status" aria-live="polite" className="mb-6 flex items-center gap-3 rounded-xl border border-[#cfe2d0] bg-[#eef8ed] px-4 py-3 text-sm font-semibold text-[#386b42]"><span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d5ead5] text-[#386b42]">✓</span><span>Analysis complete — here’s what FlipLens found.</span></div>
    {analysis.accessWarning && <p role="status" className="mb-6 rounded-xl border border-[#ecd5cb] bg-[#fff5f1] px-4 py-3 text-sm font-medium text-[#925348]">{analysis.accessWarning}</p>}
    <div className="mb-6 rounded-xl border border-[#e0e6de] bg-white/70 px-4 py-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#77867a]">Sources used</p><p className="text-sm font-semibold text-[#405044]">{valueOr(analysis.sourceCompleteness, "Source coverage unavailable")}</p></div><p className="mt-2 text-xs text-[#728074]">{analysis.screenshotsAnalyzed > 0 ? `${analysis.screenshotsAnalyzed} screenshot${analysis.screenshotsAnalyzed === 1 ? "" : "s"} analyzed` : "No screenshots analyzed"}</p>{analysis.missingInformation.length > 0 && <p className="mt-1 text-xs text-[#925348]">{analysis.missingInformation.join(" · ")}</p>}</div>
    <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#66846d]">Listing readout</p><h2 ref={headingRef} tabIndex={-1} className="mt-2 font-display text-3xl font-semibold tracking-[-0.05em] text-[#26342a] outline-none">{valueOr(analysis.title, "Listing analysis")}</h2></div><span className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${recommendation.tone}`}>{recommendation.label}</span></div>
    <div className="mb-4 rounded-2xl border border-[#bed8c1] bg-[#e9f5e8] p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6c8a71]">Recommendation</p><h3 className="mt-2 font-display text-2xl font-semibold tracking-[-0.04em] text-[#315b3c]">{valueOr(analysis.recommendationHeadline, recommendation.label)}</h3></div><span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-[#47734f]">{analysis.recommendation}</span></div><p className="mt-4 leading-relaxed text-[#405345]">{valueOr(analysis.recommendationReason, "Review the evidence and confirm missing details with the seller.")}</p><p className="mt-4 border-t border-[#d0e4cf] pt-4 text-sm font-semibold text-[#315b3c]">Next best action: <span className="font-normal">{valueOr(analysis.nextBestAction, "Ask the seller for the missing details before deciding.")}</span></p></div>
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]"><div className="rounded-2xl bg-[#eef5eb] p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6c8a71]">Plain English summary</p><p className="mt-3 leading-relaxed text-[#405345]">{valueOr(analysis.translatedSummary, "A plain-English summary was not available.")}</p></div><div className="grid grid-cols-2 gap-3">{[["Original price", `${valueOr(analysis.originalPrice, "Price not provided by seller")} ${analysis.originalCurrency || ""}`], ["Converted price", valueOr(analysis.convertedPrice, "Currency conversion unavailable")], ["Location", valueOr(analysis.location, "Location could not be verified")], ["Travel", `${valueOr(analysis.distance, "Travel estimate unavailable")} · ${valueOr(analysis.estimatedTravelTime, "Travel estimate unavailable")}`], ["Seller", valueOr(analysis.sellerType, "Seller type could not be verified")], ["Rate updated", analysis.exchangeRateTimestamp ? new Date(analysis.exchangeRateTimestamp).toLocaleString() : "Currency conversion unavailable"]].map(([label, value]) => <div key={label} className="rounded-2xl border border-[#e0e6de] bg-white/70 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#91a093]">{label}</p><p className="mt-2 text-sm leading-snug text-[#405044]">{value}</p></div>)}</div></div>
    <div className="mt-4 rounded-2xl border border-[#e0e6de] bg-white/60 p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#77867a]">Confidence</p><p className="mt-1 font-display text-3xl font-semibold text-[#315b3c]">{analysis.overallConfidence}%</p></div><span className="text-xs text-[#819084]">Why this score</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{analysis.confidenceReasons.map((reason) => <div key={`${reason.label}-${reason.explanation}`} className="flex gap-3 text-sm"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${reason.status === "confirmed" ? "bg-[#6eaa78]" : reason.status === "warning" ? "bg-[#d4a64e]" : "bg-[#a6b0a7]"}`} /><span><strong className="font-semibold text-[#405044]">{reason.label}</strong><br /><span className="text-[#728074]">{reason.explanation}</span></span></div>)}</div></div>
    <div className="mt-4 grid gap-4 md:grid-cols-2"><InfoCard title="Purchase & pickup" items={[`Type: ${analysis.purchaseType}`, `Pickup: ${analysis.pickupRequired}`, `Delivery: ${analysis.deliveryMentioned}`, `Vehicle: ${analysis.likelyVehicleNeeded}`, `People: ${analysis.likelyPeopleNeeded}`, `Payment: ${analysis.paymentTerms}`, `Special requirements: ${analysis.specialRequirements}`, `Logistics confidence: ${analysis.logisticsConfidence}%`]} /><InfoCard title="Key details" items={analysis.keyDetails} /></div>
    <div className="mt-4 grid gap-4 md:grid-cols-2"><InfoCard title="Red flags" items={analysis.redFlags} warm /><div className="rounded-2xl bg-[#f2f5f0] p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#77867a]">Questions for the seller</p><div className="mt-3 space-y-4">{highQuestions.map((item) => <div key={item.question}><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${item.priority === "high" ? "bg-[#ffe1d8] text-[#9b5146]" : "bg-white text-[#728074]"}`}>{item.priority}</span><p className="text-sm font-semibold text-[#405044]">{item.question}</p></div><p className="mt-1 text-xs text-[#7b887d]">{item.reason}</p><p className="mt-1 text-sm text-[#54715b]">Türkçe: {item.turkish}</p></div>)}</div></div></div>
    <button type="button" onClick={onBackToTop} className="mt-8 rounded-xl border border-[#cbd8c9] px-4 py-3 text-sm font-semibold text-[#54715b] hover:bg-[#eef6eb]">Back to top ↑</button>
  </section>;
}

function InfoCard({ title, items, warm = false }: { title: string; items: string[]; warm?: boolean }) { return <div className={`rounded-2xl p-5 ${warm ? "bg-[#fff3ef]" : "bg-[#f8f8f2]"}`}><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#77867a]">{title}</p><ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#536155]">{(items.length ? items : ["No additional details were provided by the listing."]).map((item) => <li key={item} className="flex gap-2"><span className="text-[#79a17d]">•</span><span>{valueOr(item, "Detail unavailable")}</span></li>)}</ul></div>; }
