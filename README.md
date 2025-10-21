# pansops-calculator

An opensource PANS OPS web interface for doing calculations that normally you would have on a spreadsheet

You can try it out at <https://flyght7.com/webapp/Main.html>

## Copy results: standardized behavior

All calculators that provide a "Copy Results as Table" button now copy two formats to the clipboard:

- HTML table for rich paste into Word/Google Docs
- Plain-text (tab-separated) fallback for Notepad/Excel

Labeling guidelines:

- Use proper symbols: Δ (Delta), degree °, and HTML subscripts where applicable (e.g., `T<sub>ISA</sub>` on ISA-related pages).
- Keep page-specific nomenclature intact; only adjust ISA Deviation to `T<sub>ISA</sub>`, `ΔISA`, `ISA + ΔISA`.
- Always include units in the Value column (ft, m, NM, °C, knots, etc.).

If you create a new calculator, follow the same pattern using `ClipboardItem` with both `text/html` and `text/plain` representations for best cross-application paste results.
