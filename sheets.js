(() => {
  const schema = {
    Cats: ["id", "name", "breed", "birthDate", "weight", "gender"],
    Vaccines: ["id", "name", "date", "clinic", "note", "done"],
    Transactions: ["id", "title", "category", "amount", "date", "type", "note"],
    Meals: ["id", "time", "title", "detail", "emoji", "done", "completedDate"]
  };
  const apiRoot = "https://sheets.googleapis.com/v4/spreadsheets";

  async function request(url, token, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers
      }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = result.error?.message || `Google Sheets trả về lỗi HTTP ${response.status}.`;
      throw new Error(message);
    }
    return result;
  }

  function endpoint(spreadsheetId, suffix = "") {
    return `${apiRoot}/${encodeURIComponent(spreadsheetId)}${suffix}`;
  }

  async function ensureTabs(spreadsheetId, token) {
    const metadata = await request(`${endpoint(spreadsheetId)}?fields=sheets.properties(sheetId,title)`, token);
    const existing = new Set((metadata.sheets || []).map((sheet) => sheet.properties.title));
    const requests = Object.keys(schema)
      .filter((title) => !existing.has(title))
      .map((title) => ({ addSheet: { properties: { title } } }));
    if (requests.length) {
      await request(`${endpoint(spreadsheetId)}:batchUpdate`, token, {
        method: "POST",
        body: JSON.stringify({ requests })
      });
    }
  }

  function decodeRows(rows, sheetName) {
    if (!rows || rows.length < 2) return [];
    const headers = rows[0];
    return rows.slice(1).filter((row) => row.some((value) => value !== "")).map((row) => {
      const record = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
      if (sheetName === "Vaccines" || sheetName === "Meals") {
        record.done = record.done === true || String(record.done).toLowerCase() === "true";
      }
      if (sheetName === "Transactions") record.amount = Number(record.amount) || 0;
      if (sheetName === "Cats") record.weight = Number(record.weight) || 0;
      return record;
    });
  }

  async function read(spreadsheetId, token) {
    const query = new URLSearchParams();
    Object.keys(schema).forEach((title) => query.append("ranges", `'${title}'!A:Z`));
    const result = await request(`${endpoint(spreadsheetId, "/values:batchGet")}?${query}`, token);
    const rows = result.valueRanges || [];
    const byName = Object.fromEntries(Object.keys(schema).map((title, index) => [
      title,
      decodeRows(rows[index]?.values, title)
    ]));
    const hasData = Object.values(byName).some((records) => records.length > 0);
    return {
      hasData,
      state: {
        cat: byName.Cats[0] || null,
        vaccines: byName.Vaccines,
        transactions: byName.Transactions,
        meals: byName.Meals
      }
    };
  }

  async function write(spreadsheetId, token, state) {
    const values = {
      Cats: [schema.Cats, ["cat", state.cat.name, state.cat.breed, state.cat.birthDate, state.cat.weight, state.cat.gender]],
      Vaccines: [schema.Vaccines, ...state.vaccines.map((item) => schema.Vaccines.map((key) => item[key] ?? ""))],
      Transactions: [schema.Transactions, ...state.transactions.map((item) => schema.Transactions.map((key) => item[key] ?? ""))],
      Meals: [schema.Meals, ...state.meals.map((item) => schema.Meals.map((key) => item[key] ?? ""))]
    };
    const ranges = Object.keys(schema).map((title) => `'${title}'!A:Z`);
    await request(`${endpoint(spreadsheetId, "/values:batchClear")}`, token, {
      method: "POST",
      body: JSON.stringify({ ranges })
    });
    const data = Object.entries(values).map(([title, rows]) => ({
      range: `'${title}'!A1`,
      majorDimension: "ROWS",
      values: rows
    }));
    await request(`${endpoint(spreadsheetId, "/values:batchUpdate")}`, token, {
      method: "POST",
      body: JSON.stringify({ valueInputOption: "RAW", data })
    });
  }

  window.MiuSheets = { ensureTabs, read, write };
})();
