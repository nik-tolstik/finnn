import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppLoadingScreen } from "./AppLoadingScreen";

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
