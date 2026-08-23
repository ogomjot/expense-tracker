const expenseTrackerCsvParser = {
  parse(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < String(text).length; index += 1) {
      const character = text[index];
      if (character === '"') {
        if (quoted && text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === "," && !quoted) {
        row.push(field);
        field = "";
      } else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && text[index + 1] === "\n") index += 1;
        row.push(field);
        if (row.some((value) => value.trim() !== "")) rows.push(row);
        row = [];
        field = "";
      } else {
        field += character;
      }
    }
    if (field !== "" || row.length > 0) row.push(field);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    if (quoted) throw new Error("The CSV contains an unfinished quoted field");
    if (rows.length === 0) throw new Error("The CSV is empty");
    const headers = rows[0].map((header) => header.trim().replace(/^\uFEFF/, ""));
    return { headers, rows: rows.slice(1).map((values) => headers.map((_, index) => String(values[index] || "").trim())) };
  },
};
