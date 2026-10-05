import { strict as assert } from "node:assert";
import { test } from "node:test";

import { getJobLocationReviewIssues, sanitizeLocation, splitJobLocations } from "./job-location";

test("accepts verified Replit, Lovable, and Perplexity office locations", () => {
  assert.equal(sanitizeLocation("Foster City, California, United States"), "Foster City, CA");
  assert.equal(sanitizeLocation("Stockholm, Sweden | Lund, Sweden"), "Stockholm, Sweden | Lund, Sweden");
  assert.deepEqual(getJobLocationReviewIssues("Foster City, CA | Lund, Sweden | Belgrade, Serbia"), []);
  assert.deepEqual(getJobLocationReviewIssues("Belgrade | Lund"), ["Belgrade", "Lund"]);
});

test("accepts HiringCafe's verified Cupertino office location", () => {
  assert.equal(sanitizeLocation("Cupertino, CA"), "Cupertino, CA");
  assert.deepEqual(getJobLocationReviewIssues("Cupertino, CA"), []);
});

test("includes states for Heidi's US and Australian city labels", () => {
  assert.equal(sanitizeLocation("Denver"), "Denver, CO");
  assert.equal(sanitizeLocation("Sydney, Australia"), "Sydney, NSW");
  assert.equal(sanitizeLocation("Melbourne, Australia"), "Melbourne, VIC");
  assert.equal(sanitizeLocation("Brisbane"), "Brisbane, QLD");
  assert.equal(
    sanitizeLocation("Sydney | Sydney, NSW | Melbourne | Brisbane, Queensland"),
    "Sydney, NSW | Melbourne, VIC | Brisbane, QLD",
  );
});

test("uses one city format without inventing a city for country-only roles", () => {
  assert.equal(sanitizeLocation("Japan"), "Japan");
  assert.equal(sanitizeLocation("Japan (Tokyo)"), "Tokyo, Japan");
  assert.equal(sanitizeLocation("Calgary | Ottawa, Canada | Halifax | Canberra"), "Calgary, AB | Ottawa, ON | Halifax, NS | Canberra, ACT");
  assert.equal(sanitizeLocation("Bangalore India | Bengaluru, Karnataka"), "Bengaluru, India");
  assert.equal(sanitizeLocation("Zurich | Zürich, Switzerland"), "Zürich, Switzerland");
  assert.equal(sanitizeLocation("Ontario, Canada"), "Ontario, Canada");
  assert.equal(sanitizeLocation("Victoria"), "Victoria");
  assert.equal(sanitizeLocation("Richmond"), "Richmond");
  assert.deepEqual(getJobLocationReviewIssues("Richmond"), ["Richmond"]);
  assert.deepEqual(getJobLocationReviewIssues("Some Unknown City"), ["Some Unknown City"]);
});

test("normalizes remote notation but preserves eligibility and workplace qualifiers", () => {
  assert.equal(sanitizeLocation("US - Remote | United States (Remote) | Remote (US)"), "Remote - United States");
  assert.equal(sanitizeLocation("Remote, AMER | Remote, Global | Ontario - Remote"), "Remote - Americas | Remote - Worldwide | Remote - Ontario");
  assert.equal(sanitizeLocation("Bangalore - Remote"), "Remote - Bengaluru, India");
  assert.equal(sanitizeLocation("Remote - Spain, United Kingdom, Ireland"), "Remote - Spain, United Kingdom, Ireland");
  assert.equal(sanitizeLocation("Remote-Friendly (Travel-Required)"), "Remote-Friendly (Travel Required)");
  assert.equal(sanitizeLocation("Hybrid - Sydney, Australia | San Francisco, CA (On-site) | Toronto Hub"), "Hybrid - Sydney, NSW | San Francisco, CA (On-site) | Toronto, ON Hub");
});

test("separates reviewed explicit alternatives without dropping broad regions", () => {
  assert.equal(sanitizeLocation("Europe (London | Brussels | Munich)"), "Europe | London, UK | Brussels, Belgium | Munich, Germany");
  assert.equal(sanitizeLocation("Middle East (Dubai | Riyadh)"), "Middle East | Dubai, United Arab Emirates | Riyadh, Saudi Arabia");
  assert.equal(sanitizeLocation("London & Amsterdam"), "London, UK | Amsterdam, Netherlands");
  assert.equal(sanitizeLocation("San Francisco, US or Toronto, Canada (Preferred) OR Remote (Americas, UTC-3 to UTC-10)"), "San Francisco, CA | Toronto, ON (Preferred) | Remote - Americas, UTC-3 to UTC-10");
});

test("separates repeated US city/state pairs without splitting one address", () => {
  assert.equal(
    sanitizeLocation("San Francisco, CA, New York City, NY, Seattle, WA"),
    "San Francisco, CA | New York, NY | Seattle, WA",
  );
  assert.equal(
    sanitizeLocation("New York City, New York, United States"),
    "New York, NY",
  );
});

test("keeps source remote regions distinct while expanding unambiguous country codes", () => {
  assert.deepEqual(
    splitJobLocations(
      "London, UK; Ontario, CAN; Remote-Friendly, United States; San Francisco, CA",
    ),
    [
      "London, UK",
      "Ontario, Canada",
      "Remote-Friendly, United States",
      "San Francisco, CA",
    ],
  );
  assert.equal(
    sanitizeLocation("Dublin, IE | Zürich, CH"),
    "Dublin, Ireland | Zürich, Switzerland",
  );
});

test("separates verified hybrid-city lists and leaves ambiguous regional lists alone", () => {
  assert.equal(
    sanitizeLocation("Hybrid - San Francisco, New York City, Austin"),
    "Hybrid - San Francisco, CA | Hybrid - New York, NY | Hybrid - Austin, TX",
  );
  assert.equal(sanitizeLocation("Hybrid - London"), "Hybrid - London, UK");
  assert.equal(
    sanitizeLocation("San Francisco or Palo Alto"),
    "San Francisco, CA | Palo Alto, CA",
  );
  assert.equal(
    sanitizeLocation("Remote - Spain, United Kingdom, Ireland"),
    "Remote - Spain, United Kingdom, Ireland",
  );
  assert.equal(
    sanitizeLocation("Pune or Bangalore, India"),
    "Pune, India | Bengaluru, India",
  );
  assert.equal(
    sanitizeLocation("San Francisco | San Francisco"),
    "San Francisco, CA",
  );
});

test("canonicalizes city aliases without changing remote scope or uncertain places", () => {
  assert.equal(
    sanitizeLocation("Melbourne | Melbourne, Australia | Sydney"),
    "Melbourne, VIC | Sydney, NSW",
  );
  assert.equal(
    sanitizeLocation("San Francisco | San Francisco, California | San Francisco, CA"),
    "San Francisco, CA",
  );
  assert.equal(
    sanitizeLocation("New York City, NY | New York, New York | New York"),
    "New York, NY",
  );
  assert.equal(
    sanitizeLocation("Hybrid - San Francisco | Toronto, Ontario, Canada | London"),
    "Hybrid - San Francisco, CA | Toronto, ON | London, UK",
  );
  assert.equal(sanitizeLocation("Remote - San Francisco"), "Remote - San Francisco, CA");
  assert.equal(sanitizeLocation("Remote (Canada)"), "Remote - Canada");
  assert.equal(sanitizeLocation("Portland"), "Portland");
  assert.equal(sanitizeLocation("San Francisco Bay Area"), "San Francisco Bay Area, CA");
  assert.equal(
    sanitizeLocation("San Francisco HQ | Toronto Hub"),
    "San Francisco, CA HQ | Toronto, ON Hub",
  );
  assert.equal(
    sanitizeLocation("San Francisco or NYC | San Francisco, Amsterdam"),
    "San Francisco, CA | New York, NY | Amsterdam, Netherlands",
  );
  assert.equal(
    sanitizeLocation("United States (New York | San Francisco)"),
    "New York, NY | San Francisco, CA",
  );
});
