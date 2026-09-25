// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LessonWorkspace } from "../LessonWorkspace";
import { lessonTemplates } from "../catalog";

const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/app/guides",
  useSearchParams: () => new URLSearchParams("category=system-design&format=ONE_ON_ONE"),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const template = lessonTemplates.find((item) => item.slug === "system-design")!;

describe("lesson workspace", () => {
  it("changes only the question, keeps the agenda, and closes previous interviewer hints", () => {
    const view = render(<LessonWorkspace template={template} />);
    expect(screen.queryByText(template.questions[0].clarification)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /למראיין\/ת/ }));
    expect(screen.getByText(template.questions[0].clarification)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("השאלה לתרגול"), { target: { value: "notification-service" } });
    expect(replace).toHaveBeenCalledWith("/app/guides?category=system-design&question=notification-service", { scroll: false });
    view.rerender(<LessonWorkspace template={template} questionId="notification-service" />);
    expect(screen.getByRole("heading", { name: "מערכת התראות" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "השאלה והתכנון" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /למראיין\/ת/ })).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: /למראיין\/ת/ }));
    expect(screen.getByText(template.questions[1].edgeCases[0])).toBeInTheDocument();
    expect(screen.queryByText(template.questions[0].clarification)).not.toBeInTheDocument();
  });

  it("opens a shared question URL and safely falls back for an invalid question", () => {
    const view = render(<LessonWorkspace template={template} questionId="inventory-checkout" />);
    expect(screen.getByLabelText("השאלה לתרגול")).toHaveValue("inventory-checkout");
    view.rerender(<LessonWorkspace template={template} questionId="unknown" />);
    expect(screen.getByLabelText("השאלה לתרגול")).toHaveValue("url-shortener");
  });

  it("provides a complete question-specific interviewer bank for every category", () => {
    const slugs = lessonTemplates.map((item) => item.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const lesson of lessonTemplates) {
      expect(lesson.stages.filter((stage) => stage.question)).toHaveLength(1);
      expect(lesson.questions.length).toBeGreaterThanOrEqual(2);
      expect(new Set(lesson.questions.map((q) => q.id)).size).toBe(lesson.questions.length);
      for (const question of lesson.questions) {
        expect(question.clarification.length).toBeGreaterThan(30);
        for (const bank of [question.hints, question.challenges, question.edgeCases, question.signals]) {
          expect(bank.length).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });
});
