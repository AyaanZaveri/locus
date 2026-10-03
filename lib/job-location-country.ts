// Job-board location labels are free text. Match known countries and cities,
// never the company's headquarters, and preserve the source location order.
const countryPatterns: [code: string, pattern: RegExp][] = [
  [
    "us",
    /\b(united states|usa|u\.s\.|us|san francisco|san mateo|palo alto|mountain view|new york|nyc|seattle|washington|austin|boston|chicago|los angeles|san diego|san antonio|atlanta|cincinnati|dallas|denver|houston|idaho falls|miami|nashville|new jersey|philadelphia|phoenix|portland|raleigh|richmond|saint paul|salt lake city|california|colorado|georgia|illinois|massachusetts|minnesota|oregon|pennsylvania|texas|virginia)\b/i,
  ],
  [
    "ca",
    /\b(canada|canadian|toronto|montreal|montréal|vancouver|ottawa|calgary|edmonton|halifax|winnipeg|ontario|alberta)\b|,\s*CAN\b/i,
  ],
  ["gb", /\b(united kingdom|uk|london|edinburgh|england)\b/i],
  ["fr", /\b(france|paris|marseille)\b/i],
  ["de", /\b(germany|berlin|munich|frankfurt)\b/i],
  ["nl", /\b(netherlands|amsterdam)\b/i],
  ["ie", /\b(ireland|dublin)\b|,\s*IE\b/i],
  ["se", /\b(sweden|stockholm)\b/i],
  ["ch", /\b(switzerland|zurich|zürich|lausanne)\b|,\s*CH\b/i],
  ["es", /\b(spain|madrid)\b/i],
  ["it", /\b(italy|milan)\b/i],
  ["in", /\b(india|bangalore|bengaluru|mumbai|delhi|pune)\b/i],
  ["jp", /\b(japan|tokyo)\b/i],
  ["sg", /\bsingapore\b/i],
  ["kr", /\b(korea|seoul)\b/i],
  ["au", /\b(australia|sydney|melbourne|canberra|brisbane)\b/i],
  ["za", /\b(south africa|cape town)\b/i],
  ["ae", /\b(uae|united arab emirates|dubai|abu dhabi)\b/i],
  ["sa", /\b(saudi arabia|riyadh)\b/i],
  ["br", /\b(brazil|são paulo|sao paulo)\b/i],
  ["pl", /\b(poland|warsaw)\b/i],
  ["be", /\b(belgium|brussels)\b/i],
  ["bg", /\b(bulgaria|sofia)\b/i],
  ["at", /\b(austria|linz)\b/i],
  ["il", /\b(israel|tel aviv)\b/i],
  ["mx", /\bmexico\b/i],
  ["pt", /\bportugal\b/i],
  ["dk", /\bdenmark\b/i],
  ["lu", /\bluxembourg\b/i],
  ["ar", /\bargentina\b/i],
  ["cl", /\bchile\b/i],
  ["co", /\bcolombia\b/i],
  ["pe", /\bperu\b/i],
  ["ph", /\b(philippines|makati(?: city)?|manila|cebu)\b/i],
  ["ro", /\bromania\b/i],
  ["cz", /\bczechia\b/i],
  ["hr", /\bcroatia\b/i],
  ["hu", /\bhungary\b/i],
  ["tw", /\btaiwan\b/i],
  ["ua", /\bukraine\b/i],
];

export function getJobLocationCountryCodes(location: string): string[] {
  if (/\b(worldwide|anywhere|global)\b/i.test(location)) return [];

  return countryPatterns
    .flatMap(([code, pattern]) => {
      const match = pattern.exec(location);
      return match ? [{ code, index: match.index }] : [];
    })
    .sort((a, b) => a.index - b.index)
    .map(({ code }) => code);
}

export function getJobLocationCountryCode(location: string): string | null {
  if (/\b(europe|emea|apac|apj|middle east)\b/i.test(location)) return null;

  const matches = getJobLocationCountryCodes(location);
  return matches.length === 1 ? matches[0] : null;
}
