export type LatLng = { lat: number; lng: number };

/**
 * Standalone Leaflet page for the in-app map (rendered in a WebView).
 * Tiles: OpenStreetMap standard. RN drives markers through
 * `window.IslaMap.setPoints()` via injected JS — never rebuild the HTML,
 * or the map state (zoom/pan) resets on every location tick.
 */
export function buildMapHtml(center: LatLng, zoom = 12): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
  #map { width: 100%; height: 100%; background: #e8f0ec; }
  .pin { width: 34px; height: 34px; border-radius: 50% 50% 50% 4px; transform: rotate(-45deg);
    border: 3px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,.35);
    display: flex; align-items: center; justify-content: center; }
  .pin > span { transform: rotate(45deg); color: #fff; font: 700 15px system-ui; line-height: 1; }
  .pin-self { background: #065F59; }
  .pin-other { background: #E8590C; }
  .pin-search { background: #1971C2; }
  .pulse { width: 14px; height: 14px; border-radius: 50%; background: #065F59; border: 3px solid #fff;
    box-shadow: 0 0 0 6px rgba(6,95,89,.25); }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: false }).setView([${center.lat}, ${center.lng}], ${zoom});
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  var streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  var humanitarian = L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap contributors, HOT'
  });
  var layerAlt = false;

  function makePin(cls, glyph) {
    return L.divIcon({ className: '', html: '<div class="pin ' + cls + '"><span>' + glyph + '</span></div>',
      iconSize: [34, 34], iconAnchor: [17, 32], popupAnchor: [0, -30] });
  }
  var selfMarker = null, otherMarker = null, searchMarker = null;

  function upsert(marker, lat, lng, cls, glyph, label) {
    var ll = [lat, lng];
    if (marker) { marker.setLatLng(ll); }
    else { marker = L.marker(ll, { icon: makePin(cls, glyph) }).addTo(map); }
    if (label) marker.bindTooltip(label, { direction: 'top', offset: [0, -34] });
    return marker;
  }

  function fitAll() {
    var pts = [];
    if (selfMarker) pts.push(selfMarker.getLatLng());
    if (otherMarker) pts.push(otherMarker.getLatLng());
    if (searchMarker) pts.push(searchMarker.getLatLng());
    if (pts.length === 0) return;
    if (pts.length === 1) { map.flyTo(pts[0], Math.max(map.getZoom(), 15), { duration: 0.6 }); return; }
    map.flyToBounds(L.latLngBounds(pts).pad(0.25), { duration: 0.6 });
  }

  window.IslaMap = {
    setPoints: function (self, selfLabel, other, otherLabel, fit) {
      if (self) selfMarker = upsert(selfMarker, self.lat, self.lng, 'pin-self', 'Y', selfLabel || 'You');
      if (other) otherMarker = upsert(otherMarker, other.lat, other.lng, 'pin-other', 'R', otherLabel || 'Rider');
      if (fit) fitAll();
      return true;
    },
    showSearch: function (lat, lng, label) {
      searchMarker = upsert(searchMarker, lat, lng, 'pin-search', 'S', label || '');
      map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
      return true;
    },
    clearSearch: function () {
      if (searchMarker) { map.removeLayer(searchMarker); searchMarker = null; }
      return true;
    },
    locate: function (lat, lng) {
      map.flyTo([lat, lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
      return true;
    },
    fitAll: function () { fitAll(); return true; },
    toggleLayer: function () {
      layerAlt = !layerAlt;
      if (layerAlt) { map.removeLayer(streets); humanitarian.addTo(map); }
      else { map.removeLayer(humanitarian); streets.addTo(map); }
      return layerAlt;
    }
  };

  map.on('moveend', function () {
    var c = map.getCenter();
    post({ type: 'move', lat: c.lat, lng: c.lng, zoom: map.getZoom() });
  });
  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }
  post({ type: 'ready' });
</script>
</body>
</html>`;
}
