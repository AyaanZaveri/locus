# Local city population ranking

`city-populations.json` enriches the installed `country-state-city` catalog with
population counts from [GeoNames cities500](https://download.geonames.org/export/dump/).
GeoNames data is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Attribution: **GeoNames, https://www.geonames.org/**. The source download URL,
generation date, source checksum, and matching policy are recorded in the JSON.

Regenerate after a package update or to refresh the population snapshot:

```sh
python3 scripts/generate-city-populations.py
# Or reuse a downloaded snapshot:
python3 scripts/generate-city-populations.py --archive /path/to/cities500.zip
```

Matches require the same country, a normalized city name or GeoNames alias,
and coordinates within 10 km. The nearest matching place wins. GeoNames's
administrative area codes are not assumed to equal the package's state codes.
The output uses `countryCode:stateCode:originalCityName` keys to distinguish
same-name cities. Unknown population is not an estimate of zero inhabitants:
unmatched places remain searchable and sort after known populations at equal
text relevance. Population is a proxy for prominence, not popularity, and
source estimates can have different dates and geographic definitions.

Empty searches show 30 curated startup/job hubs, in product-defined order,
resolved against the installed city catalog. The worldwide catalog remains
available through typed searches, which load in chunks on scroll.
Typed searches prioritize exact city/country names and exact full labels, then
city-name prefixes, then other substring matches. Within a relevance tier,
population breaks ties, followed by alphabetical order. Pagination happens
after ranking, so all places remain accessible by scrolling or typing.

The lookup is imported only by the server-side catalog; neither the GeoNames
snapshot nor the full package catalog is sent to the browser. Lookup requests
do not contact GeoNames.
