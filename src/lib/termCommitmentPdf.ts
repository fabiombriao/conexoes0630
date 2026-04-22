import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 48;
const CONTENT_WIDTH = A4_WIDTH - PAGE_MARGIN * 2;
const BOTTOM_GUARD = 72;

type BuildPdfArgs = {
  title: string;
  contentMarkdown: string;
  signerName: string;
  cpf: string;
  signatureDataUrl: string;
  signedAt: string;
};

const wrapText = (text: string, font: PDFFont, size: number, maxWidth: number) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
};

const normalizeMarkdownLine = (line: string) => line.replace(/\s+/g, " ").trim();
const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

export async function buildTermCommitmentPdf({
  title,
  contentMarkdown,
  signerName,
  cpf,
  signatureDataUrl,
  signedAt,
}: BuildPdfArgs) {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let currentPage: PDFPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  let y = A4_HEIGHT - PAGE_MARGIN;

  currentPage.drawText("CONEXÃO 6:30", {
    x: PAGE_MARGIN,
    y,
    size: 13,
    font: bold,
    color: rgb(0.98, 0.42, 0),
  });
  y -= 20;

  currentPage.drawText(title, {
    x: PAGE_MARGIN,
    y,
    size: 18,
    font: bold,
    color: rgb(0.12, 0.12, 0.12),
  });
  y -= 18;

  currentPage.drawText("Termo assinado digitalmente", {
    x: PAGE_MARGIN,
    y,
    size: 10,
    font: regular,
    color: rgb(0.35, 0.35, 0.35),
  });
  y -= 28;

  const contentLines = contentMarkdown.split(/\r?\n/);
  for (const rawLine of contentLines) {
    const line = normalizeMarkdownLine(rawLine);

    if (!line || line === normalizeWhitespace(title)) {
      y -= 10;
      continue;
    }

    const isHeading = /^#{1,3}\s+/.test(rawLine);
    const isBullet = /^[-*]\s+/.test(rawLine);
    const preparedLine = rawLine.replace(/^#{1,3}\s+/, "").replace(/^[-*]\s+/, "");
    const font = isHeading ? bold : regular;
    const size = isHeading ? 12 : 10;
    const indent = isBullet ? 14 : 0;
    const x = PAGE_MARGIN + indent;
    const maxWidth = CONTENT_WIDTH - indent;
    const lineGap = 5;
    const lines = wrapText(preparedLine, font, size, maxWidth);

    for (const wrappedLine of lines) {
      if (y < PAGE_MARGIN + BOTTOM_GUARD) {
        currentPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
        y = A4_HEIGHT - PAGE_MARGIN;
      }

      if (isBullet) {
        currentPage.drawText("•", {
          x: PAGE_MARGIN,
          y,
          size,
          font,
          color: rgb(0.25, 0.25, 0.25),
        });
      }

      currentPage.drawText(wrappedLine, {
        x,
        y,
        size,
        font,
        color: isHeading ? rgb(0.1, 0.1, 0.1) : rgb(0.2, 0.2, 0.2),
      });
      y -= size + lineGap;
    }
  }

  if (y < PAGE_MARGIN + 180) {
    currentPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    y = A4_HEIGHT - PAGE_MARGIN;
  } else {
    y -= 10;
  }

  currentPage.drawText("Assinatura do membro", {
    x: PAGE_MARGIN,
    y,
    size: 12,
    font: bold,
    color: rgb(0.12, 0.12, 0.12),
  });
  y -= 20;

  currentPage.drawText(`Nome: ${signerName}`, {
    x: PAGE_MARGIN,
    y,
    size: 10,
    font: regular,
    color: rgb(0.22, 0.22, 0.22),
  });
  y -= 14;

  currentPage.drawText(`CPF: ${cpf}`, {
    x: PAGE_MARGIN,
    y,
    size: 10,
    font: regular,
    color: rgb(0.22, 0.22, 0.22),
  });
  y -= 14;

  currentPage.drawText(`Assinado em: ${signedAt}`, {
    x: PAGE_MARGIN,
    y,
    size: 10,
    font: regular,
    color: rgb(0.22, 0.22, 0.22),
  });
  y -= 18;

  const signatureImageBytes = await fetch(signatureDataUrl).then((response) => response.arrayBuffer());
  const embeddedSignature = await pdfDoc.embedPng(signatureImageBytes);
  const signatureDims = embeddedSignature.scale(0.55);

  currentPage.drawRectangle({
    x: PAGE_MARGIN,
    y: y - 8,
    width: Math.max(signatureDims.width + 24, 260),
    height: Math.max(signatureDims.height + 24, 100),
    borderColor: rgb(0.82, 0.82, 0.82),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.98),
  });

  currentPage.drawText("Assinatura digital", {
    x: PAGE_MARGIN + 12,
    y: y + 48,
    size: 9,
    font: regular,
    color: rgb(0.45, 0.45, 0.45),
  });

  currentPage.drawImage(embeddedSignature, {
    x: PAGE_MARGIN + 12,
    y: y + 12,
    width: signatureDims.width,
    height: signatureDims.height,
  });

  currentPage.drawText("Documento emitido eletronicamente pelo sistema Conexão 6:30.", {
    x: PAGE_MARGIN,
    y: 24,
    size: 8,
    font: regular,
    color: rgb(0.5, 0.5, 0.5),
  });

  return pdfDoc.save();
}
