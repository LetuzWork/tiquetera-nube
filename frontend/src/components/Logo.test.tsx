import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "./Logo";

describe("Logo", () => {
  it("RF-16: muestra el nombre 'Tiquetera Nube'", () => {
    render(<Logo />);
    expect(screen.getByText("Tiquetera Nube")).toBeInTheDocument();
  });

  it("RF-16: el anillo a tres cuartos es un SVG decorativo en currentColor", () => {
    const { container } = render(<Logo />);
    const anillo = container.querySelector('[aria-hidden="true"]');
    expect(anillo?.tagName.toLowerCase()).toBe("svg");
    expect(anillo).toHaveAttribute("viewBox", "0 0 36 36");
    const trazo = anillo?.firstElementChild;
    expect(trazo).toHaveAttribute("d", "M18 3.5A14.5 14.5 0 1 1 3.5 18");
    expect(trazo).toHaveAttribute("fill", "none");
    expect(trazo).toHaveAttribute("stroke", "currentColor");
    expect(trazo).toHaveAttribute("stroke-width", "5");
  });

  it("lo único que se lee es el nombre", () => {
    const { container } = render(<Logo />);
    expect(container.textContent).toBe("Tiquetera Nube");
  });
});
