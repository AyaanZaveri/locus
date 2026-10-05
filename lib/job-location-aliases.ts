// Exact, curated aliases only. This is not a geocoder: unrecognized and
// ambiguous labels stay unchanged until their posting establishes the place.
const subdividedCities: [city: string, code: string, region: string, country: string][] = [
  ["San Francisco", "CA", "California", "United States"],
  ["San Mateo", "CA", "California", "United States"],
  ["Foster City", "CA", "California", "United States"],
  ["Palo Alto", "CA", "California", "United States"],
  ["Cupertino", "CA", "California", "United States"],
  ["Mountain View", "CA", "California", "United States"],
  ["New York", "NY", "New York", "United States"],
  ["Seattle", "WA", "Washington", "United States"],
  ["Austin", "TX", "Texas", "United States"],
  ["Boston", "MA", "Massachusetts", "United States"],
  ["Chicago", "IL", "Illinois", "United States"],
  ["Los Angeles", "CA", "California", "United States"],
  ["San Diego", "CA", "California", "United States"],
  ["San Antonio", "TX", "Texas", "United States"],
  ["Atlanta", "GA", "Georgia", "United States"],
  ["Charlotte", "NC", "North Carolina", "United States"],
  ["Cincinnati", "OH", "Ohio", "United States"],
  ["Dallas", "TX", "Texas", "United States"],
  ["Denver", "CO", "Colorado", "United States"],
  ["Detroit", "MI", "Michigan", "United States"],
  ["Houston", "TX", "Texas", "United States"],
  ["Las Vegas", "NV", "Nevada", "United States"],
  ["Miami", "FL", "Florida", "United States"],
  ["Nashville", "TN", "Tennessee", "United States"],
  ["Philadelphia", "PA", "Pennsylvania", "United States"],
  ["Phoenix", "AZ", "Arizona", "United States"],
  ["Raleigh", "NC", "North Carolina", "United States"],
  ["Saint Paul", "MN", "Minnesota", "United States"],
  ["Salt Lake City", "UT", "Utah", "United States"],
  ["Tampa", "FL", "Florida", "United States"],
  ["Toronto", "ON", "Ontario", "Canada"],
  ["Vancouver", "BC", "British Columbia", "Canada"],
  ["Montréal", "QC", "Quebec", "Canada"],
  ["Calgary", "AB", "Alberta", "Canada"],
  ["Edmonton", "AB", "Alberta", "Canada"],
  ["Halifax", "NS", "Nova Scotia", "Canada"],
  ["Winnipeg", "MB", "Manitoba", "Canada"],
  ["Ottawa", "ON", "Ontario", "Canada"],
  ["Sydney", "NSW", "New South Wales", "Australia"],
  ["Melbourne", "VIC", "Victoria", "Australia"],
  ["Brisbane", "QLD", "Queensland", "Australia"],
  ["Canberra", "ACT", "Australian Capital Territory", "Australia"],
];

const internationalCities: [canonical: string, aliases: string[]][] = [
  // Verified against Lovable and Perplexity's canonical ATS locations.
  ["Lund, Sweden", []],
  ["Belgrade, Serbia", []],
  ["Bengaluru, India", ["Bangalore", "Bangalore India", "Bangalore, India", "Bengaluru", "Bengaluru, Karnataka", "Bangalore, Karnataka"]],
  ["New Delhi, India", ["New Delhi"]],
  ["Delhi, India", ["Delhi"]],
  ["Hyderabad, India", ["Hyderabad"]],
  ["Pune, India", ["Pune"]],
  ["Brussels, Belgium", ["Brussels"]],
  ["Edinburgh, UK", ["Edinburgh", "Edinburgh, United Kingdom", "Edinburgh, Scotland"]],
  ["Frankfurt, Germany", ["Frankfurt"]],
  ["Lausanne, Switzerland", ["Lausanne"]],
  ["Linz, Austria", ["Linz"]],
  ["Madrid, Spain", ["Madrid"]],
  ["Marseille, France", ["Marseille"]],
  ["Milan, Italy", ["Milan"]],
  ["Sofia, Bulgaria", ["Sofia"]],
  ["Zürich, Switzerland", ["Zurich", "Zürich", "Zurich, Switzerland"]],
  ["São Paulo, Brazil", ["São Paulo", "Sao Paulo", "Sao Paulo, Brazil"]],
  ["Cape Town, South Africa", ["Cape Town"]],
  ["Makati City, Philippines", ["Makati", "Makati City"]],
  ["Abu Dhabi, United Arab Emirates", ["Abu Dhabi", "Abu Dhabi, UAE"]],
  ["Dubai, United Arab Emirates", ["Dubai", "Dubai, UAE"]],
  ["Riyadh, Saudi Arabia", ["Riyadh"]],
  ["Singapore", ["Singapore, Singapore"]],
  ["Tel Aviv, Israel", ["Tel Aviv"]],
];

export const verifiedJobPlaceAliases: Record<string, string> = {};

function register(canonical: string, aliases: string[]) {
  for (const alias of [canonical, ...aliases]) {
    verifiedJobPlaceAliases[alias.toLocaleLowerCase("en")] = canonical;
  }
}

for (const [city, code, region, country] of subdividedCities) {
  register(`${city}, ${code}`, [
    city,
    `${city}, ${region}`,
    `${city}, ${country}`,
    `${city}, ${code}, ${country}`,
    `${city}, ${region}, ${country}`,
    ...(country === "United States" ? [`${city}, US`, `${city}, USA`] : []),
  ]);
}

for (const [canonical, aliases] of internationalCities) register(canonical, aliases);

// These names are ambiguous without their explicit subdivision. In particular,
// bare Victoria could be an Australian state and Richmond could be Canadian.
register("Victoria, BC", ["Victoria, British Columbia", "Victoria, British Columbia, Canada"]);
register("Richmond, VA", ["Richmond, Virginia", "Richmond, Virginia, United States"]);
register("Portland, OR", ["Portland, Oregon", "Portland, Oregon, United States"]);
register("Washington, DC", ["Washington, District of Columbia"]);
register("Montréal, QC", ["Montreal", "Montreal, QC", "Montreal, Quebec", "Montreal, Canada", "Montreal, Quebec, Canada"]);
register("New York, NY", ["New York, United States"]);
register("London, UK", ["London UK"]);
register("San Francisco Bay Area, CA", ["San Francisco Bay Area", "San Francisco Bay Area, California"]);
register("Bay Area, CA", ["Bay Area, CA"]);

export const jobRegionAliases: Record<string, string> = {
  us: "United States",
  usa: "United States",
  "u.s.": "United States",
  uk: "United Kingdom",
  uae: "United Arab Emirates",
  can: "Canada",
  "global": "Worldwide",
  "worldwide": "Worldwide",
  "amer": "Americas",
  "americas": "Americas",
  "apac": "APAC",
  "apj": "APJ",
  "emea": "EMEA",
  "anz": "ANZ",
};
