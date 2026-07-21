/**
 * Utilitários de exportação de dados para CSV e Excel (XLSX/XLS)
 * Utiliza o File System Access API (showSaveFilePicker) para indicar onde guardar, com fallback.
 */

async function saveWithPicker(blob: Blob, suggestedName: string, mime: string) {
  try {
    if (typeof window !== "undefined" && (window as any).showSaveFilePicker) {
      const ext = suggestedName.includes(".") ? suggestedName.split(".").pop()?.toLowerCase() : "";
      const types = ext
        ? [
            {
              description: `${ext.toUpperCase()} File (*.${ext})`,
              accept: { [mime || "application/octet-stream"]: [`.${ext}`] },
            },
          ]
        : [];
      try {
        const handle = await (window as any).showSaveFilePicker({ suggestedName, types });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (e: any) {
        if (e.name === "AbortError") {
          console.log("Guardar cancelado pelo utilizador.");
          return;
        }
        console.error("showSaveFilePicker falhou, a usar download de fallback:", e);
      }
    }

    // Fallback tradicional usando link invisível
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Erro ao guardar o ficheiro:", error);
  }
}

/**
 * Exporta dados tabulares para CSV
 */
export async function exportToCSV(headers: string[], rows: any[][], fileName: string) {
  const escapeCell = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const headerLine = headers.map(escapeCell).join(",");
  const rowsLines = rows.map((row) => row.map(escapeCell).join(","));
  const csvContent = [headerLine, ...rowsLines].join("\r\n");

  // UTF-8 BOM (\ufeff) garante suporte a acentuação portuguesa no Excel
  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  await saveWithPicker(blob, `${fileName}.csv`, "text/csv");
}

/**
 * Exporta dados tabulares para formato compatível com Excel (XLSX) via HTML SpreadsheetML
 */
export async function exportToXLSX(headers: string[], rows: any[][], fileName: string) {
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
      <!--[if gte o:office:office]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Relatorio</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        table { border-collapse: collapse; margin: 10px; }
        th { background-color: #4f46e5; color: #ffffff; font-weight: bold; text-align: left; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 12px; font-family: system-ui, -apple-system, sans-serif; font-size: 12px; }
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) =>
                `<tr>${row
                  .map(
                    (cell) =>
                      `<td>${
                        cell === null || cell === undefined
                          ? ""
                          : String(cell).replace(/</g, "&lt;").replace(/>/g, "&gt;")
                      }</td>`
                  )
                  .join("")}</tr>`
            )
            .join("")}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  await saveWithPicker(blob, `${fileName}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}
