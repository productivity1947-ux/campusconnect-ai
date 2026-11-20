type PdfReportInput = {
  title: string;
  period: string;
  generatedAt: Date;
  lines: string[];
};

function printableAscii(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapLine(value: string, width = 92) {
  const words = value.trim().split(/\s+/);
  if (!words[0]) return [""];
  const lines: string[] = [];
  let line = "";
  for (const rawWord of words) {
    let word = rawWord;
    while (word.length > width) {
      if (line) {
        lines.push(line);
        line = "";
      }
      lines.push(word.slice(0, width));
      word = word.slice(width);
    }
    if (line && `${line} ${word}`.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function textCommand(text: string, x: number, y: number, size: number, font = "F1") {
  return `BT /${font} ${size} Tf ${x} ${y} Td (${printableAscii(text)}) Tj ET\n`;
}

export function createAdminReportPdf(input: PdfReportInput) {
  const bodyLines = input.lines.flatMap((line) => wrapLine(line));
  const linesPerPage = 44;
  const pageCount = Math.max(1, Math.ceil(bodyLines.length / linesPerPage));
  const generated = input.generatedAt.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const objects: Buffer[] = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "ascii"),
    Buffer.alloc(0),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "ascii"),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>", "ascii"),
  ];
  const pageIds: number[] = [];

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const pageId = objects.length + 1;
    const contentId = pageId + 1;
    pageIds.push(pageId);

    let content = "0.055 0.12 0.24 rg 0 730 612 62 re f\n";
    content += `1 1 1 rg\n${textCommand("CampusConnect AI", 44, 767, 18, "F2")}`;
    content += `${textCommand(input.title, 44, 745, 12, "F2")}`;
    content += `0 0 0 rg\n${textCommand(input.period, 44, 711, 9)}`;
    content += `${textCommand(`Generated ${generated}`, 44, 696, 8)}`;
    content += "0.75 0.79 0.84 RG 44 684 m 568 684 l S\n";

    const start = pageIndex * linesPerPage;
    const pageLines = bodyLines.slice(start, start + linesPerPage);
    pageLines.forEach((line, index) => {
      content += textCommand(line, 44, 666 - index * 13, 9);
    });
    content += `0.35 0.39 0.45 rg\n${textCommand(`Page ${pageIndex + 1} of ${pageCount}`, 500, 28, 8)}`;

    const contentBuffer = Buffer.from(content, "ascii");
    objects.push(
      Buffer.from(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
        "ascii",
      ),
      Buffer.concat([
        Buffer.from(`<< /Length ${contentBuffer.length} >>\nstream\n`, "ascii"),
        contentBuffer,
        Buffer.from("endstream", "ascii"),
      ]),
    );
  }

  objects[1] = Buffer.from(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`,
    "ascii",
  );

  const chunks = [Buffer.from("%PDF-1.4\n", "ascii")];
  const offsets = [0];
  let length = chunks[0].length;
  objects.forEach((body, index) => {
    offsets.push(length);
    const object = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`, "ascii"),
      body,
      Buffer.from("\nendobj\n", "ascii"),
    ]);
    chunks.push(object);
    length += object.length;
  });

  const xrefOffset = length;
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    "0000000000 65535 f \n",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  ].join("");
  chunks.push(Buffer.from(xref, "ascii"));
  return Buffer.concat(chunks);
}
