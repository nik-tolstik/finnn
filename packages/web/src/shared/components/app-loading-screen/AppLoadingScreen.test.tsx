import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppLoadingScreen } from "./AppLoadingScreen";
import { SvgPathAssemblySplash, SvgPathDrawSplash, SvgPathPulseSplash } from "./AppLoadingScreenConcepts";

describe("AppLoadingScreen", () => {
  it("announces the default loading state while keeping the animation decorative", () => {
    const markup = renderToStaticMarkup(createElement(AppLoadingScreen));

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("Загрузка...");
    expect(markup).not.toContain(">Finnn<");
  });

  it("announces a custom loading label", () => {
    const markup = renderToStaticMarkup(createElement(AppLoadingScreen, { label: "Открываем пространство..." }));

    expect(markup).toContain("Открываем пространство...");
  });
});

describe("AppLoadingScreen SVG concepts", () => {
  it.each([
    SvgPathDrawSplash,
    SvgPathAssemblySplash,
    SvgPathPulseSplash,
  ])("animates the original SVG nodes in %s", (Concept) => {
    const markup = renderToStaticMarkup(createElement(Concept));

    expect(markup).toContain("<svg");
    expect(markup).toContain("<rect");
    expect(markup.match(/<path /g)).toHaveLength(2);
    expect(markup).not.toContain("<img");
    expect(markup).not.toContain("mask");
  });
});
