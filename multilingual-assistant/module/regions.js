/**
 * Nearest-town language guess. Town names, coordinates, and bounds live in
 * data/regions.json. This file only measures distance. It does not store
 * or send a position.
 */

var regionsPromise = null;

export function loadRegions() {
  if (!regionsPromise) {
    var url = new URL("data/regions.json", import.meta.url);
    regionsPromise = fetch(url).then(function (response) {
      if (!response.ok) throw new Error("regions");
      return response.json();
    }).catch(function (error) {
      regionsPromise = null;
      throw error;
    });
  }
  return regionsPromise;
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  var earth = 6371;
  var rad = Math.PI / 180;
  var dLat = (lat2 - lat1) * rad;
  var dLon = (lon2 - lon1) * rad;
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  return earth * c;
}

/**
 * language is null when the point is outside the Ethiopia box.
 * Inside the box, language is the nearest town, or the table's fallback
 * when nothing is close enough or the two nearest towns disagree and sit
 * within ambiguousKm of each other.
 */
export function matchArea(lat, lon, table) {
  var data = table || {};
  var box = data.ethiopia || {};
  var latitude = Number(lat);
  var longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { language: null, reason: "outside", town: "" };
  }
  if (
    latitude < Number(box.latMin) ||
    latitude > Number(box.latMax) ||
    longitude < Number(box.lonMin) ||
    longitude > Number(box.lonMax)
  ) {
    return { language: null, reason: "outside", town: "" };
  }
  var maxKm = Number(data.maxKm);
  if (!Number.isFinite(maxKm)) maxKm = 150;
  var ambiguousKm = Number(data.ambiguousKm);
  if (!Number.isFinite(ambiguousKm)) ambiguousKm = 20;
  var fallback = typeof data.fallback === "string" && data.fallback ? data.fallback : "am";
  var towns = Array.isArray(data.towns) ? data.towns : [];
  var ranked = [];
  for (var i = 0; i < towns.length; i += 1) {
    var town = towns[i];
    if (!town || typeof town.lang !== "string") continue;
    var townLat = Number(town.lat);
    var townLon = Number(town.lon);
    if (!Number.isFinite(townLat) || !Number.isFinite(townLon)) continue;
    ranked.push({
      town: town,
      distance: haversineKm(latitude, longitude, townLat, townLon),
    });
  }
  ranked.sort(function (a, b) {
    return a.distance - b.distance;
  });
  var nearest = ranked[0];
  if (!nearest || nearest.distance > maxKm) {
    return { language: fallback, reason: "fallback", town: nearest ? nearest.town.name : "" };
  }
  var second = ranked[1];
  if (second && nearest.town.lang !== second.town.lang) {
    var between = haversineKm(
      Number(nearest.town.lat),
      Number(nearest.town.lon),
      Number(second.town.lat),
      Number(second.town.lon)
    );
    if (between <= ambiguousKm) {
      return { language: fallback, reason: "ambiguous", town: nearest.town.name };
    }
  }
  return {
    language: nearest.town.lang,
    reason: "town",
    town: nearest.town.name || "",
  };
}
