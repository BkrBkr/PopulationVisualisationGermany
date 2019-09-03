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
const db = require("./db");
const _ = require("underscore");
import PolynomialRegression from "./node_modules/js-polynomial-regression/src/PolynomialRegression.js";

class Future {
  // Diese Funktion erzeugt die Modelle für die Zukunftsprognose basierend auf den historischen Daten
  // Die Daten werden mit Hilfe eines Polynom 9. Grades angenähert. (Bibliothek js-polynomial-regression)
  // Das hier berechnete Polynom kann performant in der REST-Route genutzt werden.
  async calculateModel() {
    //Daten Cachen: Berechnung nur 1x notwendig
    if (this.data) {
      return this.data;
    }
    console.log("Berechne Modell");

    //Abfrage aller Datensätze nach 1990. (Datensätze davor sind unvollständig)
    var result = await db.query(
      "SELECT ST_X(coordinates::geometry) as lng, ST_Y(coordinates::geometry) as lat, totalpop, mpop, fpop, dataYear, plz from population where dataYear>=1990",
      []
    );

    // Aufbereitung der Daten:
    // Daten müssen für 'js-polynomial-regression' als x,y Paare vorliegen: x = Jahr y = Einwohner in diesem Jahr
    var tmpData = [];
    _.each(result.rows, function(row) {
      // Für jede Gemeinde muss eine einzelne Vorhersage getroffen werden
      // Leider lassen sich die Koordinaten nicht zur Identifikation einer Gemeinde über mehrere Jahre nutzen
      // Die Koordinaten der Ausgangsdaten schwanken über die Jahre leicht.
      // Daher identifiziert die Postleitzahl die Gemeinde, jedoch nicht eindeutig
      // Um die Verarbeitung zu vereinfachen werden daher alle Gemeinden mit der selben Postleitzahl an einem Standort aufaddiert.
      var key = row["plz"];
      if (key && key !== "") {
        if (!tmpData[key]) {
          //Für jede Gemeinde zusätzlich noch einmal die Koordinaten mit erfassen. (Koordinaten werden in REST-Route benötigt)
          tmpData[key] = {
            lat: row["lat"],
            lng: row["lng"],
            dataTotal: [],
            dataMale: [],
            dataFemale: []
          };
        }
        var datayear = parseInt(row["datayear"], 10);
        if (!tmpData[key].dataTotal[datayear])
          tmpData[key].dataTotal[datayear] = 0;
        if (!tmpData[key].dataMale[datayear])
          tmpData[key].dataMale[datayear] = 0;
        if (!tmpData[key].dataFemale[datayear])
          tmpData[key].dataFemale[datayear] = 0;

        //Auffaddieren von mehreren Gemeinden mit der selben Postleitzahl
        tmpData[key].dataTotal[datayear] += parseInt(row["totalpop"], 10);
        tmpData[key].dataMale[datayear] += parseInt(row["mpop"], 10);
        tmpData[key].dataFemale[datayear] += parseInt(row["fpop"], 10);
      } else {
        throw "Fehlerhafte Daten";
      }
    });

    //Die oben ermittelten Rohdaten in das von 'js-polynomial-regression' erwartete Format bringen
    var data = [];
    for (var townKey in tmpData) {
      var tmpDataItem = tmpData[townKey];
      if (!data[townKey]) {
        data[townKey] = {
          lat: tmpDataItem.lat,
          lng: tmpDataItem.lng,
          dataTotal: [],
          dataMale: [],
          dataFemale: []
        };
      }
      for (var year in tmpDataItem.dataTotal) {
        year = parseInt(year, 10);
        //Vorhersage für Gesamtzahl, Männlich, Weiblich getrennt
        data[townKey].dataTotal.push({
          x: year,
          y: tmpDataItem.dataTotal[year]
        });
        data[townKey].dataMale.push({ x: year, y: tmpDataItem.dataMale[year] });
        data[townKey].dataFemale.push({
          x: year,
          y: tmpDataItem.dataFemale[year]
        });
      }
    }

    //data enthält nun für jede Gemeinde x,y Paare aus Jahr und Einwohneranzahl

    //Für jeden Datensatz muss das Polynom berechnet werden
    var resultData = [];
    for (var key in data) {
      var value = data[key];

      //Für jedes Geschlecht im jeweiligen Datensatz ein
      var modelTotal = PolynomialRegression.read(value.dataTotal, 9);
      var termsTotal = modelTotal.getTerms();
      var modelMale = PolynomialRegression.read(value.dataMale, 9);
      var termsMale = modelMale.getTerms();
      var modelFemale = PolynomialRegression.read(value.dataFemale, 9);
      var termsFemale = modelFemale.getTerms();

      //Rückgabeformat für Verwendung in REST-Route
      resultData[key] = {
        total: { terms: termsTotal, model: modelTotal },
        male: { terms: termsMale, model: modelMale },
        female: { terms: termsFemale, model: modelFemale },
        lat: value.lat,
        lng: value.lng
      };
    }
    this.data = resultData;
    return resultData;
  }
}
const f = new Future();
module.exports = f;
