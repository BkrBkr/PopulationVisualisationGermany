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

const express = require('express');
const bodyParser = require('body-parser');
const future = require('./future');
const app = express();
const port = 3000;
const db = require('./db');
const populationRouter = require('./routes/population');

//POST Bodys sind im JSON-Format -> parsen
app.use(bodyParser.json());


app.use(
	bodyParser.urlencoded({
		extended: true,
	})
);

//Bereistellung der REST-Route für die Population durch Router 'population' (population.js)
app.use('/population', populationRouter);
//Bereistellung des HTML-Frontends
app.use(express.static('../../frontend/'));

//Prüfen ob DB-Zugriff möglich ist / Abfrage der Anzahl an Datensätzen
db.query("SELECT count(*) n from population").then(function (result) {

	//Prüfen ob Daten in die DB eingespielt wurden
	if (!result || !result.rows || result.rows.length === 0 || !result.rows[0]['n'] || result.rows[0]['n'] < 1)
		throw "Keine Daten in Datenbank";

	//Erstellung der Modelle für die Zukunftsprognose
	future.calculateModel().then(function () {
		//NodeJS auf 'port' starten
		app.listen(port, () => {
			console.log(`App running on port ${port}.`)
		})
	}).catch(function (e) {
		console.log(e);
	});
}).catch(function (e) {
	console.log("Fehler beim Verbinden zur DB.");
	console.log(e);
});




export { }