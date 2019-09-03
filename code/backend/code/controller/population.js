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
const db = require("../db");
const _ = require("underscore");
const future = require("./../future");
const genderEnum = {
  total: "0",
  male: "1",
  female: "2"
};

//Diese REST-Route dient zum Abfragen der Einwohnerzahlen pro Gemeinde
//Eingabeparameter sind das Jahr (erforderlich) und das Geschlecht (optional)
//Rückgabe ist ein JSON-Objekt im vom Heatmap-Plugin erwarteten Format (Kein Konvertierungsoverhead im client!) mit:
//Array von Gemeinden mit lat,long und count (Einwohnerzahl)
//Zusätzlich: Maximale-Einwohnerzahl in einer Gemeinde (Max-Wert der Heatmap)
//Beispiel: {"max":3613495,"data":[{"lat":54.78252,"lng":9.43751,"count":88519}, ...] }
exports.get_Population = async function(req, res) {
  try {
    //Jahresangabe ist erforderlich
    if (!req.params.year) {
      res.json({ error: "Query-Parameter 'year' nicht übergeben" });
      return;
    }
    console.log(
      "get_Population year=" + req.params.year + " gender=" + req.query.gender
    );

    //Abfrage aller Datensätze aus dem angebenen Jahr
    var values = [req.params.year];
    var result = await db.query(
      "SELECT ST_X(coordinates::geometry) as lng, ST_Y(coordinates::geometry) as lat, totalpop, mpop, fpop  from population WHERE dataYear=$1",
      values
    );

    //Wenn Datensatz nicht gefunden wurde Vorhersage-Modus nutzen
    if (result.rows.length === 0) {
      return calculateFuture(req.params.year, req, res);
    }
    //Rückgabe im vom Heatmap-Plugin erwarteten Format (Kein Konvertierungsoverhead im client!)
    var geoJSON = {
      max: 0,
      data: []
    };

    var max = 0;
    _.each(result.rows, function(row) {
      //Bestimmung der Einwohnerzahl anhand des übergeben Geschlechtes (req.query.gender)
      var pop = getPopByGender(row, req);

      //Rückgabe im vom Heatmap-Plugin erwarteten Format (Kein Konvertierungsoverhead im client!)
      var dataItem = { lat: row["lat"], lng: row["lng"], count: pop };
      geoJSON.data.push(dataItem);

      //Die höchste Bevölkerungszahl in einer Gemeinde bestimmen
      if (max < pop) max = pop;
    });
    geoJSON.max = max;
    res.json(geoJSON);
  } catch (e) {
    console.log(e);
    res.json({ error: "Fehler bei der Anfrage" });
  }
};

//Diese Funktion liest entsprechend des Query-Parameter gender die jeweilige Einwohnerzahl aus einer Ergebnis-Row aus.
function getPopByGender(row, req) {

  var pop = row["totalpop"];
  if (req.query.gender === genderEnum.male) pop = row["mpop"];
  else if (req.query.gender === genderEnum.female) pop = row["fpop"];
  pop = parseInt(pop, 10);
  if (!pop) pop = 0;
  return pop;
}

//Diese Funktion berechnet eine Vorhersage der Bevölkerungszahl für das übergebene Jahr
async function calculateFuture(year, req, res) {
  //Abrufen der vorberechneten Modell-Objekte (Erzeugtes Polynom)
  var data = await future.calculateModel();

  //Rückgabe im vom Heatmap-Plugin erwarteten Format (Kein Konvertierungsoverhead im client!)
  var geoJSON = {
    max: 0,
    data: []
  };

  //Bestimmung des verwendenden Geschlechtes anhand des Query-Parameter
  

  //Vorhersage für jede Gemeinde treffen
  var max = 0;
  for (var key in data) {
    var item = data[key];

    //Vorhersage aus Polynom berechnen
    var predVal = predict(data, key, req.query.gender, year);

    //Nur gültige Werte verwenden
    if (predVal && predVal >= 0) {
      //Rückgabe im vom Heatmap-Plugin erwarteten Format (Kein Konvertierungsoverhead im client!)
      var dataItem = { lat: item.lat, lng: item.lng, count: predVal };
      geoJSON.data.push(dataItem);

      //Die höchste Bevölkerungszahl in einer Gemeinde bestimmen
      if (max < predVal) max = predVal;
    }
  }
  geoJSON.max = max;

  res.json(geoJSON);
}

//Berechnet anhand des übergebenen Modells (data) und anhand der übergebenen Optionen die Vorhersage
function predict(data, plz, gender, year) {
	
  var genderProp = "total";
  if (gender === genderEnum.male) genderProp = "male";
  else if (gender === genderEnum.female) genderProp = "female";
  
  var item = data[plz];
  return Math.round(item[genderProp].model.predictY(item[genderProp].terms, year));
}

//Diese REST-Route liefert ein Array der verfügbaren bzw. vorhersagbaren Jahreszahlen
//Eingabeparameter ist der viewType. Die Vorhersage ist nur für die Heatmap implementiert.
//Daher müssen abhängig vom ViewType zukünftige Jahreszahlen mit ausgegeben werden oder eben nicht.
//Rückgabe ist ein Array der Jahreszahlen
//Beispiel: [1975,1980,1985, ...]
exports.get_availableYears = async function(req, res) {
  try {
    //ViewType muss gesetzt sein
    if (!req.params.viewType) {
      res.json({ error: "Kein ViewType übergeben" });
      return;
    }

    //Gültige ViewTypes 0 und 1. 0 = Heatmap = mit Vorhersage
    if (req.params.viewType !== "0" && req.params.viewType !== "1") {
      res.json({ error: "Ungültiger ViewType übergeben" });
      return;
    }

    console.log("get_availableYears");

    var availableYears = await inner_get_availableYears(req.params.viewType);

    res.json(availableYears.availableYears);
  } catch (e) {
    console.log(e);
    res.json({ error: "Fehler bei der Anfrage" });
  }
};

//Berechnet die für die Anzeige verfügbaren Jahre.
//Eingabeparameter ist der viewType. Die Vorhersage ist nur für die Heatmap implementiert.
//Daher müssen abhängig vom ViewType zukünftige Jahreszahlen mit ausgegeben werden oder eben nicht.
async function inner_get_availableYears(viewType) {
  //Alle verfügbaren Jahreszahlen aus der Datenbank abfragen
  var result = await db.query(
    "SELECT dataYear from population group by dataYear order by dataYear"
  );

  var availableYears = [];
  var maxYear = 0;
  //Aus den abgefragten Jahreszahlen ein Array erzeugen
  _.each(result.rows, function(row) {
    availableYears.push(row["datayear"]);

    //Das höchste Jahr aus den Datensätzen ermitteln
    if (maxYear < row["datayear"]) maxYear = row["datayear"];
  });
  //Wenn Vorhersage-Modus möglich ist, die nächsten 5 Jahre (nach maxYear) mit ausgeben.
  if (viewType === "0") {
    for (var i = maxYear + 1; i < maxYear + 6; i++) {
      availableYears.push(i);
    }
  }
  return { availableYears: availableYears, maxYear: maxYear };
}

//Diese REST-Route liefert die Bevölkerungszahl gruppiert nach Bundesland
//Eingabeparameter ist das Jahr
//Rückgabe ist ein JSON-Objekt mit den aufbereiteten Daten:
//Pro Bundesland enthält das Objekt eine Property (Name = Name des Bundeslands).
//Diese Property enthält die Einwohnerzahl des Bundeslands, die relative Bevölkerung (zur Gesamtbevölkerung Deutschlands), sowie die "Center" Koordinaten an denen der Marker auf der Map platziert werden soll.
//Beispiel: {"Schleswig-Holstein":{"id":1,"count":2889821,"center":{"lng":9.59085917330421,"lat":54.2082211066283},"percent":3}, ...}
exports.get_populationByBL = async function(req, res) {
  try {
    if (!req.params.year) {
      res.json({ error: "Query-Parameter 'year' nicht übergeben" });
      return;
    }
    console.log(
      "get_populationByBL year=" +
        req.params.year +
        " gender=" +
        req.query.gender
    );
    var values = [req.params.year];

    //Abfrage der Einwohnerzahl pro Bundesland im angebenen Jahr (Aufaddieren der einzelnen Bundesländer)
    var result = await db.query(
      "SELECT bl, totalpop, mpop, fpop, name, ST_X(center::geometry) as lng, ST_Y(center::geometry) as lat FROM bl left join (SELECT bl, sum(totalpop) as totalpop, sum(mpop) as mpop, sum(fpop) as fpop FROM population WHERE dataYear=$1 group by bl) as population on (population.bl=bl.id)",
      values
    );

    var data = {};
    var totalPop = 0;
    //Für jedes Bundesland eine Proptery im Rückgabeobjekt mut der Bevölkerungszahl, dem "Zentrum" (Standort des Makers)
    _.each(result.rows, function(row) {
      var pop = getPopByGender(row, req);
      data[row["name"]] = {
        id: row["bl"],
        count: pop,
        center: { lng: row["lng"], lat: row["lat"] }
      };

      //Berechnen der Gesamtbevölkerung in Deutschland
      totalPop += pop;
    });

    //Pro Bundesland relative Bevölkerung zur Gesamtbevölkerung berechnen
    _.each(result.rows, function(row) {
      var item = data[row["name"]];
      item.percent = Math.round((100 / totalPop) * item.count);
    });

    data.totalPop = totalPop;
    res.json(data);
  } catch (e) {
    console.log(e);
    res.json({ error: "Fehler bei der Anfrage" });
  }
};

//Diese REST-Route liefert die notwendigen Daten für die Anzeige der Line-Chart im HeatMap-Layer:
//Die notwendigen Daten sind die Einwohnerzahlen pro Jahr für eine ausgewählte Anzahl an Gemeinden,
//die im vom Chart-Framework erwarteten Format kodiert werden.
//Rückgabe sind die verfügbaren Jahre (als Label) sowie die Nutzdaten
//Beispiel: {"lables":[1975,1980,1985,1990,1995,2000,2005, ...],"dataSets":[{"label":"Berlin","data":[0,0,0,3433695,3471418,3382169,3395189, ...]}
exports.get_lineChartData = async function(req, res) {
  try {
    //Konfiguarion der darzustellenden Städte
    var towns = [];
    towns[10178] = { plz: "10178", name: null, color: "red" }; //name: null => Aus Datenbestand ermitteln
    towns[80331] = { plz: "80331", name: null, color: "blue" };
    towns[20038] = { plz: "20038", name: null, color: "green" };

    console.log("get_lineChartData gender=" + req.query.gender);
    //Abrufen der vorberechneten Modell-Objekte (Erzeugtes Polynom)
    var futureData = await future.calculateModel();

    //Abruf der Daten für ausgwählte Gemeinden
    var values = [];
    for (var town in towns) {
      values.push(String(towns[town].plz));
    }
    var params = [];
    for (var i = 1; i <= values.length; i++) {
      params.push("$" + i);
    }
    var result = await db.query(
      "SELECT plz, totalpop, mpop, fpop, datayear, name FROM population WHERE plz in (" +
        params.join(",") +
        ") ORDER BY plz, datayear desc",
      values
    );

    //In dieser Schleife werden die Einwohnerzahlen zunächst nach Postleitzahl und Jahr gruppiert in einem Array gespeichert.
    //Es liegen nicht für alle Gemeinden für alle Jahre Daten vor. Lücken müssen mit 0 gefülllt werden,
    //da die Anzeige der Chart ansonsten fehlerhaft ist.
    var tmpData = [];
    _.each(result.rows, function(row) {
      var pop = getPopByGender(row, req);
      var plz = row["plz"];
      var dataYear = row["datayear"];

      if (!tmpData[plz]) 
        tmpData[plz] = [];
        
      tmpData[plz][dataYear] = pop;

      if(!towns[plz].name)
        towns[plz].name=row["name"];
    });

    //Abfrage der Jahre für die Daten angezeigt werden können/sollen
    var availableYearsResult = await inner_get_availableYears("0");
    var availableYears = availableYearsResult.availableYears;

    //Aufbereitung der oben gruppierten "Rohdaten"
    var data = [];
    for (var yearIdx in availableYears) {
      var year = availableYears[yearIdx];
      for (var plz in tmpData) {
        //Wenn das Jahr nicht verfügbar ist eine 0 setzen. (Notwendig für Chart-Framework)
        //Wenn das Jahr in der Zukunft liegt Vorhersage treffen.
        var pop = 0;
        if (tmpData[plz][year]) {
          pop = tmpData[plz][year];
        } else if (year > availableYearsResult.maxYear) {
          pop = predict(futureData, plz, req.query.gender, year);
        }

        if (!data[plz])
          data[plz] = {
            label: towns[plz].name.replace(/\s\s+/g, ' '),
            borderColor: towns[plz].color,
            data: []
          };
        data[plz].data.push(parseInt(pop, 10));
      }
    }

    //Chart-Plugin erwartet ein Array von Datasets
    var dataSets = { labels: availableYears, dataSets: [] };
    for (var key in data) {
      dataSets.dataSets.push(data[key]);
    }

    res.json(dataSets);
  } catch (e) {
    console.log(e);
    res.json({ error: "Fehler bei der Anfrage" });
  }
};
