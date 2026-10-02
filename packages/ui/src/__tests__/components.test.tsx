import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Accordion } from "../components/core/accordion";
import { Button, buttonClasses } from "../components/core/button";
import { Card } from "../components/core/card";
import { Names } from "../components/core/names";
import { RsvpForm } from "../components/rsvp/rsvp-form";

describe("Button", () => {
  it("defaults to a primary type=button and passes props through", () => {
    const html = renderToString(<Button disabled>RSVP</Button>);
    expect(html).toContain('type="button"');
    expect(html).toContain("bg-primary");
    expect(html).toContain("disabled");
  });

  it("gives ghost tight padding instead of the size's", () => {
    const ghost = buttonClasses({ variant: "ghost", size: "md" });
    expect(ghost).toContain("px-2");
    expect(ghost).not.toContain("px-7");
    expect(buttonClasses({ size: "md" })).toContain("px-7");
  });
});

describe("Card", () => {
  it("drives padding through --card-pad", () => {
    const html = renderToString(
      <Card variant="arch" padding={28}>
        x
      </Card>,
    );
    expect(html).toContain("--card-pad:28px");
    expect(html).toContain("rounded-arch-soft");
  });
});

describe("Names", () => {
  it("sets the ampersand in italics", () => {
    const html = renderToString(<Names names="Ana & Ben" />).replaceAll("<!-- -->", "");
    expect(html).toMatch(/Ana <em[^>]*>&amp;<\/em> Ben/);
  });

  it("sets any other name as-is", () => {
    const html = renderToString(<Names names="The Wedding" />);
    expect(html).toContain("The Wedding");
    expect(html).not.toContain("<em");
  });
});

describe("Accordion", () => {
  it("renders exclusive native details with the first open", () => {
    const html = renderToString(
      <Accordion
        name="faq"
        items={[
          { question: "Q1", answer: "A1" },
          { question: "Q2", answer: "A2" },
        ]}
      />,
    );
    expect(html.match(/<details[^>]*name="faq"/g)).toHaveLength(2);
    expect(html.match(/<details[^>]*open=""/g)).toHaveLength(1);
  });
});

describe("RsvpForm", () => {
  it("renders closed, collecting nothing, without both handlers", () => {
    for (const html of [
      renderToString(<RsvpForm />),
      renderToString(<RsvpForm onLookup={async () => null} />),
    ]) {
      expect(html).toContain('role="status"');
      expect(html).toMatch(/<input[^>]*disabled=""/);
      expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Find invitation/);
    }
  });

  it("opens when both handlers are wired", () => {
    const html = renderToString(<RsvpForm onLookup={async () => null} onSubmit={() => {}} />);
    expect(html).not.toContain('role="status"');
    expect(html).not.toMatch(/<input[^>]*disabled=""/);
    expect(html).toContain("Find invitation");
  });
});
