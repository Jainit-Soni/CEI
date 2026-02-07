import { render, screen } from "@testing-library/react";
import JsonLd from "../src/components/JsonLd";

describe("JsonLd", () => {
    it("renders nothing when data is null", () => {
        const { container } = render(<JsonLd data={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("renders script tag with json data", () => {
        const data = { "@context": "https://schema.org", "@type": "Thing" };
        render(<JsonLd data={data} />);

        // Check if script tag exists with correct type
        const script = document.querySelector('script[type="application/ld+json"]');
        expect(script).toBeInTheDocument();
        expect(script.textContent).toBe(JSON.stringify(data));
    });
});
