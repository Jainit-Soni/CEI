import { sanitize } from "../src/lib/sanitize";

describe("sanitize", () => {
    it("removes script tags", () => {
        const malicious = '<script>alert("xss")</script>Hello';
        expect(sanitize(malicious)).toBe("Hello");
    });

    it("removes specific attributes like onclick", () => {
        const malicious = '<div onclick="steal()">Click me</div>';
        expect(sanitize(malicious)).toBe("<div>Click me</div>");
    });

    it("preserves safe html", () => {
        const safe = "<b>Bold</b>";
        expect(sanitize(safe)).toBe("<b>Bold</b>");
    });

    it("returns non-string usage as is", () => {
        expect(sanitize(123)).toBe(123);
        expect(sanitize(null)).toBe(null);
    });
});
