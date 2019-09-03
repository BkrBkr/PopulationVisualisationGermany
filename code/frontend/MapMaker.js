/*
 *	 PopulationVisualisationGermany - The web GIS application "PopulationVisualisationGermany" visualises the changes in the distribution of the population in Germany over time.
 *   Copyright (C) 2019 Björn Kremer und Thomas Rozanski
 *
 *   This program is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
const colorEnum = { colorByAmountType: 1, uniqueColorType: 2 };
const zoomEnum = { regularZoom: 0, adjustedZoom: 1 };
const layerEnum = {
  heatMapLayer: 0,
  layerColoredByAmount: 1,
  layerColoredUnique: 2
};

class MapMaker {
  //Initialisierung der Klasse
  constructor(nodeJSURL, mapServerURL, mapName) {
    //Hostanteil der URL zum Backend bzw. Mapserver
    this.nodeJSURL = nodeJSURL;
    this.mapServerURL = mapServerURL;

    //Um das Austauschen der Bundesländer und der Heatmap zu vereinfachen werden zwei leere FeatureGroups verwendet.
    //FeatureGroups lassen sich einfach leeren, ohne das man die Referenz auf das eigentliche Layer-Objekt vorhalten muss.
    //Das erspart das Pflegen von zusätzlichen Properties für die einzelnen Objektreferenzen
    this.heatMapLayerWrapper = new L.FeatureGroup();
    this.blLayerWrapper = new L.FeatureGroup();

    //Erzeugung der Karte
    //Verwendung des OpenStreetmap-Layer, sowie der zwei leeren FeatureGroups
    //Zentriert auf Deutschland
    this.map = new L.Map(mapName, {
      center: new L.LatLng(51.39920565355378, 10.239257812500002),
      zoom: 6,
      maxZoom: 12,
      minZoom: 6,
      layers: [
        this.getOpenStreetmapLayer(),
        this.heatMapLayerWrapper,
        this.blLayerWrapper
      ]
    });

    //Cache für HTTP-Anfragen
    this.httpCache = new Map();

    //"Legende" für Piechart/Linechart vorbereiten
    this.legend = this.createLegend();
    this.registerChartLinePlugin();
  }

  //Diese Funktion erzeugt ein Control in der rechten unteren Ecke der Karte
  //Das Control ist eine Div, die als Platzhalter für die anzuzeigende Piechart dient.
  createLegend() {
    //Control rechts unten auf der Karte
    var legend = L.control({ position: "bottomright" });
    legend.onAdd = function() {
      //Div mit Canvas für die Piechart. (Piechart wird beim Hinzufügen des Layers initialisiert)
      var div = L.DomUtil.create("div", "info legend");
      div.innerHTML = '<canvas id="myChart" ></canvas>';
      return div;
    };
    return legend;
  }

  //Führt eine HTTP-GET Anfrage aus
  async ajaxGet(url) {
    //Anfragen cachen um Performance zu erhöhen
    if (this.httpCache.has(url)) {
      return this.httpCache.get(url);
    }
    var result = null;
    try {
      //Anfrage mit JQuery durchführen
      result = await $.get(url);
    } catch (e) {
      //Fehlerbehandlung: Bei "NotReachable" gesondertes Fehlerobjekt erzeugen.
      if (e.status === 0) throw new ErrorNotReachable(url, e);

      throw new GETError(url, e.status, e);
    }
    this.httpCache.set(url, result);
    return result;
  }

  //Liefert einen OpenStreetmap-Tile-Layer für die Anzeige der "Grundkarte"
  getOpenStreetmapLayer() {
    return L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {}
    );
  }

  //Diese Funktion ruft die Einwohnerzahlen pro Bundesland vom Server ab.
  async loadPopulationByBLFromServer(dataYear, gender) {
    return await this.ajaxGet(
      this.nodeJSURL + "population/populationByBL/" +
        dataYear +
        "?gender=" +
        gender
    );
  }

  //Diese Funktion erfragt die Bevölkerung pro Bundesland vom NodeJS Backend und bereitet diese auf
  async getBLPopulationData(dataYear, gender) {
    //Abruf der Rohdaten vom Backend
    var blData = await this.loadPopulationByBLFromServer(dataYear, gender);

    //Für die Einfärbung der Karte nach Bevölkerungszahl ist die minimale und die maximale relative Bevölkerung pro Bundesland (im Vergleich zu Deutschland) wichtig
    //Für die Einfärbung wird eine "Zielfarbe" für den kleinsten Wert, den Mittelwert und den Max-Wert vorgegeben.
    var minP = Number.MAX_SAFE_INTEGER;
    var maxP = 0;

    //Die verwendete Chart verlangt 3 Arrays: ...
    //... 'values' mit der absoluten Bevölkerungszahl pro Bundesland
    var values = [];
    //... keys für die Beschriftungen
    var keys = [];
    //... eine Farbe für jeden Wert
    var colors = [];

    for (var propertyName in blData) {
      var value = blData[propertyName];

      //Die Angaben für Value und Key für die Piechart können direkt aus der Rückgabe des Servers gelesen werden
      values.push(value.count);
      keys.push(propertyName);
      //Für jedes Bundesland wird eine eindeutige Farbe anhand dessen Datenbank-ID bestimmt.
      colors.push(this.getUniqueColor(blData[propertyName].id));

      //Ermittlung von minimaler und maximaler relativer Bevölkerungszahl für "Einfärbung der Karte nach Bevölkerungszahl"
      var p = value.percent / 100;
      if (p < minP) {
        minP = p;
      }
      if (p > maxP) {
        maxP = p;
      }
    }
    //Bestimmung der "Zielfarben" für die Ansicht "Einfärbung der Karte nach Bevölkerungszahl"
    //Für kleinste, mittlere und höchste Prozentangabe jeweils eine Farbe definieren
    var percentColors = [
      { pct: minP, color: { r: 0xff, g: 0x00, b: 0 } },
      { pct: (minP + maxP) / 2, color: { r: 0xff, g: 0xff, b: 0 } },
      { pct: maxP, color: { r: 0x00, g: 0xff, b: 0 } }
    ];
    //Rückgabe der aufbereiteten Daten
    return {
      data: blData,
      percentColors: percentColors,
      values: values,
      keys: keys,
      colors: colors
    };
  }

  //Diese Funktion erfragt die Grenzen der Bundesländer vom Mapserver als GeoJSON
  async loadMapServerData() {
    //Cachen der Daten
    if (this.mapServerData) {
      return this.mapServerData;
    }
    //Abfrage von Features (GetFeature) vom Mapserver: Abgefragt wird der Layer 'bl' im Format 'geojson' in EPSG:4326
    this.mapServerData = await this.ajaxGet(
      this.mapServerURL +
        "cgi-bin/mapserv.exe?service=WFS&version=1.1.0&request=GetFeature&typename=ms:bl&outputformat=geojson&srsname=EPSG:4326"
    );
    return this.mapServerData;
  }

  //Erzeugt einen Layer der die Grenzen der Bundesländer anzeigt.
  //Die Grenzen werden schwarz eingefärbt. (Wird in Kombination mit der Heatmap eingesetzt)
  async getBLLayerColoredBlack() {
    //Layer cachen um Performance zu erhöhen
    if (this.blLayerColoredBlack) {
      return this.blLayerColoredBlack;
    }

    //Einfärbung in schwarz mit einer schmalen Strichbreite und transparentem Innenbereich
    var blackStyle = {
      fillColor: "transparent",
      color: "#000000",
      weight: 1,
      opacity: 0.99
    };

    //Abfrage der Grenzen der Bundesländer vom MapServer
    var data = await this.loadMapServerData();

    //Extra FeatureGroup ist hier nicht zwingend notwendig. Um konsistent mit den anderen 'getBLLayer'-Funktionen zu sein, wird sie trotzdem verwendet.
    var blLayerGroup = new L.FeatureGroup();
    //Layer aus geoJSON erzeugen und mit schwarzem Style versehen.
    var blLayer = L.geoJSON(data, {
      //Einfärbung der einzelnen Feature (Bundesländer)
      onEachFeature: function(feature, layer) {
        layer.setStyle(blackStyle);
      }
    });
    blLayerGroup.addLayer(blLayer);
    this.blLayerColoredBlack = blLayerGroup;
    return blLayerGroup;
  }

  //Erzeugt einen Layer der die Grenzen der Bundesländer anzeigt.
  //Die Grenzen werden anhand der relativen Bevölkerungszahl eingefärbt
  async getBLLayerColoredByAmount(dataYear, gender) {
    var blData = await this.getBLPopulationData(dataYear, gender);
    return await this.getBLLayerColoredBy(
      colorEnum["colorByAmountType"],
      blData
    );
  }

  //Erzeugt einen Layer der die Grenzen der Bundesländer anzeigt.
  //Die Grenzen werden eindeutig eingefärbt
  async getBLLayerColoredUnique(blData) {
    return await this.getBLLayerColoredBy(colorEnum["uniqueColorType"], blData);
  }

  //Erzeugt einen Layer der die Grenzen der Bundesländer anzeigt.
  //Die Grenzen werden je nach 'type' Parameter eindeutig oder anhand der relativen Bevölkerungszahl eingefärbt
  //type=1 nach relativer Bevölkerungszahl
  //type=2 eindeutig
  //blData = Nach Bundesland aufbereitete Einwohnerzahlen. Siehe Funktion 'getBLPopulationData'
  async getBLLayerColoredBy(type, blData) {
    //Abfrage der Grenzen der Bundesländer vom MapServer
    var data = await this.loadMapServerData();
    var self = this;

    //Neben dem eigentlichen Bundesland-Layer werden auch 'marker' erzeugt.
    //Alle erzeugten Objekte werden in einer 'FeatureGroup' zusammengefasst
    var blLayerGroup = new L.FeatureGroup();

    //Erzeugen des Bundesland-Layers anhand der Daten des Backends
    var blLayer = L.geoJSON(data, {
      //Einfärbung der einzelnen Feature (Bundesländer)
      onEachFeature: function(feature, layer) {
        //Für jedes Bundesland:

        //Auslesen des Bundeslands aus Backend-Daten anhand des aktuellen Features (Bundesland)
        var currentBLData = blData.data[feature.properties.GEN];

        //relative Bevölkerungszahl des aktuellen Bundeslands
        var percent = currentBLData.percent;

        var color = null;
        switch (type) {
          case colorEnum["colorByAmountType"]:
            //Einfärbung anhand der relativen Bevölkerungszahl
            color = self.getColorForPercentage(
              percent / 100,
              blData.percentColors //Für die Einfärbung zu nutzender Farbraum
            );
            break;
          case colorEnum["uniqueColorType"]:
            color = self.getUniqueColor(currentBLData.id); //Eindeutige Farbe anhand der Datensatz-ID bestimmen
            break;
          default:
            throw "Unbekannter Typ";
        }
        layer.setStyle({
          color: color,
          weight: 3
        });
        //Jedes Bundesland erhält einen eigenen Marker. Dieser zeigt den Namen des Bundeslands und die relative Bevölkerungszahl in einem Label an
        //Positioniert wird der Marker an der vom Backend vorgegebenen Position.
        var label = L.marker(
          L.latLng(currentBLData.center.lat, currentBLData.center.lng)
        )
          .bindTooltip(feature.properties.GEN + " " + percent + "%", {
            permanent: true
          })
          .openTooltip();
        blLayerGroup.addLayer(label);
      }
    });
    blLayerGroup.addLayer(blLayer);
    return blLayerGroup;
  }

  //Diese Funktion erzeugt ein neues HeatmapOverlay-Objekt für die Verwendung als Kartenlayer.
  async getHeaptmapLayer() {
    //Laut Dokumentation sollte man das 'HeatmapOverlay' cachen können.
    //Allerdings verändert sich durch das Cachen die Farbgebung, was auf einen Fehler schließen lässt.
    //Daher kein Caching...schade

    //Konfiguration des Overlay
    var cfg = {
      // radius should be small ONLY if scaleRadius is true (or small radius is intended)
      radius: 30,
      maxOpacity: 0.8,
      // scales the radius based on map zoom
      scaleRadius: false,
      // if set to false the heatmap uses the global maximum for colorization
      // if activated: uses the data maximum within the current map boundaries
      //   (there will always be a red spot with useLocalExtremas true)
      useLocalExtrema: true,
      // which field name in your data represents the latitude - default "lat"
      latField: "lat",
      // which field name in your data represents the longitude - default "lng"
      lngField: "lng",
      // which field name in your data represents the data value - default "value"
      valueField: "count"
    };

    //Instanz erzeugen und cachen
    var heatmapLayer = new HeatmapOverlay(cfg);
    this.heatmapLayer = heatmapLayer;
    return heatmapLayer;
  }

  //Diese Funktion ruft die Einwohnerzahlen pro Gemeinde vom Server ab.
  async loadPopulationFromServer(dataYear, gender) {
    return await this.ajaxGet(
      this.nodeJSURL + "population/data/" + dataYear + "?gender=" + gender
    );
  }

  //Fügt der Karte einen Heatmap-Layer hinzu.
  //Die Daten werden anhand des Jahres und des Geschlechtes vom Backend abgerufen
  async addHeatMap(dataYear, gender) {
    //Eventuell bereits vorhandene Heatmap von der Karte entfernen.
    this.heatMapLayerWrapper.clearLayers();

    //Neues Heatmap-Objekt erzeugen
    var heatmapLayer = await this.getHeaptmapLayer();

    //Heatmap-Objekt der Karte (über FeatureGroup) zuweisen
    heatmapLayer.addTo(this.heatMapLayerWrapper);

    //Abrufen der Daten vom Backend
    var data = await this.loadPopulationFromServer(dataYear, gender);

    //Die Daten vom Backend sind bereits passend formatiert, daher können sie direkt an die Heatmap übergeben werden.
    heatmapLayer.setData(data);

    var that = this;

    //HeatMap nicht durch die Line-Chart ausbremsen
    setTimeout(function() {
      that.addLineLegend(gender, dataYear);
    }, 1);
  }

  //Entfernt die Heatmap von der Karte
  removeHeatMap() {
    this.heatMapLayerWrapper.clearLayers();
  }

  //Setzt den MinZoom der Karte entsprechend der aktuellen Ansicht.
  //Die Label der Marker überlappen stark bei einem Zoomlevel der kleiner ist als 7. Daher MinZoom=7, wenn Marker gezeigt werden
  //Ansonsten ist 6 ein guter MinZoom.
  setZoom(type) {
    switch (type) {
      case zoomEnum["regularZoom"]:
        this.map.setMinZoom(6);
        break;
      case zoomEnum["adjustedZoom"]:
	  
        if (this.map.getZoom() < 7) {
          this.map.setZoom(7);
        }
        this.map.setMinZoom(7);
        break;
      default:
        throw "Unbekannter Typ";
    }
  }

  //Fügt die Grenzen der Karte einen Layer mit den Grenzen der Bundesländer hinzu. Farbe der Grenzen je nach 'type' Parameter:
  //0 = Alle Grenzen schwarz
  //1 = Bundesländer anhand der realtiven Bevölkerungszahlen gefärbt
  //2 = Eindeutige Farbe für jedes Bundesland
  //Daten werden anhand von 'dataYear' und 'gender' vom Backend abgerufen
  async addBLLayer(dataYear, type, gender) {
    //Eventuell bereits vorhandenen Layer von der Karte entfernen.
    this.blLayerWrapper.clearLayers();
    //Layer entsprechend des 'type' erzeugen
    var blLayer = null;
    switch (type) {
      case layerEnum["heatMapLayer"]:
        blLayer = await this.getBLLayerColoredBlack();
        break;
      case layerEnum["layerColoredByAmount"]:
        blLayer = await this.getBLLayerColoredByAmount(dataYear, gender);
        this.removeLegend();
        break;
      case layerEnum["layerColoredUnique"]:
        var blData = await this.getBLPopulationData(dataYear, gender);
        blLayer = await this.getBLLayerColoredUnique(blData);

        //Wenn die Bundesländer eindeutig gefärbt sind, kann die Piechart angezeigt werden. (Bei allen anderen Ansichten ist sie störend/unübersichtlich)
        this.addPieLegend(blData.values, blData.keys, blData.colors);
        break;
      default:
        throw "Unbekannter Typ";
    }
    //Layer anzeigen
    blLayer.addTo(this.blLayerWrapper);
  }

  //Fügt der Karte die Linechart hinzu
  async addLineLegend(gender, dataYear) {
    this.removeLegend();
    this.legend.addTo(this.map);
    $("#myChart").css("background-color", "white");
    $("#myChart").css("box-shadow", "0 4px 8px 0 rgba(0, 0, 0, 0.6)");

    var data = await this.ajaxGet(
      this.nodeJSURL + "population/lineChartData/?gender=" + gender
    );

    //Erzeugung der Linechart anhand der erhaltenen Daten
    var ctx = $("#myChart")[0].getContext("2d");
    new Chart(ctx, {
      type: "line",
      data: {
        labels: data.labels,
        datasets: data.dataSets
      },
      lineAtIndex: [data.labels.indexOf(dataYear)],
      options: {
        responsive: false,
        animation: false
      }
    });
  }

  //Fügt der Karte die Piechart hinzu
  addPieLegend(values, keys, colors) {
    this.removeLegend();
    this.legend.addTo(this.map);

    $("#myChart").css("background-color", "transparent");
    var ctx = $("#myChart")[0].getContext("2d");

    //Erzeugung der Piechart anhand der aufbereiteten Daten
    new Chart(ctx, {
      type: "pie",
      data: {
        labels: keys,
        datasets: [
          {
            data: values,
            backgroundColor: colors
          }
        ]
      },
      options: {
        responsive: false,
		animation: false,
        legend: {
          display: false
        }
      }
    });
  }

  //Entfernt die Piechart von den Karten
  removeLegend() {
    this.legend.remove();
  }

  //Ruft die verfügbaren Jahre vom Backend ab.
  async loadAvailableYears(option) {
    return await this.ajaxGet(
      this.nodeJSURL + "population/availableYears/" + option
    );
  }

  //Hilfsfunktion Quelle dieser Funktion ist: https://stackoverflow.com/questions/7128675/from-green-to-red-color-depend-on-percentage
  hexFromRGB(r, g, b) {
    var hex = [r.toString(16), g.toString(16), b.toString(16)];
    $.each(hex, function(nr, val) {
      if (val.length === 1) {
        hex[nr] = "0" + val;
      }
    });
    return "#" + hex.join("").toUpperCase();
  }

  //Hilfsfunktion Quelle dieser Funktion ist: https://stackoverflow.com/questions/7128675/from-green-to-red-color-depend-on-percentage
  getColorForPercentage(pct, percentColors) {
    if (pct === 0) return "#808080";
    for (var i = 1; i < percentColors.length - 1; i++) {
      if (pct < percentColors[i].pct) {
        break;
      }
    }
    var lower = percentColors[i - 1];
    var upper = percentColors[i];
    var range = upper.pct - lower.pct;
    var rangePct = (pct - lower.pct) / range;
    var pctLower = 1 - rangePct;
    var pctUpper = rangePct;
    var color = {
      r: Math.floor(lower.color.r * pctLower + upper.color.r * pctUpper),
      g: Math.floor(lower.color.g * pctLower + upper.color.g * pctUpper),
      b: Math.floor(lower.color.b * pctLower + upper.color.b * pctUpper)
    };
    return this.hexFromRGB(color.r, color.g, color.b);
    // or output as hex if preferred
  }

  //Liste von eindeutigen Farben für die Einfärbung der Bundesländer. Generiert mit: https://mokole.com/palette.html
  getUniqueColor(id) {
    var colors = [
      "#2f4f4f",
      "#a52a2a",
      "#006400",
      "#b8860b",
      "#4b0082",
      "#ff0000",
      "#00ced1",
      "#7cfc00",
      "#0000ff",
      "#ff00ff",
      "#1e90ff",
      "#ffff54",
      "#dda0dd",
      "#90ee90",
      "#ff1493",
      "#ffdab9"
    ];
    var color = colors[id - 1];
    //Fallbackfarbe grau (Für Datensätze mit fehlendem Ostdeutschland)
    if (!color) color = "#808080";
    return color;
  }
  
  //Registiert ein Plugin um eine vertikale Linie in die Chart zu zeichnen
  //Quelle dieser Funktion ist: https://stackoverflow.com/questions/30256695/chart-js-drawing-an-arbitrary-vertical-line
  registerChartLinePlugin() {
    const verticalLinePlugin = {
      getLinePosition: function(chart, pointIndex) {
        const meta = chart.getDatasetMeta(0); // first dataset is used to discover X coordinate of a point
        const data = meta.data;
        return data[pointIndex]._model.x;
      },
      renderVerticalLine: function(chartInstance, pointIndex) {
        const lineLeftOffset = this.getLinePosition(chartInstance, pointIndex);
        const scale = chartInstance.scales["y-axis-0"];
        const context = chartInstance.chart.ctx;

        // render vertical line
        context.beginPath();
        context.strokeStyle = "#000000";
        context.moveTo(lineLeftOffset, scale.top);
        context.lineTo(lineLeftOffset, scale.bottom);
        context.stroke();

        // write label
        //context.fillStyle = "#ff0000";
        //context.textAlign = 'center';
        //context.fillText('MY TEXT', lineLeftOffset, (scale.bottom - scale.top) / 2 + scale.top);
      },

      afterDatasetsDraw: function(chart, easing) {
        if (chart.config.lineAtIndex) {
          chart.config.lineAtIndex.forEach(pointIndex =>
            this.renderVerticalLine(chart, pointIndex)
          );
        }
      }
    };

    Chart.plugins.register(verticalLinePlugin);
  }

  //Vorladen der nächsten Daten um u.a. die Animation flüssiger zu gestalten.
  async preload(dataYear, gender, type, availableYears) {
    try {
      for (var i = 1; i <= 3; i++) {
        if (availableYears.includes(dataYear + 1)) {
          dataYear = dataYear + 1;
        } else if (availableYears.includes(dataYear + 5)) {
          dataYear = dataYear + 5;
        } else {
          dataYear = availableYears[0];
        }

        switch (type) {
          case layerEnum["heatMapLayer"]:
            await this.loadPopulationFromServer(dataYear, gender);
            break;
          case layerEnum["layerColoredByAmount"]:
          case layerEnum["layerColoredUnique"]:
            await this.loadPopulationByBLFromServer(dataYear, gender);
            break;
          default:
            throw "Unbekannter Typ";
        }
      }
    } catch (e) {
      console.log(e); //Fehler in dieser Funktion sollte nicht die komplette Anwendung behindern.
    }
  }
}

//Exception Klasse für allgemeine HTTP-Fehler
class GETError {
  constructor(url, code, innerException) {
    this.url = url;
    this.code = code;
    this.innerException = innerException;
  }
  getURL() {
    return this.url;
  }
  getCode() {
    return this.code;
  }
  getInnerException() {
    return this.innerException;
  }
}

//Exception Klasse für speziellen HTTP-Fehler "NotReachable"
class ErrorNotReachable {
  constructor(url, innerException) {
    this.url = url;
    this.innerException = innerException;
  }
  getURL() {
    return this.url;
  }
  getInnerException() {
    return this.innerException;
  }
}
