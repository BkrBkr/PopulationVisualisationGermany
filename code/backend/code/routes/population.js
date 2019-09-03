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
const router = express.Router();

const population_controller = require('../controller/population');

//Definition der Routen für den Bereich population. Details siehe Controller

router.get('/data/:year', population_controller.get_Population);
router.get('/availableYears/:viewType', population_controller.get_availableYears);

router.get('/populationByBL/:year', population_controller.get_populationByBL);

router.get('/lineChartData/', population_controller.get_lineChartData);

module.exports = router;