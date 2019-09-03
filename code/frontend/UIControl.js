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
class UIControl {
  //Initialisierungen
  constructor() {
    this.animation = null;
    this.toggled = true;
    this.lastOption = -1;
    this.stateLayerChanged = true;

    $("#stopAnimationButton").hide();
    var self = this;
    $("#startAnimationButton").click(function() {
      self.startAnimation();
      $("#startAnimationButton").hide();
      $("#stopAnimationButton").show();
    });
    $("#stopAnimationButton").click(function() {
      self.stopAnimation();
      $("#stopAnimationButton").hide();
      $("#startAnimationButton").show();
    });
  }

  //Initialsiert das Menü.
  //Positioniert das ZoomControl passend zum Menü
  //Kümmert sich um die Ein-/Ausblendenfunktionalität des Menüs
  initMenu() {
    $(".leaflet-control-zoom").css(
      "marginLeft",
      Math.round($("#menuWrapper").width() + 10) + "px"
    );
    var toggleMenuLeft = $("#menuWrapper").width() - $("#toggleMenu").width();

    $("#toggleMenuWrapper").css("left", toggleMenuLeft + "px");
    var toggled = !$("#menuWrapper").is(":hidden");
    $("#toggleMenu").click(function(e) {
      e.preventDefault();

      $("#menuWrapper").toggle({
        step: function() {
          var zoomControlLeft = $("#menuWrapper").width() + 10;
          if (zoomControlLeft < $("#toggleMenu").width() + 10)
            zoomControlLeft = $("#toggleMenu").width() + 10;

          var toggleMenuLeft =
            $("#menuWrapper").width() - $("#toggleMenu").width();
          if (toggleMenuLeft < 1) toggleMenuLeft = 1;

          $(".leaflet-control-zoom").css("marginLeft", zoomControlLeft + "px");
          $("#toggleMenuWrapper").css("left", toggleMenuLeft + "px");
        },
        direction: "left",
        duration: 1000,
        progress: function(animation, progress, remainingMS) {
          if (toggled && remainingMS < 400) {
            $("#toggleMenuImg").attr("src", "images/icons8-menü-filled-50.png");
          } else if (remainingMS < 400) {
            $("#toggleMenuImg").attr("src", "images/arrow-left.png");
          }
        },

        done: function() {
          toggled = !$(this).is(":hidden");
        }
      });
      return false;
    });
  }

  //Animation "Bevölkerungsverteilung über die Zeit" (automatisches Bewegen des Sliders)
  animateSlider() {
    //Aktuellen Wert des Sliders, sowie Grenzen (min/max) bestimmen
    var value = $("#slider").slider("value");
    var min = $("#slider").slider("option", "min");
    var max = $("#slider").slider("option", "max");

    //Wenn die Grenze noch nicht erreicht ist, Slider eine Position weiter.
    //Ansonsten auf Min-Wert setzen und von vorne anfangen
    if (value < max) {
      $("#slider").slider("value", value + 1);
    } else {
      $("#slider").slider("value", min);
    }
    var self = this;
    //Jede Sekunde wiederholen
    this.animation = setTimeout(function() {
      self.animateSlider();
    }, 1000);
  }

  //Animation "Bevölkerungsverteilung über die Zeit" (automatisches Bewegen des Sliders) starten
  startAnimation() {
    //Nur starten, wenn noch nicht gestartet
    if (this.animation) return;
    this.animateSlider();
  }

  //Animation stoppen
  stopAnimation() {
    if (!this.animation) return;
    clearTimeout(this.animation);
    this.animation = null;
  }

  //Initialisierung der Seite
  async init() {
    //MapMaker Instanz erzeugen (Kümmert sich um alles was mit der Karte zu tun hat)
    var m = new MapMaker(
      "http://localhost:3000/",
      "http://localhost:5000/",
      "map-canvas"
    );

    //Anzeigbare Jahre abrufen
    var availableYears = await this.loadAvailableYears(m);

    //Slider zu Anfang auf 2018 setzen. (Wenn in den Daten verfügbar)
    var startYear = 2018;
    if (!availableYears.includes(startYear)) startYear = availableYears[0];
    await this.addLayer(m, startYear, availableYears);

    var self = this;
    //Mehrfaches ausführen von addLayer aus Performance-Gründen verhindern
    var last = 0;
    //Slider zum Durchlaufen der einzelnen Jahre.
    $("#slider").slider({
      range: false,
      min: 0,
      max: availableYears.length - 1, //Als Slider-Index wird der Index des Arrays 'availableYears' genutzt.
      value: availableYears.indexOf(startYear),
      change: function(event, ui) {
        ///Beschriftung des Sliders auf aktuell gewähltes Jahr setzen
        $("#sliderDataYear").text(availableYears[ui.value]);

        //Wenn sich der Slider-Wert ändert die Layer entsprechend aktualisieren
        if (last !== ui.value)
          self.addLayer(m, availableYears[ui.value], availableYears);
        last = ui.value;
      },
      create: function() {
        ///Beschriftung des Sliders auf aktuell gewähltes Jahr setzen
        $("#sliderDataYear").text(availableYears[$(this).slider("value")]);
      },
      slide: function(event, ui) {
        //Beschriftung des Sliders auf aktuell gewähltes Jahr setzen
        $("#sliderDataYear").text(availableYears[ui.value]);
        //Wenn sich der Slider-Wert ändert die Layer enstprechend aktualisieren
        if (last !== ui.value)
          self.addLayer(m, availableYears[ui.value], availableYears);
        last = ui.value;
      }
    });

    var self = this;
    //Der Nutzer kann zwischen verschiedenen Ansichten wechseln. (HeatMap, Farblich nach relativer Bevölkerungszahl, Eindeutig eingefärbt)
    //Bei Änderung der Auswahl, die Layer entsprechend anpassen.
    $(".viewSelection").change(async function(event) {
      //Beim Wechsel der Ansicht muss der Slider-Max-Wert ggf. angepasst werden. (Vorhersage nur bei HeatMap)
      availableYears = await self.loadAvailableYears(m);
      if ($("#slider").slider("value") > availableYears.length - 1)
        $("#slider").slider("value", availableYears.length - 1);
      $("#slider").slider("option", "max", availableYears.length - 1);

      //Layer aktualisieren
      self.addLayer(
        m,
        availableYears[$("#slider").slider("value")],
        availableYears
      );
    });

    //Bei Änderung des anzuzeigenden Geschlechts Layer aktualisieren
    $("#genderForm input").on("change", function() {
      //Layer aktualisieren
      self.addLayer(
        m,
        availableYears[$("#slider").slider("value")],
        availableYears
      );
    });
    //Menü initialisieren
    this.initMenu();

    return m;
  }

  //Lädt die für die Anzeige verfügbaren Jahre
  async loadAvailableYears(m) {
    var option = "0";
    if (
      //Vorhersage nur bei HeatMap-Verfügbar. Daher für die Ansicht passende Jahreszahlen abfragen
      $("#useAmountColor").is(":checked") ||
      $("#useUnqiueColor").is(":checked")
    ) {
      option = "1";
    }
    return await m.loadAvailableYears(option);
  }

  //Fügt der Karte die benötigten Layer hinzu bzw. ändert/aktualisiert diese, wenn der Nutzer eine Anzeigeoption ändert.
  async addLayer(m, year, availableYears) {
    //Aktuell gewähltes Geschlecht bestimmen
    var selectedGender = $(
      "input[name=genderSelection]:checked",
      "#genderForm"
    ).val();

    var promiseList = [];

    //Ein-/Ausblenden der (nicht) benötigten Layer durch Aufruf der MapMaker-Klasse
    if ($("#useAmountColor").is(":checked")) {
      $("#descriptionHeatmap").hide();
      $("#descriptionColorAmount").show();
      $("#descriptionColorUnique").hide();
      this.stateLayerChanged = true;
      //Bundesland-Layer aktualisieren, Zoom-Level aktualisieren, HeatMap entfernen
      promiseList.push(
        m.addBLLayer(year, layerEnum["layerColoredByAmount"], selectedGender)
      );
      m.setZoom(zoomEnum["adjustedZoom"]);
      m.removeHeatMap();
      m.preload(
        year,
        selectedGender,
        layerEnum["layerColoredByAmount"],
        availableYears
      );
    } else if ($("#useUnqiueColor").is(":checked")) {
      $("#descriptionHeatmap").hide();
      $("#descriptionColorAmount").hide();
      $("#descriptionColorUnique").show();
      //Bundesland-Layer aktualisieren, Zoom-Level aktualisieren, HeatMap entfernen
      this.stateLayerChanged = true;
      promiseList.push(
        m.addBLLayer(year, layerEnum["layerColoredUnique"], selectedGender)
      );
      m.setZoom(zoomEnum["adjustedZoom"]);
      m.removeHeatMap();
      m.preload(
        year,
        selectedGender,
        layerEnum["layerColoredUnique"],
        availableYears
      );
    } else {
      $("#descriptionHeatmap").show();
      $("#descriptionColorAmount").hide();
      $("#descriptionColorUnique").hide();
      //Bundesland-Layer aktualisieren, Zoom-Level aktualisieren, HeatMap hinzufügen
      promiseList.push(m.addHeatMap(year, selectedGender));
      //Der für die HeatMap verwendete Bundesland-Layer ist unabhängig von der gewählten Jahreszahl,
      //muss somit nicht jedes mal getauscht werden.
      if (this.stateLayerChanged)
        promiseList.push(
          m.addBLLayer(year, layerEnum["heatMapLayer"], selectedGender)
        );
      m.setZoom(zoomEnum["regularZoom"]);
      this.stateLayerChanged = false;
      m.preload(
        year,
        selectedGender,
        layerEnum["heatMapLayer"],
        availableYears
      );
    }
    //Warten bis alle Layer bereit sind.
    await Promise.all(promiseList);
  }
}
