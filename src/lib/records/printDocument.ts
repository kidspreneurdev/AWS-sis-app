// Opens a generated record document in a standalone window sized for A4 and
// triggers the browser's print / "Save as PDF" dialog. Mirrors the popup-print
// pattern used by ReportCardsPage / GradesHSPage.
//
// `@page { margin: 0 }` suppresses the browser's own header/footer (timestamp,
// document title, URL, page numbers). To still get consistent top/bottom
// breathing room on EVERY printed page — not just the first and last — the
// document is wrapped in a table whose <thead>/<tfoot> repeat on each page and
// reserve a fixed vertical band. Side margins come from the document's own
// horizontal padding. `outerHTML` is serialised so the component's root
// width/padding survive into the print window.

export function printDocument(node: HTMLElement | null, title: string) {
  if (!node) return
  const win = window.open('', '_blank', 'width=900,height=1000,scrollbars=yes,resizable=yes')
  if (!win) {
    alert('Please allow pop-ups for this site to print the document.')
    return
  }

  const doc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<base href="${window.location.origin}/" />
<title>${title.replace(/[<>&]/g, '')}</title>
<style>
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { background: #e9ecf1; font-family: Georgia, "Times New Roman", serif; }

  .toolbar {
    position: sticky; top: 0; z-index: 10; display: flex; gap: 10px; justify-content: center;
    padding: 12px; background: #0F2240;
  }
  .toolbar button {
    padding: 8px 20px; border: none; border-radius: 8px; font-size: 13px; font-weight: 700;
    cursor: pointer; background: #D61F31; color: #fff; font-family: system-ui, sans-serif;
  }

  /* Page-frame table: thead / tfoot repeat on every printed page and reserve a
     fixed top/bottom band (so overflow sheets still get margins). On screen the
     bands collapse and the document's own .cc-page cards provide the layout. */
  .print-sheet { width: 210mm; border-collapse: collapse; margin: 24px auto 0; background: transparent; }
  .print-sheet td { padding: 0; }
  .print-sheet .edge { height: 0; }

  @media print {
    @page { size: A4; margin: 0; }
    body { background: #fff; }
    .toolbar { display: none !important; }
    .print-sheet { width: 100%; margin: 0; }
    .print-sheet .edge { height: 16mm; }
    .cc-document { width: auto !important; }
    .cc-page {
      width: auto !important; min-height: 0 !important;
      padding: 0 16mm !important; margin: 0 !important; box-shadow: none !important;
    }
    .cc-page + .cc-page { break-before: page; page-break-before: always; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">Print / Save as PDF</button>
    <button onclick="window.close()" style="background:#334155">Close</button>
  </div>

  <table class="print-sheet">
    <thead><tr><td><div class="edge"></div></td></tr></thead>
    <tfoot><tr><td><div class="edge"></div></td></tr></tfoot>
    <tbody><tr><td>${node.outerHTML}</td></tr></tbody>
  </table>

  <script>window.addEventListener('load', function () { setTimeout(function () { window.focus(); window.print(); }, 400); });</script>
</body>
</html>`

  win.document.open()
  win.document.write(doc)
  win.document.close()
}
