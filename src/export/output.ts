export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const downloadText = (text: string, name: string, type = 'image/svg+xml') => downloadBlob(new Blob([text], { type }), name);

export const safeName = (s: string) => s.trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').toLowerCase() || 'drawing';

/** Rasterise a sheet SVG (sized in mm) at the given DPI. */
export async function svgToPng(svg: string, widthMm: number, heightMm: number, dpi = 200): Promise<Blob> {
  const w = Math.round((widthMm / 25.4) * dpi), h = Math.round((heightMm / 25.4) * dpi);
  const sized = svg.replace(/width="[\d.]+mm" height="[\d.]+mm"/, `width="${w}" height="${h}"`);
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('Could not render drawing'));
      img.src = url;
    });
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    g.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG export failed'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Print one or more sheets (each its own page) through a hidden iframe → "Save as PDF". */
export function printSheets(sheets: { svg: string; size: 'A3' | 'A4' }[]) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Drawings</title><style>
    @page { size: A4 landscape; margin: 0; }
    @page sheetA3 { size: A3 landscape; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .page { break-after: page; overflow: hidden; }
    .page:last-child { break-after: auto; }
    .page.A3 { page: sheetA3; width: 420mm; height: 296mm; }
    .page.A4 { width: 297mm; height: 209mm; }
    .page svg { display: block; width: 100%; height: 100%; }
  </style></head><body>${sheets.map((s) => `<div class="page ${s.size}">${s.svg}</div>`).join('')}</body></html>`;
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);
  const d = iframe.contentDocument!;
  d.open();
  d.write(html);
  d.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 60000);
  }, 300);
}
