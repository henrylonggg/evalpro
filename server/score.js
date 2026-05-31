const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

function clamp(value, min = 0, max = 10) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function safeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function metric(value, suffix = "", source = "Finnhub", formula = "") {
  return {
    value: safeNumber(value),
    suffix,
    source,
    formula,
  };
}

function firstNumber(...values) {
  for (const value of values) {
    const n = safeNumber(value);
    if (n !== null) return n;
  }
  return null;
}

function divide(a, b) {
  const x = safeNumber(a);
  const y = safeNumber(b);
  if (x === null || y === null || y === 0) return null;
  return x / y;
}


function toMillions(value) {
  const n = safeNumber(value);
  if (n === null) return null;
  return n / 1_000_000;
}

function percentGrowth(current, previous) {
  const c = safeNumber(current);
  const p = safeNumber(previous);
  if (c === null || p === null || p === 0) return null;
  return ((c - p) / Math.abs(p)) * 100;
}

function cagr(current, previous, years) {
  const c = safeNumber(current);
  const p = safeNumber(previous);
  const y = safeNumber(years);
  if (c === null || p === null || y === null || y <= 0 || c <= 0 || p <= 0) return null;
  return (Math.pow(c / p, 1 / y) - 1) * 100;
}

function pickMetric(metrics, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(metrics, key)) {
      const value = safeNumber(metrics[key]);
      if (value !== null) return value;
    }
  }
  return null;
}

function pickScaledMetric(metrics, candidates) {
  for (const candidate of candidates) {
    const key = typeof candidate === "string" ? candidate : candidate.key;
    const scale = typeof candidate === "string" ? 1 : candidate.scale || 1;

    if (Object.prototype.hasOwnProperty.call(metrics, key)) {
      const value = safeNumber(metrics[key]);
      if (value !== null) return value * scale;
    }
  }

  return null;
}

function availableWeightedAverage(items, fallback = 6.0) {
  const used = items.filter(
    (item) => item.score !== null && item.score !== undefined && Number.isFinite(Number(item.score))
  );
  if (!used.length) return fallback;

  const totalWeight = used.reduce((sum, item) => sum + (item.weight || 1), 0);
  if (!totalWeight) return fallback;

  const total = used.reduce((sum, item) => sum + Number(item.score) * (item.weight || 1), 0);
  return Number(clamp(total / totalWeight).toFixed(1));
}

function highIsGood(value, poor, excellent) {
  const n = safeNumber(value);
  if (n === null) return null;
  if (excellent === poor) return 6.0;
  const score = ((n - poor) / (excellent - poor)) * 10;
  return Number(clamp(score + 0.35, 2.0, 10).toFixed(1));
}

function lowIsGood(value, excellent, poor) {
  const n = safeNumber(value);
  if (n === null) return null;
  if (poor === excellent) return 6.0;
  const score = 10 - ((n - excellent) / (poor - excellent)) * 10;
  return Number(clamp(score + 0.35, 2.0, 10).toFixed(1));
}

function rangeSweetSpot(value, idealLow, idealHigh, weakLow, weakHigh) {
  const n = safeNumber(value);
  if (n === null) return null;
  if (n >= idealLow && n <= idealHigh) return 10;
  if (n < idealLow) return highIsGood(n, weakLow, idealLow);
  return lowIsGood(n, idealHigh, weakHigh);
}

async function fetchFinnhub(path, params = {}) {
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    throw new Error("Missing FINNHUB_API_KEY in Render environment variables.");
  }

  const url = new URL(`${FINNHUB_BASE_URL}${path}`);

  Object.entries({ ...params, token: apiKey }).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `Finnhub request failed: ${response.status}`);
  }

  return data;
}

async function fetchFinnhubOptional(path, params = {}) {
  try {
    return await fetchFinnhub(path, params);
  } catch (error) {
    console.warn(`Optional Finnhub fetch failed for ${path}:`, error?.message || error);
    return null;
  }
}

function reportRows(statement) {
  if (!statement) return [];
  if (Array.isArray(statement)) return statement;
  if (Array.isArray(statement.data)) return statement.data;
  return [];
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function lineValue(statement, concepts = [], labels = []) {
  const rows = reportRows(statement);
  if (!rows.length) return null;

  const conceptSet = concepts.map(normalizeText);
  const labelSet = labels.map(normalizeText);

  for (const row of rows) {
    const concept = normalizeText(row.concept || row.name || row.key);
    if (concept && conceptSet.includes(concept)) {
      const value = safeNumber(row.value ?? row.amount ?? row.val);
      if (value !== null) return value;
    }
  }

  for (const row of rows) {
    const label = normalizeText(row.label || row.description || row.name || row.concept);
    if (label && labelSet.some((needle) => label.includes(needle))) {
      const value = safeNumber(row.value ?? row.amount ?? row.val);
      if (value !== null) return value;
    }
  }

  return null;
}

function parseReport(report) {
  const r = report?.report || report || {};
  const bs = r.bs || r.balanceSheet || r.balance_sheet || [];
  const ic = r.ic || r.incomeStatement || r.income_statement || [];
  const cf = r.cf || r.cashFlow || r.cash_flow || [];

  const revenue = lineValue(
    ic,
    [
      "Revenues",
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "SalesRevenueNet",
      "RevenueFromContractWithCustomerIncludingAssessedTax",
      "SalesRevenueGoodsNet",
    ],
    ["total revenue", "net sales", "revenue"]
  );

  const grossProfit = lineValue(ic, ["GrossProfit"], ["gross profit"]);
  const operatingIncome = lineValue(
    ic,
    ["OperatingIncomeLoss", "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest"],
    ["operating income", "operating loss"]
  );
  const pretaxIncome = lineValue(
    ic,
    ["IncomeLossFromContinuingOperationsBeforeIncomeTaxes", "IncomeLossBeforeIncomeTaxes"],
    ["income before income taxes", "pretax income", "pre-tax income"]
  );
  const netIncome = lineValue(
    ic,
    ["NetIncomeLoss", "ProfitLoss", "NetIncomeLossAvailableToCommonStockholdersBasic"],
    ["net income", "net earnings", "net loss"]
  );
  const epsDiluted = lineValue(
    ic,
    ["EarningsPerShareDiluted", "EarningsPerShareBasicAndDiluted"],
    ["diluted earnings per share", "diluted eps"]
  );

  const assets = lineValue(bs, ["Assets"], ["total assets"]);
  const currentAssets = lineValue(bs, ["AssetsCurrent"], ["total current assets", "current assets"]);
  const liabilities = lineValue(bs, ["Liabilities"], ["total liabilities"]);
  const currentLiabilities = lineValue(bs, ["LiabilitiesCurrent"], ["total current liabilities", "current liabilities"]);
  const equity = lineValue(
    bs,
    [
      "StockholdersEquity",
      "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
      "PartnersCapital",
    ],
    ["total shareholders equity", "total stockholders equity", "shareholders equity", "stockholders equity", "total equity"]
  );
  const cash = lineValue(
    bs,
    [
      "CashAndCashEquivalentsAtCarryingValue",
      "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
      "CashAndDueFromBanks",
    ],
    ["cash and cash equivalents", "cash cash equivalents", "cash"]
  );
  const receivables = lineValue(
    bs,
    ["AccountsReceivableNetCurrent", "ReceivablesNetCurrent", "AccountsNotesAndLoansReceivableNetCurrent"],
    ["accounts receivable", "receivables"]
  );
  const inventory = lineValue(bs, ["InventoryNet"], ["inventories", "inventory"]);
  const shortTermInvestments = lineValue(
    bs,
    ["ShortTermInvestments", "MarketableSecuritiesCurrent"],
    ["short term investments", "marketable securities current"]
  );
  const longTermDebt = lineValue(
    bs,
    [
      "LongTermDebtNoncurrent",
      "LongTermDebtAndFinanceLeaseObligationsNoncurrent",
      "LongTermDebtAndFinanceLeaseObligations",
    ],
    ["long term debt", "long-term debt", "finance lease obligations"]
  );
  const shortTermDebt = lineValue(
    bs,
    [
      "ShortTermBorrowings",
      "ShortTermDebtCurrent",
      "LongTermDebtCurrent",
      "LongTermDebtAndFinanceLeaseObligationsCurrent",
    ],
    ["short term borrowings", "short-term debt", "current portion of long term debt"]
  );
  const totalDebt = firstNumber(
    lineValue(bs, ["DebtCurrentAndNoncurrent", "LongTermDebtAndShortTermBorrowings"], ["total debt"]),
    (safeNumber(longTermDebt) || 0) + (safeNumber(shortTermDebt) || 0) || null
  );

  const operatingCashFlow = lineValue(
    cf,
    ["NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"],
    ["net cash provided by operating activities", "cash provided by operating activities", "operating activities"]
  );
  const capexRaw = lineValue(
    cf,
    ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsForProceedsFromProductiveAssets"],
    ["payments to acquire property", "capital expenditures", "purchase of property"]
  );
  const depreciation = lineValue(
    cf,
    ["DepreciationDepletionAndAmortization", "DepreciationDepletionAndAmortizationExpense", "DepreciationAndAmortization"],
    ["depreciation depletion and amortization", "depreciation and amortization"]
  );

  const freeCashFlow =
    operatingCashFlow !== null && capexRaw !== null
      ? operatingCashFlow - Math.abs(capexRaw)
      : null;

  const ebitda =
    operatingIncome !== null && depreciation !== null
      ? operatingIncome + Math.abs(depreciation)
      : operatingIncome;

  const quickAssets = firstNumber(
    currentAssets !== null && inventory !== null ? currentAssets - Math.abs(inventory) : null,
    [cash, receivables, shortTermInvestments]
      .map(safeNumber)
      .filter((x) => x !== null)
      .reduce((sum, x) => sum + x, 0) || null
  );

  return {
    revenue,
    grossProfit,
    operatingIncome,
    pretaxIncome,
    netIncome,
    epsDiluted,
    assets,
    currentAssets,
    liabilities,
    currentLiabilities,
    equity,
    cash,
    receivables,
    inventory,
    shortTermInvestments,
    totalDebt,
    longTermDebt,
    shortTermDebt,
    operatingCashFlow,
    capex: capexRaw,
    freeCashFlow,
    depreciation,
    ebitda,
    quickAssets,
    fiscalYear: safeNumber(report?.year),
    filedDate: report?.filedDate || report?.acceptedDate || report?.startDate || null,
  };
}

function sortedReports(financials) {
  const data = Array.isArray(financials?.data) ? financials.data : [];
  return data
    .map((item) => ({ raw: item, parsed: parseReport(item) }))
    .sort((a, b) => {
      const ay = safeNumber(a.parsed.fiscalYear) || 0;
      const by = safeNumber(b.parsed.fiscalYear) || 0;
      if (by !== ay) return by - ay;
      return String(b.parsed.filedDate || "").localeCompare(String(a.parsed.filedDate || ""));
    });
}

function latestWithValue(reports, key) {
  for (const item of reports) {
    const value = safeNumber(item.parsed?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function valueNPeriodsAgo(reports, key, periodsAgo) {
  const values = reports.map((item) => safeNumber(item.parsed?.[key])).filter((v) => v !== null);
  return values[periodsAgo] ?? null;
}

function statementDerivedMetrics(profile, quote, annualFinancials, quarterlyFinancials) {
  const annualReports = sortedReports(annualFinancials);
  const quarterlyReports = sortedReports(quarterlyFinancials);
  const latestAnnual = annualReports[0]?.parsed || {};
  const latestQuarter = quarterlyReports[0]?.parsed || {};

  const marketCapM = safeNumber(profile?.marketCapitalization);
  const marketCap = marketCapM !== null ? marketCapM * 1_000_000 : null;
  const currentPrice = safeNumber(quote?.c);

  const latestRevenue = firstNumber(latestAnnual.revenue, latestWithValue(annualReports, "revenue"));
  const priorRevenue = valueNPeriodsAgo(annualReports, "revenue", 1);
  const revenue3YearsAgo = valueNPeriodsAgo(annualReports, "revenue", 3);
  const revenue5YearsAgo = valueNPeriodsAgo(annualReports, "revenue", 5);

  const latestEps = firstNumber(latestAnnual.epsDiluted, latestWithValue(annualReports, "epsDiluted"));
  const priorEps = valueNPeriodsAgo(annualReports, "epsDiluted", 1);
  const eps3YearsAgo = valueNPeriodsAgo(annualReports, "epsDiluted", 3);
  const eps5YearsAgo = valueNPeriodsAgo(annualReports, "epsDiluted", 5);

  const quarterlyRevenue = latestWithValue(quarterlyReports, "revenue");
  const quarterlyRevenueYearAgo = valueNPeriodsAgo(quarterlyReports, "revenue", 4);

  const currentAssets = firstNumber(latestQuarter.currentAssets, latestAnnual.currentAssets);
  const currentLiabilities = firstNumber(latestQuarter.currentLiabilities, latestAnnual.currentLiabilities);
  const cash = firstNumber(latestQuarter.cash, latestAnnual.cash);
  const quickAssets = firstNumber(latestQuarter.quickAssets, latestAnnual.quickAssets);
  const totalDebt = firstNumber(latestQuarter.totalDebt, latestAnnual.totalDebt);
  const longTermDebt = firstNumber(latestQuarter.longTermDebt, latestAnnual.longTermDebt);
  const equity = firstNumber(latestQuarter.equity, latestAnnual.equity);
  const assets = firstNumber(latestQuarter.assets, latestAnnual.assets);
  const operatingCashFlow = firstNumber(latestAnnual.operatingCashFlow, latestWithValue(annualReports, "operatingCashFlow"));
  const freeCashFlow = firstNumber(latestAnnual.freeCashFlow, latestWithValue(annualReports, "freeCashFlow"));
  const ebitda = firstNumber(latestAnnual.ebitda, latestWithValue(annualReports, "ebitda"));

  const revenue = latestRevenue;
  const netIncome = firstNumber(latestAnnual.netIncome, latestWithValue(annualReports, "netIncome"));
  const grossProfit = firstNumber(latestAnnual.grossProfit, latestWithValue(annualReports, "grossProfit"));
  const operatingIncome = firstNumber(latestAnnual.operatingIncome, latestWithValue(annualReports, "operatingIncome"));
  const pretaxIncome = firstNumber(latestAnnual.pretaxIncome, latestWithValue(annualReports, "pretaxIncome"));

  const enterpriseValue =
    marketCap !== null && totalDebt !== null
      ? marketCap + totalDebt - (cash || 0)
      : null;

  return {
    currentRatio: divide(currentAssets, currentLiabilities),
    quickRatio: divide(quickAssets, currentLiabilities),
    cashRatio: divide(cash, currentLiabilities),
    debtToEquity: divide(totalDebt, equity),
    longTermDebtToEquity: divide(longTermDebt, equity),
    assetTurnover: divide(revenue, assets),

    priceToSales: divide(marketCap, revenue),
    priceToBook: divide(marketCap, equity),
    priceToCashFlow: divide(marketCap, operatingCashFlow),
    priceToFreeCashFlow: divide(marketCap, freeCashFlow),
    grossMargin: divide(grossProfit, revenue) !== null ? divide(grossProfit, revenue) * 100 : null,
    operatingMargin: divide(operatingIncome, revenue) !== null ? divide(operatingIncome, revenue) * 100 : null,
    pretaxMargin: divide(pretaxIncome, revenue) !== null ? divide(pretaxIncome, revenue) * 100 : null,
    netMargin: divide(netIncome, revenue) !== null ? divide(netIncome, revenue) * 100 : null,
    roe: divide(netIncome, equity) !== null ? divide(netIncome, equity) * 100 : null,
    roa: divide(netIncome, assets) !== null ? divide(netIncome, assets) * 100 : null,
    roi: divide(operatingIncome, totalDebt !== null && equity !== null ? totalDebt + equity : null) !== null
      ? divide(operatingIncome, totalDebt + equity) * 100
      : null,

    revenueGrowth: percentGrowth(latestRevenue, priorRevenue),
    revenueGrowthQuarterly: percentGrowth(quarterlyRevenue, quarterlyRevenueYearAgo),
    revenueGrowth3Y: cagr(latestRevenue, revenue3YearsAgo, 3),
    revenueGrowth5Y: cagr(latestRevenue, revenue5YearsAgo, 5),
    epsGrowth: percentGrowth(latestEps, priorEps),
    epsGrowth3Y: cagr(latestEps, eps3YearsAgo, 3),
    epsGrowth5Y: cagr(latestEps, eps5YearsAgo, 5),

    operatingCashFlow,
    freeCashFlow,
    currentPrice,
  };
}

function scoreGrowth(metrics) {
  return availableWeightedAverage([
    { score: highIsGood(metrics.revenueGrowth, -8, 30), weight: 1.45 },
    { score: highIsGood(metrics.revenueGrowthQuarterly, -8, 25), weight: 1.05 },
    { score: highIsGood(metrics.revenueGrowth3Y, -5, 22), weight: 0.9 },
    { score: highIsGood(metrics.revenueGrowth5Y, -3, 18), weight: 0.75 },
    { score: highIsGood(metrics.epsGrowth, -12, 30), weight: 1.35 },
    { score: highIsGood(metrics.epsGrowth3Y, -8, 22), weight: 0.8 },
    { score: highIsGood(metrics.epsGrowth5Y, -5, 18), weight: 0.65 },
  ]);
}

function scoreProfitability(metrics) {
  return availableWeightedAverage([
    { score: highIsGood(metrics.roe, 0, 35), weight: 1.35 },
    { score: highIsGood(metrics.roa, 0, 18), weight: 0.85 },
    { score: highIsGood(metrics.roi, 0, 22), weight: 0.75 },
    { score: highIsGood(metrics.netMargin, 0, 28), weight: 1.15 },
    { score: highIsGood(metrics.operatingMargin, 0, 30), weight: 1.0 },
    { score: highIsGood(metrics.grossMargin, 15, 65), weight: 0.55 },
    { score: highIsGood(metrics.pretaxMargin, 0, 28), weight: 0.55 },
  ]);
}

function scoreFinancialHealth(metrics) {
  return availableWeightedAverage([
    { score: lowIsGood(metrics.debtToEquity, 0.2, 4.0), weight: 1.35 },
    { score: lowIsGood(metrics.longTermDebtToEquity, 0.15, 3.0), weight: 0.75 },
    { score: rangeSweetSpot(metrics.currentRatio, 1.4, 3.5, 0.55, 7.0), weight: 0.95 },
    { score: rangeSweetSpot(metrics.quickRatio, 1.0, 2.8, 0.35, 6.0), weight: 0.75 },
    { score: rangeSweetSpot(metrics.cashRatio, 0.25, 2.0, 0.02, 5.0), weight: 0.45 },
    { score: highIsGood(metrics.assetTurnover, 0.1, 1.2), weight: 0.3 },
    { score: highIsGood(metrics.marketCapM, 5_000, 750_000), weight: 0.45 },
  ]);
}

function scoreValuation(metrics, growthScore, profitabilityScore) {
  const raw = availableWeightedAverage([
    { score: lowIsGood(metrics.peRatio, 10, 75), weight: 1.2 },
    { score: lowIsGood(metrics.forwardPe, 10, 60), weight: 0.65 },
    { score: lowIsGood(metrics.priceToSales, 1.0, 18), weight: 0.9 },
    { score: lowIsGood(metrics.priceToBook, 1.0, 14), weight: 0.75 },
    { score: lowIsGood(metrics.priceToCashFlow, 8, 55), weight: 0.65 },
    { score: lowIsGood(metrics.priceToFreeCashFlow, 10, 70), weight: 0.65 },
    { score: lowIsGood(metrics.pegRatio, 0.7, 3.5), weight: 0.45 },
    { score: highIsGood(metrics.dividendYield, 0, 4.5), weight: 0.2 },
  ], 5.9);

  const qualityAdjustment =
    (growthScore >= 7.7 ? 0.45 : growthScore >= 6.8 ? 0.25 : 0) +
    (profitabilityScore >= 7.7 ? 0.45 : profitabilityScore >= 6.8 ? 0.25 : 0);

  return Number(clamp(raw + qualityAdjustment, 2.5, 10).toFixed(1));
}

function scoreMomentum(metrics) {
  const betaPenalty = metrics.beta !== null && metrics.beta > 1.8 ? -0.35 : 0;

  const raw = availableWeightedAverage([
    { score: highIsGood(metrics.dayChangePercent, -4, 5), weight: 0.55 },
    { score: highIsGood(metrics.priceReturn4Week, -8, 14), weight: 0.85 },
    { score: highIsGood(metrics.priceReturn13Week, -12, 24), weight: 1.0 },
    { score: highIsGood(metrics.priceReturn26Week, -18, 35), weight: 0.9 },
    { score: highIsGood(metrics.priceReturn52Week, -25, 55), weight: 0.75 },
    { score: highIsGood(metrics.distanceFrom52WeekLow, 0, 80), weight: 0.35 },
  ]);

  return Number(clamp(raw + betaPenalty).toFixed(1));
}

function scorePullback(metrics) {
  return availableWeightedAverage([
    { score: highIsGood(metrics.pullbackFromHigh, 0, 35), weight: 1.15 },
    { score: lowIsGood(metrics.priceReturn4Week, -10, 18), weight: 0.55 },
    { score: lowIsGood(metrics.priceReturn13Week, -15, 28), weight: 0.45 },
    { score: rangeSweetSpot(metrics.distanceFrom52WeekLow, 18, 75, 0, 180), weight: 0.35 },
    { score: lowIsGood(metrics.dayChangePercent, -4, 5), weight: 0.25 },
  ], 6.0);
}

function getRiskLabel(metrics, financialHealthScore, profitabilityScore) {
  let riskPoints = 0;

  if (metrics.beta !== null) {
    if (metrics.beta >= 2.3) riskPoints += 4;
    else if (metrics.beta >= 1.8) riskPoints += 3;
    else if (metrics.beta >= 1.25) riskPoints += 2;
    else if (metrics.beta <= 0.65) riskPoints -= 1;
  }

  if (metrics.debtToEquity !== null) {
    if (metrics.debtToEquity >= 5) riskPoints += 4;
    else if (metrics.debtToEquity >= 3) riskPoints += 3;
    else if (metrics.debtToEquity >= 1.5) riskPoints += 2;
    else if (metrics.debtToEquity <= 0.5) riskPoints -= 1;
  }

  if (metrics.currentRatio !== null) {
    if (metrics.currentRatio < 0.75) riskPoints += 2;
    else if (metrics.currentRatio >= 1.5) riskPoints -= 1;
  }

  if (metrics.marketCapM !== null) {
    if (metrics.marketCapM < 2_000) riskPoints += 2;
    else if (metrics.marketCapM >= 200_000) riskPoints -= 1;
  }

  if (financialHealthScore <= 4.5) riskPoints += 2;
  if (profitabilityScore <= 4.5) riskPoints += 1;

  if (riskPoints >= 7) return "Very High";
  if (riskPoints >= 5) return "High";
  if (riskPoints >= 3) return "Medium";
  if (riskPoints <= -2) return "Very Low";
  return "Low";
}

function buildExtractedMetrics(profile, quote, m, annualFinancials, quarterlyFinancials) {
  const currentPrice = safeNumber(quote?.c);
  const weekHigh = pickMetric(m, ["52WeekHigh", "52WeekHighAdjusted"]);
  const weekLow = pickMetric(m, ["52WeekLow", "52WeekLowAdjusted"]);

  const pullbackFromHigh =
    currentPrice !== null && weekHigh !== null && weekHigh > 0
      ? ((weekHigh - currentPrice) / weekHigh) * 100
      : null;

  const distanceFrom52WeekLow =
    currentPrice !== null && weekLow !== null && weekLow > 0
      ? ((currentPrice - weekLow) / weekLow) * 100
      : null;

  const derived = statementDerivedMetrics(profile, quote, annualFinancials, quarterlyFinancials);

  const fallbackEnterpriseValue = pickScaledMetric(m, [
    { key: "enterpriseValue", scale: 1_000_000 },
    { key: "enterpriseValueTTM", scale: 1_000_000 },
    { key: "enterpriseValueAnnual", scale: 1_000_000 },
    { key: "enterpriseValueQuarterly", scale: 1_000_000 },
    { key: "enterpriseValueMil", scale: 1_000_000 },
    { key: "evMil", scale: 1_000_000 },
    { key: "ev", scale: 1_000_000 },
  ]);

  const enterpriseValue = firstNumber(derived.enterpriseValue, fallbackEnterpriseValue);

  return {
    peRatio: pickMetric(m, ["peNormalizedAnnual", "peTTM", "peBasicExclExtraTTM", "peInclExtraTTM"]),
    forwardPe: pickMetric(m, ["forwardPE", "peForward", "forwardPeAnnual"]),
    pegRatio: pickMetric(m, ["pegRatio", "pegTTM", "pegAnnual"]),
    priceToSales: firstNumber(derived.priceToSales, pickMetric(m, ["psTTM", "psAnnual", "priceToSalesTTM"])),
    priceToBook: firstNumber(derived.priceToBook, pickMetric(m, ["pbQuarterly", "pbAnnual", "priceToBookAnnual"])),
    priceToCashFlow: firstNumber(derived.priceToCashFlow, pickMetric(m, ["pcfShareTTM", "pcfShareAnnual", "priceToCashFlowTTM"])),
    priceToFreeCashFlow: firstNumber(derived.priceToFreeCashFlow, pickMetric(m, ["pfcfShareTTM", "pfcfShareAnnual", "priceToFreeCashFlowTTM"])),
    dividendYield: pickMetric(m, ["dividendYieldIndicatedAnnual", "currentDividendYieldTTM", "dividendYield5Y"]),

    roe: firstNumber(derived.roe, pickMetric(m, ["roeTTM", "roeRfy", "roeAnnual"])),
    roa: firstNumber(derived.roa, pickMetric(m, ["roaTTM", "roaRfy", "roaAnnual"])),
    roi: firstNumber(derived.roi, pickMetric(m, ["roiTTM", "roiAnnual", "roicTTM", "roicAnnual"])),
    grossMargin: firstNumber(derived.grossMargin, pickMetric(m, ["grossMarginTTM", "grossMarginAnnual"])),
    operatingMargin: firstNumber(derived.operatingMargin, pickMetric(m, ["operatingMarginTTM", "operatingMarginAnnual"])),
    pretaxMargin: firstNumber(derived.pretaxMargin, pickMetric(m, ["pretaxMarginTTM", "pretaxMarginAnnual"])),
    netMargin: firstNumber(derived.netMargin, pickMetric(m, ["netProfitMarginTTM", "netProfitMarginAnnual"])),

    revenueGrowth: firstNumber(derived.revenueGrowth, pickMetric(m, ["revenueGrowthTTMYoy", "revenueGrowthYOY", "revenueGrowthAnnualYoy"])),
    revenueGrowthQuarterly: firstNumber(derived.revenueGrowthQuarterly, pickMetric(m, ["revenueGrowthQuarterlyYoy", "revenueGrowthQuarterly"])),
    revenueGrowth3Y: firstNumber(derived.revenueGrowth3Y, pickMetric(m, ["revenueGrowth3Y", "revenueGrowth3YCAGR"])),
    revenueGrowth5Y: firstNumber(derived.revenueGrowth5Y, pickMetric(m, ["revenueGrowth5Y", "revenueGrowth5YCAGR"])),
    epsGrowth: firstNumber(derived.epsGrowth, pickMetric(m, ["epsGrowthTTMYoy", "epsGrowthYOY", "epsGrowthAnnualYoy"])),
    epsGrowth3Y: firstNumber(derived.epsGrowth3Y, pickMetric(m, ["epsGrowth3Y", "epsGrowth3YCAGR"])),
    epsGrowth5Y: firstNumber(derived.epsGrowth5Y, pickMetric(m, ["epsGrowth5Y", "epsGrowth5YCAGR"])),

    debtToEquity: firstNumber(derived.debtToEquity, pickMetric(m, ["totalDebt/totalEquityAnnual", "totalDebt/totalEquityQuarterly"])),
    longTermDebtToEquity: firstNumber(derived.longTermDebtToEquity, pickMetric(m, ["longTermDebt/equityAnnual", "longTermDebt/equityQuarterly"])),
    currentRatio: firstNumber(derived.currentRatio, pickMetric(m, ["currentRatioAnnual", "currentRatioQuarterly"])),
    quickRatio: firstNumber(derived.quickRatio, pickMetric(m, ["quickRatioAnnual", "quickRatioQuarterly"])),
    cashRatio: firstNumber(derived.cashRatio, pickMetric(m, ["cashRatioAnnual", "cashRatioQuarterly"])),
    assetTurnover: firstNumber(derived.assetTurnover, pickMetric(m, ["assetTurnoverAnnual", "assetTurnoverTTM"])),

    beta: pickMetric(m, ["beta"]),
    dayChangePercent: safeNumber(quote?.dp),
    priceReturn4Week: pickMetric(m, ["4WeekPriceReturnDaily", "monthToDatePriceReturnDaily"]),
    priceReturn13Week: pickMetric(m, ["13WeekPriceReturnDaily"]),
    priceReturn26Week: pickMetric(m, ["26WeekPriceReturnDaily"]),
    priceReturn52Week: pickMetric(m, ["52WeekPriceReturnDaily"]),
    weekHigh,
    weekLow,
    pullbackFromHigh,
    distanceFrom52WeekLow,

    marketCapM: safeNumber(profile?.marketCapitalization),
    operatingCashFlow: derived.operatingCashFlow,
    freeCashFlow: derived.freeCashFlow,
    enterpriseValue,
  };
}

export async function buildStockAnalysis(symbol) {
  const cleanSymbol = String(symbol || "").trim().toUpperCase();

  if (!cleanSymbol) {
    throw new Error("Missing ticker symbol.");
  }

  const [profile, quote, metricsRaw, annualFinancials, quarterlyFinancials] = await Promise.all([
    fetchFinnhub("/stock/profile2", { symbol: cleanSymbol }),
    fetchFinnhub("/quote", { symbol: cleanSymbol }),
    fetchFinnhub("/stock/metric", { symbol: cleanSymbol, metric: "all" }),
    fetchFinnhubOptional("/stock/financials-reported", { symbol: cleanSymbol, freq: "annual" }),
    fetchFinnhubOptional("/stock/financials-reported", { symbol: cleanSymbol, freq: "quarterly" }),
  ]);

  if (!profile || !profile.ticker) {
    throw new Error(`No company profile found for ${cleanSymbol}.`);
  }

  const rawMetricData = metricsRaw?.metric || {};
  const extracted = buildExtractedMetrics(profile, quote, rawMetricData, annualFinancials, quarterlyFinancials);

  const growthScore = scoreGrowth(extracted);
  const profitabilityScore = scoreProfitability(extracted);
  const healthScore = scoreFinancialHealth(extracted);
  const valuationScore = scoreValuation(extracted, growthScore, profitabilityScore);
  const momentumScore = scoreMomentum(extracted);
  const reversalScore = scorePullback(extracted);

  const edgeScore = availableWeightedAverage([
    { score: growthScore, weight: 0.235 },
    { score: profitabilityScore, weight: 0.225 },
    { score: healthScore, weight: 0.195 },
    { score: valuationScore, weight: 0.145 },
    { score: momentumScore, weight: 0.115 },
    { score: reversalScore, weight: 0.085 },
  ], 6.0);

  const riskLabel = getRiskLabel(extracted, healthScore, profitabilityScore);

  return {
    symbol: cleanSymbol,
    profile,
    quote,

    companyDescription: `${profile.name || cleanSymbol} is a publicly traded company in the ${
      profile.finnhubIndustry || "market"
    } industry.`,

    evaluationSummary: `${cleanSymbol} has an Eval Score of ${edgeScore.toFixed(
      1
    )} out of 10. The score blends growth, profitability, financial health, valuation, momentum, and pullback opportunity using available quote, basic-financial, and reported financial-statement data.`,

    metrics: {
      peRatio: metric(extracted.peRatio, "", "Finnhub", "Price / Earnings"),
      forwardPe: metric(extracted.forwardPe, "", "Finnhub", "Forward Price / Earnings"),
      pegRatio: metric(extracted.pegRatio, "", "Finnhub", "P/E adjusted by expected growth"),
      priceToSales: metric(extracted.priceToSales, "", extracted.priceToSales !== null ? "Calculated" : "Finnhub", "Market Cap / Revenue"),
      priceToBook: metric(extracted.priceToBook, "", extracted.priceToBook !== null ? "Calculated" : "Finnhub", "Market Cap / Shareholders' Equity"),
      priceToCashFlow: metric(extracted.priceToCashFlow, "", extracted.priceToCashFlow !== null ? "Calculated" : "Finnhub", "Market Cap / Operating Cash Flow"),
      priceToFreeCashFlow: metric(extracted.priceToFreeCashFlow, "", extracted.priceToFreeCashFlow !== null ? "Calculated" : "Finnhub", "Market Cap / Free Cash Flow"),
      enterpriseValue: metric(toMillions(extracted.enterpriseValue), "M", extracted.enterpriseValue !== null ? "Calculated" : "Finnhub", "Market Cap + Total Debt - Cash, shown in millions"),
      dividendYield: metric(extracted.dividendYield, "%", "Finnhub", "Annual dividend yield"),

      roe: metric(extracted.roe, "%", extracted.roe !== null ? "Calculated" : "Finnhub", "Net Income / Shareholder Equity"),
      roa: metric(extracted.roa, "%", extracted.roa !== null ? "Calculated" : "Finnhub", "Net Income / Assets"),
      roi: metric(extracted.roi, "%", extracted.roi !== null ? "Calculated" : "Finnhub", "Operating Income / Invested Capital"),
      grossMargin: metric(extracted.grossMargin, "%", extracted.grossMargin !== null ? "Calculated" : "Finnhub", "Gross Profit / Revenue"),
      operatingMargin: metric(extracted.operatingMargin, "%", extracted.operatingMargin !== null ? "Calculated" : "Finnhub", "Operating Income / Revenue"),
      pretaxMargin: metric(extracted.pretaxMargin, "%", extracted.pretaxMargin !== null ? "Calculated" : "Finnhub", "Pretax Income / Revenue"),
      netMargin: metric(extracted.netMargin, "%", extracted.netMargin !== null ? "Calculated" : "Finnhub", "Net Income / Revenue"),

      revenueGrowth: metric(extracted.revenueGrowth, "%", extracted.revenueGrowth !== null ? "Calculated" : "Finnhub", "Annual revenue growth"),
      revenueGrowthQuarterly: metric(extracted.revenueGrowthQuarterly, "%", extracted.revenueGrowthQuarterly !== null ? "Calculated" : "Finnhub", "Quarterly revenue growth year over year"),
      revenueGrowth3Y: metric(extracted.revenueGrowth3Y, "%", extracted.revenueGrowth3Y !== null ? "Calculated" : "Finnhub", "3-year revenue CAGR"),
      revenueGrowth5Y: metric(extracted.revenueGrowth5Y, "%", extracted.revenueGrowth5Y !== null ? "Calculated" : "Finnhub", "5-year revenue CAGR"),
      epsGrowth: metric(extracted.epsGrowth, "%", extracted.epsGrowth !== null ? "Calculated" : "Finnhub", "Annual diluted EPS growth"),
      epsGrowth3Y: metric(extracted.epsGrowth3Y, "%", extracted.epsGrowth3Y !== null ? "Calculated" : "Finnhub", "3-year EPS CAGR"),
      epsGrowth5Y: metric(extracted.epsGrowth5Y, "%", extracted.epsGrowth5Y !== null ? "Calculated" : "Finnhub", "5-year EPS CAGR"),

      debtToEquity: metric(extracted.debtToEquity, "", extracted.debtToEquity !== null ? "Calculated" : "Finnhub", "Total Debt / Total Equity"),
      longTermDebtToEquity: metric(extracted.longTermDebtToEquity, "", extracted.longTermDebtToEquity !== null ? "Calculated" : "Finnhub", "Long-Term Debt / Equity"),
      currentRatio: metric(extracted.currentRatio, "", extracted.currentRatio !== null ? "Calculated" : "Finnhub", "Current Assets / Current Liabilities"),
      quickRatio: metric(extracted.quickRatio, "", extracted.quickRatio !== null ? "Calculated" : "Finnhub", "Quick Assets / Current Liabilities"),
      cashRatio: metric(extracted.cashRatio, "", extracted.cashRatio !== null ? "Calculated" : "Finnhub", "Cash / Current Liabilities"),
      assetTurnover: metric(extracted.assetTurnover, "", extracted.assetTurnover !== null ? "Calculated" : "Finnhub", "Revenue / Assets"),

      operatingCashFlow: metric(extracted.operatingCashFlow, "", "Calculated", "Cash flow from operations"),
      freeCashFlow: metric(extracted.freeCashFlow, "", "Calculated", "Operating Cash Flow - Capital Expenditures"),
      beta: metric(extracted.beta, "", "Finnhub", "Volatility compared with market"),
      dayChangePercent: metric(extracted.dayChangePercent, "%", "Finnhub", "Current day price move"),
      priceReturn4Week: metric(extracted.priceReturn4Week, "%", "Finnhub", "4-week price return"),
      priceReturn13Week: metric(extracted.priceReturn13Week, "%", "Finnhub", "13-week price return"),
      priceReturn26Week: metric(extracted.priceReturn26Week, "%", "Finnhub", "26-week price return"),
      priceReturn52Week: metric(extracted.priceReturn52Week, "%", "Finnhub", "52-week price return"),
      weekHigh: metric(extracted.weekHigh, "", "Finnhub", "52-week high price"),
      weekLow: metric(extracted.weekLow, "", "Finnhub", "52-week low price"),
      pullbackFromHigh: metric(extracted.pullbackFromHigh, "%", "Calculated", "Distance below 52-week high"),
      distanceFrom52WeekLow: metric(extracted.distanceFrom52WeekLow, "%", "Calculated", "Distance above 52-week low"),

      marketCapM: metric(extracted.marketCapM, "M", "Finnhub", "Market capitalization in millions"),
    },

    grades: {
      edgeScore: Number(edgeScore.toFixed(1)),
      riskLabel,
      categories: {
        growth: growthScore,
        profitability: profitabilityScore,
        financialHealth: healthScore,
        valuation: valuationScore,
        momentum: momentumScore,
        reversal: reversalScore,
      },
      context: {
        marketCapM: extracted.marketCapM,
      },
    },
  };
}
